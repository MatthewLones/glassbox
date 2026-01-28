package websocket

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// MessageType represents the type of WebSocket message
type MessageType string

// Client message types (from client to server)
const (
	MsgTypeSubscribe    MessageType = "subscribe"
	MsgTypeUnsubscribe  MessageType = "unsubscribe"
	MsgTypePresence     MessageType = "presence"
	MsgTypeLockAcquire  MessageType = "lock_acquire"
	MsgTypeLockRelease  MessageType = "lock_release"
	MsgTypePing         MessageType = "ping"
)

// Server message types (from server to client)
const (
	MsgTypeSubscribed      MessageType = "subscribed"
	MsgTypeUnsubscribed    MessageType = "unsubscribed"
	MsgTypeNodeCreated     MessageType = "node_created"
	MsgTypeNodeUpdated     MessageType = "node_updated"
	MsgTypeNodeDeleted     MessageType = "node_deleted"
	MsgTypeLockAcquired    MessageType = "lock_acquired"
	MsgTypeLockReleased    MessageType = "lock_released"
	MsgTypePresenceUpdate  MessageType = "presence_update"
	MsgTypeExecutionUpdate MessageType = "execution_update"
	MsgTypeError           MessageType = "error"
	MsgTypePong            MessageType = "pong"
)

// Message is the base structure for all WebSocket messages
type Message struct {
	Type      MessageType    `json:"type"`
	Payload   any            `json:"payload,omitempty"`
	RequestID string         `json:"requestId,omitempty"`
	Timestamp time.Time      `json:"timestamp,omitempty"`
}

// NewMessage creates a new message with timestamp
func NewMessage(msgType MessageType, payload any) *Message {
	return &Message{
		Type:      msgType,
		Payload:   payload,
		Timestamp: time.Now(),
	}
}

// SubscribePayload for subscribe/unsubscribe messages
type SubscribePayload struct {
	Channel string `json:"channel"` // e.g., "project:uuid" or "node:uuid"
}

// PresencePayload for presence updates
type PresencePayload struct {
	NodeID   string `json:"nodeId"`
	Action   string `json:"action"` // "viewing", "editing", "left"
	Position *struct {
		Line   int `json:"line,omitempty"`
		Column int `json:"column,omitempty"`
	} `json:"position,omitempty"`
}

// LockPayload for lock acquire/release
type LockPayload struct {
	NodeID string `json:"nodeId"`
}

// SubscribedPayload response when subscription succeeds
type SubscribedPayload struct {
	Channel string   `json:"channel"`
	Users   []string `json:"users,omitempty"` // Current users in the channel
}

// NodeEventPayload for node create/update/delete events
type NodeEventPayload struct {
	NodeID    uuid.UUID      `json:"nodeId"`
	ProjectID uuid.UUID      `json:"projectId"`
	Title     string         `json:"title,omitempty"`
	Status    string         `json:"status,omitempty"`
	UpdatedBy string         `json:"updatedBy,omitempty"`
	Changes   map[string]any `json:"changes,omitempty"`
}

// LockEventPayload for lock acquired/released events
type LockEventPayload struct {
	NodeID    uuid.UUID `json:"nodeId"`
	LockedBy  string    `json:"lockedBy,omitempty"`
	UserEmail string    `json:"userEmail,omitempty"`
	ExpiresAt time.Time `json:"expiresAt,omitempty"`
}

// PresenceEventPayload for presence updates
type PresenceEventPayload struct {
	NodeID    string `json:"nodeId"`
	UserID    string `json:"userId"`
	UserEmail string `json:"userEmail"`
	Action    string `json:"action"` // "joined", "left", "editing", "viewing"
	Position  *struct {
		Line   int `json:"line,omitempty"`
		Column int `json:"column,omitempty"`
	} `json:"position,omitempty"`
}

// ExecutionEventPayload for execution status updates
type ExecutionEventPayload struct {
	ExecutionID   uuid.UUID `json:"executionId"`
	NodeID        uuid.UUID `json:"nodeId"`
	Status        string    `json:"status"`
	Progress      *int      `json:"progress,omitempty"`
	TraceSummary  string    `json:"traceSummary,omitempty"`
	TotalTokensIn int       `json:"totalTokensIn,omitempty"`
	TotalTokensOut int      `json:"totalTokensOut,omitempty"`
}

// ErrorPayload for error messages
type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// ParseMessage parses a raw JSON message
func ParseMessage(data []byte) (*Message, error) {
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}

// ToJSON converts a message to JSON
func (m *Message) ToJSON() ([]byte, error) {
	return json.Marshal(m)
}

// Channel represents a subscription channel
type Channel struct {
	Type string    // "project" or "node"
	ID   uuid.UUID
}

// ParseChannel parses a channel string like "project:uuid" or "node:uuid"
func ParseChannel(channel string) (*Channel, error) {
	// Expected format: "type:uuid"
	var channelType string
	var idStr string
	_, err := json.Marshal(channel) // Just to validate it's a string
	if err != nil {
		return nil, err
	}

	// Simple split
	for i, c := range channel {
		if c == ':' {
			channelType = channel[:i]
			idStr = channel[i+1:]
			break
		}
	}

	if channelType == "" || idStr == "" {
		return nil, ErrInvalidChannel
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		return nil, ErrInvalidChannel
	}

	if channelType != "project" && channelType != "node" {
		return nil, ErrInvalidChannel
	}

	return &Channel{Type: channelType, ID: id}, nil
}

// String returns the channel string representation
func (c *Channel) String() string {
	return c.Type + ":" + c.ID.String()
}
