# GlassBox V2 Frontend WebSocket Integration

This document covers the WebSocket client implementation, real-time features, message protocols, and React integration for collaborative features.

---

## Overview

GlassBox uses WebSocket for real-time collaboration features:

| Feature | Description |
|---------|-------------|
| **Presence** | See who's viewing/editing nodes in real-time |
| **Node Locking** | Prevent concurrent editing conflicts |
| **Live Updates** | Instant node create/update/delete notifications |
| **Execution Progress** | Real-time agent execution status |
| **Notifications** | Push notifications from server |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    React Components                       │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐ │  │
│  │  │ Canvas  │  │  Tree   │  │ Presence│  │   Locks     │ │  │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬──────┘ │  │
│  └───────┼────────────┼────────────┼──────────────┼─────────┘  │
│          │            │            │              │             │
│  ┌───────▼────────────▼────────────▼──────────────▼─────────┐  │
│  │                  WebSocket Hooks                          │  │
│  │  useProjectSubscription  useNodePresence  useLock         │  │
│  └────────────────────────────┬─────────────────────────────┘  │
│                               │                                 │
│  ┌────────────────────────────▼─────────────────────────────┐  │
│  │                  WebSocketContext                         │  │
│  │  • Connection state                                       │  │
│  │  • Message routing                                        │  │
│  │  • Reconnection logic                                     │  │
│  └────────────────────────────┬─────────────────────────────┘  │
│                               │                                 │
│  ┌────────────────────────────▼─────────────────────────────┐  │
│  │                  WebSocketClient                          │  │
│  │  • Native WebSocket wrapper                               │  │
│  │  • JSON message encoding                                  │  │
│  │  • Ping/pong keepalive                                    │  │
│  │  • Message queue for reconnection                         │  │
│  └────────────────────────────┬─────────────────────────────┘  │
└───────────────────────────────┼─────────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────┐
│                     WebSocket Server                               │
│                         (Go)                                       │
│  wss://api.glassbox.com/ws?token={wsToken}                        │
└───────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
apps/web/src/lib/websocket/
├── ws-client.ts          # Low-level WebSocket client
├── ws-context.tsx        # React context provider
├── hooks.ts              # React hooks for subscriptions
├── types.ts              # Message type definitions
└── index.ts              # Public exports
```

---

## WebSocket Client

**Location:** `apps/web/src/lib/websocket/ws-client.ts`

### Connection Management

```typescript
class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Starts at 1s, doubles each attempt
  private messageQueue: QueuedMessage[] = [];
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(private url: string, private token: string) {}

  connect(): void {
    const wsUrl = `${this.url}?token=${this.token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.flushMessageQueue();
      this.startPingInterval();
      this.emit('connected');
    };

    this.ws.onclose = (event) => {
      this.stopPingInterval();
      if (!event.wasClean) {
        this.attemptReconnect();
      }
      this.emit('disconnected', { code: event.code, reason: event.reason });
    };

    this.ws.onerror = (error) => {
      this.emit('error', error);
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
  }
}
```

### Reconnection with Exponential Backoff

```
┌─────────────────────────────────────────────────────────────────┐
│                    Reconnection Strategy                         │
│                                                                  │
│  Attempt 1: Wait 1 second, then reconnect                       │
│  Attempt 2: Wait 2 seconds, then reconnect                      │
│  Attempt 3: Wait 4 seconds, then reconnect                      │
│  Attempt 4: Wait 8 seconds, then reconnect                      │
│  Attempt 5: Wait 16 seconds, then reconnect                     │
│                                                                  │
│  After 5 failures: Give up, show connection error               │
│                                                                  │
│  On successful reconnect:                                        │
│  1. Reset attempt counter                                        │
│  2. Flush queued messages                                        │
│  3. Re-subscribe to channels                                     │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
private attemptReconnect(): void {
  if (this.reconnectAttempts >= this.maxReconnectAttempts) {
    this.emit('reconnect_failed');
    return;
  }

  const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
  this.reconnectAttempts++;

  setTimeout(() => {
    this.emit('reconnecting', { attempt: this.reconnectAttempts });
    this.connect();
  }, delay);
}
```

### Ping/Pong Keepalive

```typescript
private startPingInterval(): void {
  this.pingInterval = setInterval(() => {
    this.send({ type: 'ping' });
  }, 30000); // Every 30 seconds
}

private handleMessage(message: ServerMessage): void {
  if (message.type === 'pong') {
    // Server is alive, reset any timeout timers
    return;
  }
  // Handle other messages...
}
```

### Message Queueing

Messages sent while disconnected are queued and sent on reconnection:

```typescript
send(message: ClientMessage): void {
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify(message));
  } else {
    this.messageQueue.push({
      message,
      timestamp: Date.now(),
    });
  }
}

private flushMessageQueue(): void {
  while (this.messageQueue.length > 0) {
    const queued = this.messageQueue.shift()!;
    // Only send messages less than 30 seconds old
    if (Date.now() - queued.timestamp < 30000) {
      this.send(queued.message);
    }
  }
}
```

---

## Message Types

**Location:** `apps/web/src/lib/websocket/types.ts`

### Client → Server Messages

| Type | Description | Payload |
|------|-------------|---------|
| `subscribe` | Subscribe to a channel | `{ channel: string }` |
| `unsubscribe` | Unsubscribe from channel | `{ channel: string }` |
| `presence` | Update presence state | `{ nodeId, action, userId }` |
| `lock_acquire` | Request edit lock | `{ nodeId }` |
| `lock_release` | Release edit lock | `{ nodeId }` |
| `ping` | Keepalive ping | `{}` |

#### Subscribe

```typescript
{
  type: 'subscribe',
  payload: {
    channel: 'project:abc123'
  }
}
```

#### Presence Update

```typescript
{
  type: 'presence',
  payload: {
    nodeId: 'node-xyz',
    action: 'editing',  // 'viewing' | 'editing' | 'idle'
    userId: 'user-123'
  }
}
```

#### Lock Acquire

```typescript
{
  type: 'lock_acquire',
  payload: {
    nodeId: 'node-xyz'
  }
}
```

### Server → Client Messages

| Type | Description | Payload |
|------|-------------|---------|
| `subscribed` | Subscription confirmed | `{ channel }` |
| `node_created` | New node in project | `{ node: Node }` |
| `node_updated` | Node was modified | `{ nodeId, changes }` |
| `node_deleted` | Node was removed | `{ nodeId }` |
| `presence_update` | User presence changed | `{ nodeId, users[] }` |
| `lock_acquired` | Lock granted | `{ nodeId, userId, userName }` |
| `lock_released` | Lock freed | `{ nodeId }` |
| `lock_denied` | Lock request rejected | `{ nodeId, heldBy }` |
| `execution_update` | Execution progress | `{ nodeId, status, progress }` |
| `hitl_request` | HITL input needed | `{ executionId, prompt, options }` |
| `notification` | Push notification | `{ notification }` |
| `error` | Error occurred | `{ code, message }` |
| `pong` | Keepalive response | `{}` |

#### Node Created

```typescript
{
  type: 'node_created',
  payload: {
    node: {
      id: 'node-new',
      title: 'New Analysis',
      projectId: 'project-abc',
      // ... full node object
    }
  }
}
```

#### Presence Update

```typescript
{
  type: 'presence_update',
  payload: {
    nodeId: 'node-xyz',
    users: [
      { userId: 'user-1', name: 'Alice', action: 'viewing', avatarUrl: '...' },
      { userId: 'user-2', name: 'Bob', action: 'editing', avatarUrl: '...' }
    ]
  }
}
```

#### Lock Acquired

```typescript
{
  type: 'lock_acquired',
  payload: {
    nodeId: 'node-xyz',
    userId: 'user-123',
    userName: 'Alice',
    expiresAt: '2024-01-20T12:30:00Z'
  }
}
```

#### Execution Update

```typescript
{
  type: 'execution_update',
  payload: {
    nodeId: 'node-xyz',
    executionId: 'exec-abc',
    status: 'running',
    progress: {
      percentage: 45,
      currentStep: 'Analyzing data',
      stepsCompleted: 2,
      totalSteps: 5
    }
  }
}
```

#### HITL Request

```typescript
{
  type: 'hitl_request',
  payload: {
    executionId: 'exec-abc',
    nodeId: 'node-xyz',
    requestId: 'hitl-123',
    type: 'approval',
    prompt: 'The agent wants to send an email. Approve?',
    options: ['Approve', 'Deny', 'Modify'],
    context: {
      action: 'send_email',
      recipient: 'team@company.com'
    }
  }
}
```

---

## Channel System

### Channel Types

| Pattern | Description | Example |
|---------|-------------|---------|
| `project:{id}` | All events in a project | `project:abc123` |
| `node:{id}` | Events for specific node | `node:xyz789` |
| `user:{id}` | Personal notifications | `user:user123` |

### Subscription Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Channel Subscription                          │
│                                                                  │
│  1. Component mounts, needs project updates                     │
│     useProjectSubscription('project-abc')                       │
│                                                                  │
│  2. Hook sends subscribe message                                │
│     → { type: 'subscribe', payload: { channel: 'project:abc' }} │
│                                                                  │
│  3. Server confirms subscription                                │
│     ← { type: 'subscribed', payload: { channel: 'project:abc' }}│
│                                                                  │
│  4. Server sends relevant updates                               │
│     ← { type: 'node_created', payload: { node: {...} } }        │
│                                                                  │
│  5. Component unmounts, hook unsubscribes                       │
│     → { type: 'unsubscribe', payload: { channel: 'project:abc' }│
└─────────────────────────────────────────────────────────────────┘
```

---

## React Context

**Location:** `apps/web/src/lib/websocket/ws-context.tsx`

### WebSocketProvider

```typescript
interface WebSocketContextValue {
  client: WebSocketClient | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;

  // Channel management
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;

  // Message handlers
  on: (type: string, handler: MessageHandler) => () => void;

  // Presence
  updatePresence: (nodeId: string, action: PresenceAction) => void;

  // Locks
  acquireLock: (nodeId: string) => Promise<boolean>;
  releaseLock: (nodeId: string) => void;
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, getWsToken } = useAuth();
  const [client, setClient] = useState<WebSocketClient | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
  });

  useEffect(() => {
    // Only connect when authenticated
    if (!isAuthenticated) {
      return;
    }

    const initConnection = async () => {
      setConnectionState({ isConnected: false, isConnecting: true, error: null });

      try {
        const token = await getWsToken();
        if (!token) throw new Error('Failed to get WebSocket token');

        const wsUrl = process.env.NEXT_PUBLIC_WS_URL ||
          process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws') + '/ws';

        const wsClient = new WebSocketClient(wsUrl, token);

        wsClient.on('connected', () => {
          setConnectionState({ isConnected: true, isConnecting: false, error: null });
        });

        wsClient.on('disconnected', () => {
          setConnectionState({ isConnected: false, isConnecting: false, error: null });
        });

        wsClient.on('error', (error) => {
          setConnectionState({ isConnected: false, isConnecting: false, error });
        });

        wsClient.connect();
        setClient(wsClient);
      } catch (error) {
        setConnectionState({
          isConnected: false,
          isConnecting: false,
          error: error as Error,
        });
      }
    };

    initConnection();

    return () => {
      client?.disconnect();
    };
  }, [isAuthenticated]);

  return (
    <WebSocketContext.Provider value={{ client, ...connectionState, /* methods */ }}>
      {children}
    </WebSocketContext.Provider>
  );
}
```

### Conditional Connection

The WebSocket only connects when the user is authenticated:

```tsx
// In app/providers.tsx
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebSocketProvider>
          {children}
        </WebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

