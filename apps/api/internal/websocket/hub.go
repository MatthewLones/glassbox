package websocket

import (
	"context"
	"encoding/json"
	"errors"
	"sync"

	"github.com/glassbox/api/internal/database"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

var (
	ErrInvalidChannel = errors.New("invalid channel format")
	ErrUnauthorized   = errors.New("unauthorized")
)

// Hub maintains active WebSocket connections and handles message routing
type Hub struct {
	// Registered clients
	clients map[*Client]bool

	// Channel subscriptions: channel -> set of clients
	channels map[string]map[*Client]bool

	// Presence tracking: nodeID -> userID -> presence info
	presence map[string]map[string]*PresenceInfo

	// Client by user ID for quick lookup
	clientsByUser map[string]map[*Client]bool

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Broadcast to a channel
	broadcast chan *BroadcastMessage

	// Mutex for thread-safe operations
	mu sync.RWMutex

	// Redis for pub/sub across instances
	redis *database.Redis

	// Logger
	logger *zap.Logger

	// Context for shutdown
	ctx    context.Context
	cancel context.CancelFunc
}

// PresenceInfo tracks user presence on a node
type PresenceInfo struct {
	UserID    string `json:"userId"`
	UserEmail string `json:"userEmail"`
	Action    string `json:"action"` // "viewing", "editing"
	Position  *struct {
		Line   int `json:"line,omitempty"`
		Column int `json:"column,omitempty"`
	} `json:"position,omitempty"`
}

// BroadcastMessage is used to send messages to a channel
type BroadcastMessage struct {
	Channel string
	Message *Message
	Exclude *Client // Optional: exclude this client from broadcast
}

// NewHub creates a new Hub instance
func NewHub(redis *database.Redis, logger *zap.Logger) *Hub {
	ctx, cancel := context.WithCancel(context.Background())
	return &Hub{
		clients:       make(map[*Client]bool),
		channels:      make(map[string]map[*Client]bool),
		presence:      make(map[string]map[string]*PresenceInfo),
		clientsByUser: make(map[string]map[*Client]bool),
		register:      make(chan *Client),
		unregister:    make(chan *Client),
		broadcast:     make(chan *BroadcastMessage, 256),
		redis:         redis,
		logger:        logger,
		ctx:           ctx,
		cancel:        cancel,
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	// Start Redis subscriber in a goroutine
	go h.subscribeToRedis()

	for {
		select {
		case <-h.ctx.Done():
			return

		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case msg := <-h.broadcast:
			h.broadcastToChannel(msg)
		}
	}
}

// Stop gracefully shuts down the hub
func (h *Hub) Stop() {
	h.cancel()
}

// registerClient adds a client to the hub
func (h *Hub) registerClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.clients[client] = true

	// Track by user ID
	if h.clientsByUser[client.UserID] == nil {
		h.clientsByUser[client.UserID] = make(map[*Client]bool)
	}
	h.clientsByUser[client.UserID][client] = true

	h.logger.Info("Client registered",
		zap.String("userId", client.UserID),
		zap.String("email", client.UserEmail),
	)
}

// unregisterClient removes a client from the hub
func (h *Hub) unregisterClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.clients[client]; !ok {
		return
	}

	// Remove from all subscribed channels
	for channel := range client.subscriptions {
		if h.channels[channel] != nil {
			delete(h.channels[channel], client)
			if len(h.channels[channel]) == 0 {
				delete(h.channels, channel)
			}
		}
	}

	// Remove presence from all nodes
	for nodeID := range h.presence {
		delete(h.presence[nodeID], client.UserID)
		if len(h.presence[nodeID]) == 0 {
			delete(h.presence, nodeID)
		} else {
			// Broadcast presence left
			h.broadcastPresenceLeft(nodeID, client.UserID, client.UserEmail)
		}
	}

	// Remove from user tracking
	if h.clientsByUser[client.UserID] != nil {
		delete(h.clientsByUser[client.UserID], client)
		if len(h.clientsByUser[client.UserID]) == 0 {
			delete(h.clientsByUser, client.UserID)
		}
	}

	delete(h.clients, client)
	close(client.send)

	h.logger.Info("Client unregistered",
		zap.String("userId", client.UserID),
		zap.String("email", client.UserEmail),
	)
}

// Subscribe adds a client to a channel
func (h *Hub) Subscribe(client *Client, channel string) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Validate channel format
	ch, err := ParseChannel(channel)
	if err != nil {
		return err
	}

	// TODO: Verify client has access to this channel (project/node membership)

	// Add to channel
	if h.channels[channel] == nil {
		h.channels[channel] = make(map[*Client]bool)
	}
	h.channels[channel][client] = true
	client.subscriptions[channel] = true

	h.logger.Debug("Client subscribed to channel",
		zap.String("userId", client.UserID),
		zap.String("channel", channel),
		zap.String("channelType", ch.Type),
	)

	return nil
}

// Unsubscribe removes a client from a channel
func (h *Hub) Unsubscribe(client *Client, channel string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(client.subscriptions, channel)
	if h.channels[channel] != nil {
		delete(h.channels[channel], client)
		if len(h.channels[channel]) == 0 {
			delete(h.channels, channel)
		}
	}

	h.logger.Debug("Client unsubscribed from channel",
		zap.String("userId", client.UserID),
		zap.String("channel", channel),
	)
}

// GetChannelUsers returns the user IDs/emails of users subscribed to a channel
func (h *Hub) GetChannelUsers(channel string) []string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var users []string
	seen := make(map[string]bool)

	if clients, ok := h.channels[channel]; ok {
		for client := range clients {
			if !seen[client.UserID] {
				users = append(users, client.UserEmail)
				seen[client.UserID] = true
			}
		}
	}

	return users
}

