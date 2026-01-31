# GlassBox WebSocket Protocol v1

Real-time communication protocol for collaboration features.

## Overview

GlassBox uses WebSocket for real-time updates including:
- Live node updates (create, edit, delete)
- Presence tracking (who's viewing/editing)
- Execution status updates
- Distributed locking notifications

## Connection

### Endpoint

```
ws://host:port/ws?token=<ws_token>
wss://host:port/ws?token=<ws_token>  (production)
```

### Authentication Flow

1. **Get JWT Token** - Authenticate via API or Cognito
2. **Exchange for WS Token** - Call `POST /api/v1/auth/ws-token`
3. **Connect** - Open WebSocket with WS token as query param

```bash
# Step 1: Get JWT (dev mode)
JWT=$(curl -s -X POST http://localhost:8080/api/v1/auth/dev-token \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123","email":"user@example.com"}' | jq -r '.token')

# Step 2: Get WS token
WS_TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/ws-token \
  -H "Authorization: Bearer $JWT" | jq -r '.token')

# Step 3: Connect (using websocat)
websocat "ws://localhost:8080/ws?token=$WS_TOKEN"
```

### Token Properties

| Property | Value |
|----------|-------|
| Expiration | 5 minutes |
| Single Use | Yes (can only connect once) |
| Stored In | Redis (for validation) |

---

## Message Format

All messages are JSON with the following structure:

```json
{
  "type": "message_type",
  "payload": { ... },
  "requestId": "optional-uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | Message type identifier |
| payload | object | Yes | Message data |
| requestId | string | No | For request-response correlation |

---

## Client → Server Messages

### subscribe

Subscribe to a channel for updates.

```json
{
  "type": "subscribe",
  "payload": {
    "channel": "project:550e8400-e29b-41d4-a716-446655440000"
  },
  "requestId": "req-123"
}
```

**Channel Formats:**
| Pattern | Description |
|---------|-------------|
| `project:<uuid>` | All updates in a project |
| `node:<uuid>` | Updates for specific node |

**Server Response:**
```json
{
  "type": "subscribed",
  "payload": {
    "channel": "project:550e8400-e29b-41d4-a716-446655440000",
    "users": [
      {"id": "user-1", "email": "alice@example.com"},
      {"id": "user-2", "email": "bob@example.com"}
    ]
  },
  "requestId": "req-123"
}
```

---

### unsubscribe

Unsubscribe from a channel.

```json
{
  "type": "unsubscribe",
  "payload": {
    "channel": "project:550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Server Response:**
```json
{
  "type": "unsubscribed",
  "payload": {
    "channel": "project:550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### presence

Update presence status on a node.

```json
{
  "type": "presence",
  "payload": {
    "nodeId": "node-uuid",
    "action": "editing",
    "cursorPosition": {"x": 150, "y": 230}
  }
}
```

**Action Values:**
| Action | Description |
|--------|-------------|
| `viewing` | User is viewing the node |
| `editing` | User is actively editing |
| `idle` | User is idle on the node |
| `left` | User left the node |

---

### lock_acquire

Request to acquire edit lock on a node.

```json
{
  "type": "lock_acquire",
  "payload": {
    "nodeId": "node-uuid"
  },
  "requestId": "req-456"
}
```

**Success Response:**
```json
{
  "type": "lock_acquired",
  "payload": {
    "nodeId": "node-uuid",
    "lockedBy": "user-uuid",
    "lockedByEmail": "user@example.com",
    "expiresAt": "2024-01-15T10:05:00Z"
  },
  "requestId": "req-456"
}
```

**Conflict Response:**
```json
{
  "type": "error",
  "payload": {
    "code": "LOCK_HELD",
    "message": "Node is locked by another user",
    "lockedBy": "other-user-uuid",
    "lockedByEmail": "other@example.com"
  },
  "requestId": "req-456"
}
```

---

### lock_release

Release edit lock on a node.

```json
{
  "type": "lock_release",
  "payload": {
    "nodeId": "node-uuid"
  }
}
```

**Response:**
```json
{
  "type": "lock_released",
  "payload": {
    "nodeId": "node-uuid"
  }
}
```

---

### ping

Keep connection alive.

```json
{
  "type": "ping",
  "requestId": "req-789"
}
```

**Response:**
```json
{
  "type": "pong",
  "requestId": "req-789"
}
```

---

## Server → Client Messages

### node_created

New node created in subscribed project.

```json
{
  "type": "node_created",
  "payload": {
    "projectId": "project-uuid",
    "node": {
      "id": "new-node-uuid",
      "title": "New Task",
      "status": "draft",
      "authorType": "human",
      "authorUserId": "user-uuid",
      "parentId": null,
      "position": {"x": 100, "y": 200},
      "createdAt": "2024-01-15T10:00:00Z"
    },
    "createdBy": {
      "id": "user-uuid",
      "email": "user@example.com"
    }
  }
}
```

---

### node_updated

Node was updated.

```json
{
  "type": "node_updated",
  "payload": {
    "nodeId": "node-uuid",
    "projectId": "project-uuid",
    "changes": {
      "title": "Updated Title",
      "status": "in_progress"
    },
    "version": 5,
    "updatedBy": {
      "id": "user-uuid",
      "email": "user@example.com"
    },
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### node_deleted

Node was deleted.

```json
{
  "type": "node_deleted",
  "payload": {
    "nodeId": "node-uuid",
    "projectId": "project-uuid",
    "deletedBy": {
      "id": "user-uuid",
      "email": "user@example.com"
    }
  }
}
```

---

### presence_update

User presence changed on a node.

```json
{
  "type": "presence_update",
  "payload": {
    "nodeId": "node-uuid",
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "name": "Alice"
    },
    "action": "editing",
    "cursorPosition": {"x": 150, "y": 230}
  }
}
```

---

### lock_acquired

Lock acquired by any user (broadcast to channel).

```json
{
  "type": "lock_acquired",
  "payload": {
    "nodeId": "node-uuid",
    "lockedBy": "user-uuid",
    "lockedByEmail": "user@example.com",
    "expiresAt": "2024-01-15T10:05:00Z"
  }
}
```

---

### lock_released

Lock released (broadcast to channel).

```json
{
  "type": "lock_released",
  "payload": {
    "nodeId": "node-uuid",
    "releasedBy": "user-uuid"
  }
}
```

---

### execution_update

Agent execution status changed.

```json
{
  "type": "execution_update",
  "payload": {
    "nodeId": "node-uuid",
    "executionId": "execution-uuid",
    "status": "running",
    "progress": {
      "currentStep": "analyzing",
      "tokensUsed": 1523,
      "estimatedCost": 0.0234
    },
    "traceEvent": {
      "type": "llm_call",
      "model": "gpt-4",
      "tokensIn": 234,
      "tokensOut": 156
    }
  }
}
```

**Execution Status Values:**
| Status | Description |
|--------|-------------|
| `pending` | Queued, waiting to start |
| `running` | Currently executing |
| `paused` | Paused by user |
| `awaiting_input` | Waiting for human input |
| `complete` | Successfully finished |
| `failed` | Failed with error |
| `cancelled` | Cancelled by user |

---

### error

Error response to a request.

```json
{
  "type": "error",
  "payload": {
    "code": "INVALID_CHANNEL",
    "message": "Channel format is invalid"
  },
  "requestId": "req-123"
}
```

**Error Codes:**
| Code | Description |
|------|-------------|
| `INVALID_TOKEN` | Token expired or invalid |
| `INVALID_CHANNEL` | Channel format invalid |
| `UNAUTHORIZED` | No access to channel |
| `LOCK_HELD` | Node is locked by another user |
| `NOT_FOUND` | Resource not found |
| `INTERNAL_ERROR` | Server error |

---

## Multi-Instance Architecture

### Redis Pub/Sub

For horizontal scaling, WebSocket messages are broadcast via Redis:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   API Instance  │     │   API Instance  │     │   API Instance  │
│       #1        │     │       #2        │     │       #3        │
│   (WebSocket)   │     │   (WebSocket)   │     │   (WebSocket)   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                      ┌──────────▼──────────┐
                      │       Redis         │
                      │  Channel: glassbox  │
                      └─────────────────────┘
```

### Redis Channel

All WebSocket messages are published to: `glassbox:ws`

Message format in Redis:
```json
{
  "channel": "project:uuid",
  "excludeClientId": "client-123",
  "message": {
    "type": "node_updated",
    "payload": {...}
  }
}
```

---

## Connection Lifecycle

### Connection States

```
CONNECTING → CONNECTED → AUTHENTICATED → SUBSCRIBED ⇄ ACTIVE
                              │                           │
                              └───────── DISCONNECTED ◄───┘
```

### Keepalive

- Client should send `ping` every 30 seconds
- Server closes connection after 60 seconds of inactivity
- Automatic reconnection recommended on client side

### Graceful Disconnect

When disconnecting, client should:
1. Unsubscribe from all channels
2. Release any held locks
3. Send `presence` with `action: "left"` for viewed nodes
4. Close WebSocket connection

---

## Implementation Details

### Server-Side (Go)

**Location:** `apps/api/internal/websocket/`

| File | Purpose |
|------|---------|
| `hub.go` | Central hub for connection management |
| `client.go` | Individual client handling |
| `handler.go` | HTTP upgrade handler |
| `messages.go` | Message type definitions |
| `broadcaster.go` | Broadcast utilities |

### Hub Architecture

```go
type Hub struct {
    clients    map[*Client]bool
    channels   map[string]map[*Client]bool
    register   chan *Client
    unregister chan *Client
    broadcast  chan BroadcastMessage
    redis      *redis.Client
}
```

### Client Structure

```go
type Client struct {
    hub           *Hub
    conn          *websocket.Conn
    send          chan []byte
    userID        string
    userEmail     string
    subscriptions map[string]bool
}
```

---

## Example: Full Session

```javascript
// 1. Connect
const ws = new WebSocket(`wss://api.glassbox.io/ws?token=${wsToken}`);

// 2. Subscribe to project
ws.send(JSON.stringify({
  type: 'subscribe',
  payload: { channel: 'project:abc123' },
  requestId: '1'
}));

// 3. Update presence on a node
ws.send(JSON.stringify({
  type: 'presence',
  payload: { nodeId: 'node-xyz', action: 'editing' }
}));

// 4. Acquire lock before editing
ws.send(JSON.stringify({
  type: 'lock_acquire',
  payload: { nodeId: 'node-xyz' },
  requestId: '2'
}));

// 5. Listen for updates
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch (msg.type) {
    case 'node_updated':
      handleNodeUpdate(msg.payload);
      break;
    case 'presence_update':
      handlePresence(msg.payload);
      break;
    case 'execution_update':
      handleExecution(msg.payload);
      break;
  }
};

// 6. Release lock when done
ws.send(JSON.stringify({
  type: 'lock_release',
  payload: { nodeId: 'node-xyz' }
}));

// 7. Disconnect gracefully
ws.close();
```

---

## Testing WebSocket

### Using websocat

```bash
# Install: brew install websocat (macOS)

# Connect
websocat "ws://localhost:8080/ws?token=$WS_TOKEN"

# Send messages (type JSON and press Enter)
{"type":"ping","requestId":"1"}
{"type":"subscribe","payload":{"channel":"project:abc123"},"requestId":"2"}
```

### Using curl (token generation only)

```bash
# Get WS token
curl -X POST http://localhost:8080/api/v1/auth/ws-token \
  -H "Authorization: Bearer $JWT"
```