---

## React Hooks

**Location:** `apps/web/src/lib/websocket/hooks.ts`

### useWebSocket

Access the WebSocket context directly.

```typescript
function useWebSocket(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
}
```

### useProjectSubscription

Subscribe to project-level events.

```typescript
function useProjectSubscription(
  projectId: string | null,
  handlers: {
    onNodeCreated?: (node: Node) => void;
    onNodeUpdated?: (nodeId: string, changes: Partial<Node>) => void;
    onNodeDeleted?: (nodeId: string) => void;
    onPresenceUpdate?: (nodeId: string, users: PresenceInfo[]) => void;
  }
): void {
  const { subscribe, unsubscribe, on } = useWebSocket();

  useEffect(() => {
    if (!projectId) return;

    const channel = `project:${projectId}`;
    subscribe(channel);

    const cleanups = [
      on('node_created', (msg) => handlers.onNodeCreated?.(msg.payload.node)),
      on('node_updated', (msg) => handlers.onNodeUpdated?.(msg.payload.nodeId, msg.payload.changes)),
      on('node_deleted', (msg) => handlers.onNodeDeleted?.(msg.payload.nodeId)),
      on('presence_update', (msg) => handlers.onPresenceUpdate?.(msg.payload.nodeId, msg.payload.users)),
    ];

    return () => {
      unsubscribe(channel);
      cleanups.forEach(cleanup => cleanup());
    };
  }, [projectId, handlers]);
}
```

