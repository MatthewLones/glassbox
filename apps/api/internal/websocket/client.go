package websocket

import (
	"encoding/json"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 8192

	// Send buffer size
	sendBufferSize = 256
)

// Client represents a WebSocket connection
type Client struct {
	hub *Hub

	// WebSocket connection
	conn *websocket.Conn

	// Buffered channel of outbound messages
	send chan []byte

	// User information
	UserID    string
	UserEmail string

	// Subscribed channels
	subscriptions map[string]bool

	// Logger
	logger *zap.Logger
}

// NewClient creates a new WebSocket client
func NewClient(hub *Hub, conn *websocket.Conn, userID, userEmail string, logger *zap.Logger) *Client {
	return &Client{
		hub:           hub,
		conn:          conn,
		send:          make(chan []byte, sendBufferSize),
		UserID:        userID,
		UserEmail:     userEmail,
		subscriptions: make(map[string]bool),
		logger:        logger,
	}
}

// ReadPump pumps messages from the WebSocket connection to the hub
func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.logger.Warn("WebSocket read error",
					zap.String("userId", c.UserID),
					zap.Error(err),
				)
			}
			break
		}

		c.handleMessage(message)
	}
}

// WritePump pumps messages from the hub to the WebSocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Write any queued messages
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage processes incoming messages from the client
func (c *Client) handleMessage(data []byte) {
	msg, err := ParseMessage(data)
	if err != nil {
		c.sendError("parse_error", "Invalid message format")
		return
	}

	switch msg.Type {
	case MsgTypeSubscribe:
		c.handleSubscribe(msg)
	case MsgTypeUnsubscribe:
		c.handleUnsubscribe(msg)
	case MsgTypePresence:
		c.handlePresence(msg)
	case MsgTypeLockAcquire:
		c.handleLockAcquire(msg)
	case MsgTypeLockRelease:
		c.handleLockRelease(msg)
	case MsgTypePing:
		c.handlePing(msg)
	default:
		c.sendError("unknown_type", "Unknown message type: "+string(msg.Type))
	}
}

// handleSubscribe processes subscription requests
func (c *Client) handleSubscribe(msg *Message) {
	// Parse payload
	payloadBytes, err := json.Marshal(msg.Payload)
	if err != nil {
		c.sendError("invalid_payload", "Invalid subscribe payload")
		return
	}

	var payload SubscribePayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		c.sendError("invalid_payload", "Invalid subscribe payload")
		return
	}

	if payload.Channel == "" {
		c.sendError("invalid_channel", "Channel is required")
		return
	}

	// Subscribe to channel
	if err := c.hub.Subscribe(c, payload.Channel); err != nil {
		c.sendError("subscribe_failed", err.Error())
		return
	}

	// Get current users in channel
	users := c.hub.GetChannelUsers(payload.Channel)

	// Send confirmation
	response := NewMessage(MsgTypeSubscribed, SubscribedPayload{
		Channel: payload.Channel,
		Users:   users,
	})
	response.RequestID = msg.RequestID

	c.sendMessage(response)

	c.logger.Debug("Client subscribed",
		zap.String("userId", c.UserID),
		zap.String("channel", payload.Channel),
	)
}

// handleUnsubscribe processes unsubscription requests
func (c *Client) handleUnsubscribe(msg *Message) {
	payloadBytes, err := json.Marshal(msg.Payload)
	if err != nil {
		c.sendError("invalid_payload", "Invalid unsubscribe payload")
		return
	}

	var payload SubscribePayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		c.sendError("invalid_payload", "Invalid unsubscribe payload")
		return
	}

	if payload.Channel == "" {
		c.sendError("invalid_channel", "Channel is required")
		return
	}

	// Unsubscribe from channel
	c.hub.Unsubscribe(c, payload.Channel)

	// Send confirmation
	response := NewMessage(MsgTypeUnsubscribed, SubscribedPayload{
		Channel: payload.Channel,
	})
	response.RequestID = msg.RequestID

	c.sendMessage(response)
}

// handlePresence processes presence updates
func (c *Client) handlePresence(msg *Message) {
	payloadBytes, err := json.Marshal(msg.Payload)
	if err != nil {
		c.sendError("invalid_payload", "Invalid presence payload")
		return
	}

	var payload PresencePayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		c.sendError("invalid_payload", "Invalid presence payload")
		return
	}

	if payload.NodeID == "" {
		c.sendError("invalid_node_id", "Node ID is required")
		return
	}

	// Update presence
	c.hub.UpdatePresence(c, payload.NodeID, payload.Action, payload.Position)
}

// handleLockAcquire processes lock acquire requests
func (c *Client) handleLockAcquire(msg *Message) {
	payloadBytes, err := json.Marshal(msg.Payload)
	if err != nil {
		c.sendError("invalid_payload", "Invalid lock payload")
		return
	}

	var payload LockPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		c.sendError("invalid_payload", "Invalid lock payload")
		return
	}

	// For lock operations, we delegate to the API's lock service
	// The client should use the REST API for lock acquisition
	// WebSocket just broadcasts the lock events
	c.sendError("use_rest_api", "Use REST API for lock operations. WebSocket will broadcast lock events.")
}

// handleLockRelease processes lock release requests
func (c *Client) handleLockRelease(msg *Message) {
	// Same as lock acquire - delegate to REST API
	c.sendError("use_rest_api", "Use REST API for lock operations. WebSocket will broadcast lock events.")
}

// handlePing processes ping requests
func (c *Client) handlePing(msg *Message) {
	response := NewMessage(MsgTypePong, nil)
	response.RequestID = msg.RequestID
	c.sendMessage(response)
}

// sendMessage sends a message to the client
func (c *Client) sendMessage(msg *Message) {
	data, err := msg.ToJSON()
	if err != nil {
		c.logger.Error("Failed to marshal message",
			zap.String("userId", c.UserID),
			zap.Error(err),
		)
		return
	}

	select {
	case c.send <- data:
	default:
		c.logger.Warn("Send buffer full, message dropped",
			zap.String("userId", c.UserID),
		)
	}
}

// sendError sends an error message to the client
func (c *Client) sendError(code, message string) {
	msg := NewMessage(MsgTypeError, ErrorPayload{
		Code:    code,
		Message: message,
	})
	c.sendMessage(msg)
}