// UpdatePresence updates a user's presence on a node
func (h *Hub) UpdatePresence(client *Client, nodeID string, action string, position *struct {
	Line   int `json:"line,omitempty"`
	Column int `json:"column,omitempty"`
}) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if action == "left" {
		// Remove presence
		if h.presence[nodeID] != nil {
			delete(h.presence[nodeID], client.UserID)
			if len(h.presence[nodeID]) == 0 {
				delete(h.presence, nodeID)
			}
		}
	} else {
		// Add/update presence
		if h.presence[nodeID] == nil {
			h.presence[nodeID] = make(map[string]*PresenceInfo)
		}
		h.presence[nodeID][client.UserID] = &PresenceInfo{
			UserID:    client.UserID,
			UserEmail: client.UserEmail,
			Action:    action,
			Position:  position,
		}
	}

	// Broadcast presence update to node channel
	nodeChannel := "node:" + nodeID
	msg := NewMessage(MsgTypePresenceUpdate, PresenceEventPayload{
		NodeID:    nodeID,
		UserID:    client.UserID,
		UserEmail: client.UserEmail,
		Action:    action,
		Position:  position,
	})

	// Unlock before broadcasting
	h.mu.Unlock()
	h.broadcast <- &BroadcastMessage{
		Channel: nodeChannel,
		Message: msg,
		Exclude: client, // Don't send back to the sender
	}
	h.mu.Lock() // Re-lock for deferred unlock
}

// GetNodePresence returns all users present on a node
func (h *Hub) GetNodePresence(nodeID string) []*PresenceInfo {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var presence []*PresenceInfo
	if nodePresence, ok := h.presence[nodeID]; ok {
		for _, info := range nodePresence {
			presence = append(presence, info)
		}
	}

	return presence
}

// broadcastToChannel sends a message to all clients in a channel
func (h *Hub) broadcastToChannel(msg *BroadcastMessage) {
	h.mu.RLock()
	clients := h.channels[msg.Channel]
	h.mu.RUnlock()

	if clients == nil {
		return
	}

	data, err := msg.Message.ToJSON()
	if err != nil {
		h.logger.Error("Failed to marshal broadcast message", zap.Error(err))
		return
	}

	for client := range clients {
		if msg.Exclude != nil && client == msg.Exclude {
			continue
		}
		select {
		case client.send <- data:
		default:
			// Client buffer is full, skip
			h.logger.Warn("Client send buffer full, skipping",
				zap.String("userId", client.UserID),
			)
		}
	}
}

// broadcastPresenceLeft broadcasts that a user left
func (h *Hub) broadcastPresenceLeft(nodeID, userID, userEmail string) {
	nodeChannel := "node:" + nodeID
	msg := NewMessage(MsgTypePresenceUpdate, PresenceEventPayload{
		NodeID:    nodeID,
		UserID:    userID,
		UserEmail: userEmail,
		Action:    "left",
	})

	// Use non-blocking send to broadcast channel
	select {
	case h.broadcast <- &BroadcastMessage{Channel: nodeChannel, Message: msg}:
	default:
	}
}

// Broadcast sends a message to a specific channel
func (h *Hub) Broadcast(channel string, msg *Message) {
	h.broadcast <- &BroadcastMessage{
		Channel: channel,
		Message: msg,
	}
}

// BroadcastToProject sends a message to all users subscribed to a project
func (h *Hub) BroadcastToProject(projectID uuid.UUID, msg *Message) {
	channel := "project:" + projectID.String()
	h.Broadcast(channel, msg)

	// Also publish to Redis for other instances
	h.publishToRedis(channel, msg)
}

// BroadcastToNode sends a message to all users subscribed to a node
func (h *Hub) BroadcastToNode(nodeID uuid.UUID, msg *Message) {
	channel := "node:" + nodeID.String()
	h.Broadcast(channel, msg)

	// Also publish to Redis for other instances
	h.publishToRedis(channel, msg)
}

// Redis pub/sub for multi-instance support

// RedisMessage is used for pub/sub across instances
type RedisMessage struct {
	Channel string   `json:"channel"`
	Message *Message `json:"message"`
}

// publishToRedis publishes a message to Redis for other instances
func (h *Hub) publishToRedis(channel string, msg *Message) {
	if h.redis == nil {
		return
	}

	redisMsg := RedisMessage{
		Channel: channel,
		Message: msg,
	}

	data, err := json.Marshal(redisMsg)
	if err != nil {
		h.logger.Error("Failed to marshal Redis message", zap.Error(err))
		return
	}

	if err := h.redis.Publish(h.ctx, "glassbox:ws", string(data)); err != nil {
		h.logger.Error("Failed to publish to Redis", zap.Error(err))
	}
}

// subscribeToRedis subscribes to Redis pub/sub for messages from other instances
func (h *Hub) subscribeToRedis() {
	if h.redis == nil {
		return
	}

	pubsub := h.redis.Subscribe(h.ctx, "glassbox:ws")
	defer pubsub.Close()

	ch := pubsub.Channel()

	for {
		select {
		case <-h.ctx.Done():
			return
		case redisMsg, ok := <-ch:
			if !ok {
				return
			}

			var msg RedisMessage
			if err := json.Unmarshal([]byte(redisMsg.Payload), &msg); err != nil {
				h.logger.Error("Failed to unmarshal Redis message", zap.Error(err))
				continue
			}

			// Broadcast to local clients
			h.broadcast <- &BroadcastMessage{
				Channel: msg.Channel,
				Message: msg.Message,
			}
		}
	}
}