### useNodePresence

Track and update presence for a specific node.

```typescript
function useNodePresence(nodeId: string | null): {
  viewers: PresenceInfo[];
  editors: PresenceInfo[];
  setAction: (action: PresenceAction) => void;
} {
  const { updatePresence, on } = useWebSocket();
  const [presence, setPresence] = useState<PresenceInfo[]>([]);

  useEffect(() => {
    if (!nodeId) return;

    // Listen for presence updates for this node
    return on('presence_update', (msg) => {
      if (msg.payload.nodeId === nodeId) {
        setPresence(msg.payload.users);
      }
    });
  }, [nodeId]);

  const setAction = useCallback((action: PresenceAction) => {
    if (nodeId) {
      updatePresence(nodeId, action);
    }
  }, [nodeId, updatePresence]);

  return {
    viewers: presence.filter(p => p.action === 'viewing'),
    editors: presence.filter(p => p.action === 'editing'),
    setAction,
  };
}
```

### useNodeLock

Acquire and release edit locks.

```typescript
function useNodeLock(nodeId: string): {
  isLocked: boolean;
  isLockedByMe: boolean;
  lockHolder: { userId: string; userName: string } | null;
  acquireLock: () => Promise<boolean>;
  releaseLock: () => void;
} {
  const { acquireLock: wsAcquire, releaseLock: wsRelease, on } = useWebSocket();
  const { user } = useAuth();
  const [lockState, setLockState] = useState<LockState>({
    isLocked: false,
    lockHolder: null,
  });

  useEffect(() => {
    const cleanups = [
      on('lock_acquired', (msg) => {
        if (msg.payload.nodeId === nodeId) {
          setLockState({
            isLocked: true,
            lockHolder: {
              userId: msg.payload.userId,
              userName: msg.payload.userName,
            },
          });
        }
      }),
      on('lock_released', (msg) => {
        if (msg.payload.nodeId === nodeId) {
          setLockState({ isLocked: false, lockHolder: null });
        }
      }),
      on('lock_denied', (msg) => {
        if (msg.payload.nodeId === nodeId) {
          toast.error(`Node locked by ${msg.payload.heldBy}`);
        }
      }),
    ];

    return () => cleanups.forEach(c => c());
  }, [nodeId]);

  return {
    isLocked: lockState.isLocked,
    isLockedByMe: lockState.lockHolder?.userId === user?.id,
    lockHolder: lockState.lockHolder,
    acquireLock: () => wsAcquire(nodeId),
    releaseLock: () => wsRelease(nodeId),
  };
}
```

