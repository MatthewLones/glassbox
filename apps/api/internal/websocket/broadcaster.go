package websocket

import (
	"time"

	"github.com/google/uuid"
)

// Broadcaster is an interface for broadcasting real-time events
// This allows decoupling the handlers from the WebSocket implementation
type Broadcaster interface {
	// Node events
	BroadcastNodeCreated(projectID, nodeID uuid.UUID, title, status, updatedBy string)
	BroadcastNodeUpdated(projectID, nodeID uuid.UUID, title, status, updatedBy string, changes map[string]any)
	BroadcastNodeDeleted(projectID, nodeID uuid.UUID, updatedBy string)

	// Lock events
	BroadcastLockAcquired(nodeID uuid.UUID, lockedBy, userEmail string, expiresAt time.Time)
	BroadcastLockReleased(nodeID uuid.UUID, releasedBy string)

	// Execution events
	BroadcastExecutionUpdate(nodeID, executionID uuid.UUID, status string, tokensIn, tokensOut int, traceSummary string)
}

// Ensure Hub implements Broadcaster
var _ Broadcaster = (*Hub)(nil)

// BroadcastNodeCreated broadcasts a node creation event
func (h *Hub) BroadcastNodeCreated(projectID, nodeID uuid.UUID, title, status, updatedBy string) {
	msg := NewMessage(MsgTypeNodeCreated, NodeEventPayload{
		ProjectID: projectID,
		NodeID:    nodeID,
		Title:     title,
		Status:    status,
		UpdatedBy: updatedBy,
	})
	h.BroadcastToProject(projectID, msg)
}

// BroadcastNodeUpdated broadcasts a node update event
func (h *Hub) BroadcastNodeUpdated(projectID, nodeID uuid.UUID, title, status, updatedBy string, changes map[string]any) {
	msg := NewMessage(MsgTypeNodeUpdated, NodeEventPayload{
		ProjectID: projectID,
		NodeID:    nodeID,
		Title:     title,
		Status:    status,
		UpdatedBy: updatedBy,
		Changes:   changes,
	})
	h.BroadcastToProject(projectID, msg)
	h.BroadcastToNode(nodeID, msg)
}

// BroadcastNodeDeleted broadcasts a node deletion event
func (h *Hub) BroadcastNodeDeleted(projectID, nodeID uuid.UUID, updatedBy string) {
	msg := NewMessage(MsgTypeNodeDeleted, NodeEventPayload{
		ProjectID: projectID,
		NodeID:    nodeID,
		UpdatedBy: updatedBy,
	})
	h.BroadcastToProject(projectID, msg)
}

// BroadcastLockAcquired broadcasts a lock acquired event
func (h *Hub) BroadcastLockAcquired(nodeID uuid.UUID, lockedBy, userEmail string, expiresAt time.Time) {
	msg := NewMessage(MsgTypeLockAcquired, LockEventPayload{
		NodeID:    nodeID,
		LockedBy:  lockedBy,
		UserEmail: userEmail,
		ExpiresAt: expiresAt,
	})
	h.BroadcastToNode(nodeID, msg)
}

// BroadcastLockReleased broadcasts a lock released event
func (h *Hub) BroadcastLockReleased(nodeID uuid.UUID, releasedBy string) {
	msg := NewMessage(MsgTypeLockReleased, LockEventPayload{
		NodeID:   nodeID,
		LockedBy: releasedBy, // Using LockedBy field for releasedBy
	})
	h.BroadcastToNode(nodeID, msg)
}

// BroadcastExecutionUpdate broadcasts an execution status update
func (h *Hub) BroadcastExecutionUpdate(nodeID, executionID uuid.UUID, status string, tokensIn, tokensOut int, traceSummary string) {
	msg := NewMessage(MsgTypeExecutionUpdate, ExecutionEventPayload{
		ExecutionID:    executionID,
		NodeID:         nodeID,
		Status:         status,
		TotalTokensIn:  tokensIn,
		TotalTokensOut: tokensOut,
		TraceSummary:   traceSummary,
	})
	h.BroadcastToNode(nodeID, msg)
}

// NopBroadcaster is a no-op implementation of Broadcaster for testing or when WS is disabled
type NopBroadcaster struct{}

func (n *NopBroadcaster) BroadcastNodeCreated(projectID, nodeID uuid.UUID, title, status, updatedBy string) {
}
func (n *NopBroadcaster) BroadcastNodeUpdated(projectID, nodeID uuid.UUID, title, status, updatedBy string, changes map[string]any) {
}
func (n *NopBroadcaster) BroadcastNodeDeleted(projectID, nodeID uuid.UUID, updatedBy string) {}
func (n *NopBroadcaster) BroadcastLockAcquired(nodeID uuid.UUID, lockedBy, userEmail string, expiresAt time.Time) {
}
func (n *NopBroadcaster) BroadcastLockReleased(nodeID uuid.UUID, releasedBy string) {}
func (n *NopBroadcaster) BroadcastExecutionUpdate(nodeID, executionID uuid.UUID, status string, tokensIn, tokensOut int, traceSummary string) {
}