### useConnectionStatus

Get current connection state.

```typescript
function useConnectionStatus(): {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
} {
  const { isConnected, isConnecting, error } = useWebSocket();
  return { isConnected, isConnecting, error };
}
```

---

## Presence System

### How Presence Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     Presence Flow                                │
│                                                                  │
│  User A opens node detail panel                                  │
│  ├─ useNodePresence('node-123') called                          │
│  ├─ Sends: { type: 'presence', nodeId: 'node-123', action: 'viewing' }
│  └─ Server broadcasts to project channel                        │
│                                                                  │
│  User B receives presence update                                │
│  ├─ { type: 'presence_update', nodeId: 'node-123', users: [...] }
│  └─ PresenceAvatars component shows User A's avatar             │
│                                                                  │
│  User A starts editing                                          │
│  ├─ setAction('editing')                                        │
│  └─ User B sees avatar change to editing indicator              │
│                                                                  │
│  User A closes panel                                            │
│  ├─ useEffect cleanup: setAction('idle')                        │
│  └─ User B no longer sees User A on node                        │
└─────────────────────────────────────────────────────────────────┘
```

### Presence Actions

| Action | Meaning | Visual |
|--------|---------|--------|
| `viewing` | User has node selected | Gray ring avatar |
| `editing` | User is actively editing | Green ring avatar |
| `idle` | User left the node | Removed from list |

### UI Components

```tsx
// apps/web/src/components/presence/presence-avatars.tsx
function PresenceAvatars({ nodeId }: { nodeId: string }) {
  const { viewers, editors } = useNodePresence(nodeId);
  const allUsers = [...editors, ...viewers];

  return (
    <div className="flex -space-x-2">
      {allUsers.slice(0, 4).map(user => (
        <Avatar
          key={user.userId}
          src={user.avatarUrl}
          className={cn(
            'ring-2',
            user.action === 'editing' ? 'ring-green-500' : 'ring-gray-300'
          )}
        />
      ))}
      {allUsers.length > 4 && (
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200">
          +{allUsers.length - 4}
        </span>
      )}
    </div>
  );
}
```

---

## Lock System

### Lock Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Lock Acquisition Flow                         │
│                                                                  │
│  1. User clicks "Edit" button                                   │
│     └─ acquireLock('node-123') called                           │
│                                                                  │
│  2. Client sends lock request                                   │
│     → { type: 'lock_acquire', payload: { nodeId: 'node-123' } } │
│                                                                  │
│  3a. Lock granted (node was unlocked)                           │
│      ← { type: 'lock_acquired', payload: { nodeId, userId, userName } }
│      └─ UI enables editing, shows lock indicator                │
│                                                                  │
│  3b. Lock denied (someone else has it)                          │
│      ← { type: 'lock_denied', payload: { nodeId, heldBy } }     │
│      └─ Show toast: "Locked by {heldBy}"                        │
│                                                                  │
│  4. User finishes editing, clicks "Save"                        │
│     └─ releaseLock('node-123') called                           │
│                                                                  │
│  5. Client sends release                                        │
│     → { type: 'lock_release', payload: { nodeId: 'node-123' } } │
│                                                                  │
│  6. Server broadcasts release                                   │
│     ← { type: 'lock_released', payload: { nodeId } }            │
│     └─ Other users can now acquire lock                         │
└─────────────────────────────────────────────────────────────────┘
```

### Lock Expiration

Locks automatically expire after a configured duration (default: 5 minutes) to prevent orphaned locks if a user closes their browser.

```typescript
// Server sends lock with expiration
{
  type: 'lock_acquired',
  payload: {
    nodeId: 'node-123',
    userId: 'user-abc',
    userName: 'Alice',
    expiresAt: '2024-01-20T12:35:00Z'  // 5 minutes from now
  }
}
```

### Lock UI Component

```tsx
// apps/web/src/components/lock/lock-indicator.tsx
function LockIndicator({ nodeId }: { nodeId: string }) {
  const { isLocked, isLockedByMe, lockHolder } = useNodeLock(nodeId);

  if (!isLocked) return null;

  if (isLockedByMe) {
    return (
      <Badge variant="outline" className="text-green-600">
        <Lock className="w-3 h-3 mr-1" />
        Editing
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      <Lock className="w-3 h-3 mr-1" />
      Locked by {lockHolder?.userName}
    </Badge>
  );
}
```

---

## Connection States

```
┌─────────────────────────────────────────────────────────────────┐
│                    Connection State Diagram                      │
│                                                                  │
│                    ┌──────────────┐                             │
│                    │ Disconnected │                             │
│                    └──────┬───────┘                             │
│                           │                                      │
│                    isAuthenticated                               │
│                           │                                      │
│                           ▼                                      │
│                    ┌──────────────┐                             │
│                    │  Connecting  │◀──────────────────┐         │
│                    └──────┬───────┘                   │         │
│                           │                            │         │
│                    WebSocket.onopen                    │         │
│                           │                            │         │
│                           ▼                            │         │
│                    ┌──────────────┐                   │         │
│                    │  Connected   │                   │         │
│                    └──────┬───────┘                   │         │
│                           │                            │         │
│                    WebSocket.onclose                   │         │
│                           │                            │         │
│                           ▼                            │         │
│                    ┌──────────────┐                   │         │
│                    │ Reconnecting │───────────────────┘         │
│                    └──────┬───────┘                             │
│                           │                                      │
│                    attempts >= 5                                 │
│                           │                                      │
│                           ▼                                      │
│                    ┌──────────────┐                             │
│                    │    Failed    │                             │
│                    └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

### Connection Status UI

```tsx
// apps/web/src/components/connection-status.tsx
function ConnectionStatus() {
  const { isConnected, isConnecting, error } = useConnectionStatus();

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-500">
        <WifiOff className="w-4 h-4" />
        <span>Connection failed</span>
        <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="flex items-center gap-2 text-yellow-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Connecting...</span>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 text-green-500">
        <Wifi className="w-4 h-4" />
        <span>Connected</span>
      </div>
    );
  }

  return null;
}
```

---

## Backend Integration

### Required Backend Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/auth/ws-token` | POST | Get WebSocket auth token |
| `/ws` | WebSocket | WebSocket connection endpoint |

### WebSocket Server Requirements

The backend WebSocket server should:

1. **Authenticate connections** via query parameter token
2. **Manage channel subscriptions** per connection
3. **Broadcast to channels** for relevant events
4. **Handle presence tracking** with timeout for stale entries
5. **Manage locks** with expiration
6. **Send execution updates** for running agents

### Message Handling Pseudocode

```go
func handleMessage(conn *Connection, msg Message) {
    switch msg.Type {
    case "subscribe":
        channel := msg.Payload.Channel
        conn.Subscribe(channel)
        conn.Send(Message{Type: "subscribed", Payload: map[string]string{"channel": channel}})

    case "presence":
        nodeId := msg.Payload.NodeId
        action := msg.Payload.Action
        updatePresence(conn.UserId, nodeId, action)
        broadcastToProject(nodeId, Message{
            Type: "presence_update",
            Payload: map[string]interface{}{
                "nodeId": nodeId,
                "users":  getPresenceForNode(nodeId),
            },
        })

    case "lock_acquire":
        nodeId := msg.Payload.NodeId
        if acquireLock(nodeId, conn.UserId) {
            broadcastToProject(nodeId, Message{
                Type: "lock_acquired",
                Payload: map[string]interface{}{
                    "nodeId":   nodeId,
                    "userId":   conn.UserId,
                    "userName": conn.UserName,
                },
            })
        } else {
            holder := getLockHolder(nodeId)
            conn.Send(Message{
                Type: "lock_denied",
                Payload: map[string]interface{}{
                    "nodeId": nodeId,
                    "heldBy": holder.UserName,
                },
            })
        }
    }
}
```

---

## Testing WebSocket

### Manual Testing

1. Open the app in two browser windows
2. Log in as different users
3. Navigate to the same project
4. Select the same node in both windows
5. Verify:
   - Each user sees the other's avatar in presence
   - Editing in one shows "editing" indicator to other
   - Lock acquisition blocks the other user

### Automated Testing

```typescript
// Mock WebSocket for tests
class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: Error) => void) | null = null;

  constructor(url: string) {
    setTimeout(() => this.onopen?.(), 0);
  }

  send(data: string) {
    // Record sent messages for assertions
  }

  close() {
    this.onclose?.();
  }

  // Test helper: simulate receiving a message
  simulateMessage(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

// In test setup
global.WebSocket = MockWebSocket as any;
```

---

## Best Practices

### 1. Clean Up Subscriptions

```typescript
useEffect(() => {
  subscribe(channel);
  return () => unsubscribe(channel);
}, [channel]);
```

### 2. Handle Reconnection

```typescript
// Re-subscribe after reconnection
useEffect(() => {
  if (isConnected && previouslyConnected) {
    // Re-subscribe to channels
    channels.forEach(subscribe);
    // Re-establish presence
    if (currentNodeId) {
      updatePresence(currentNodeId, currentAction);
    }
  }
}, [isConnected]);
```

### 3. Debounce Presence Updates

```typescript
const debouncedPresence = useDebouncedCallback(
  (nodeId: string, action: PresenceAction) => {
    updatePresence(nodeId, action);
  },
  100
);
```

### 4. Show Connection Status

Always show users the connection state so they understand why real-time features might not be working:

```tsx
<Header>
  <ConnectionStatus />
  {/* ... */}
</Header>
```

