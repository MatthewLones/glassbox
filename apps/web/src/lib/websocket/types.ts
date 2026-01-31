import type {
  UUID,
  Node,
  AgentExecutionStatus,
  ExecutionProgress,
  PresenceAction,
} from '@glassbox/shared-types';

// Connection states
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

// Client to server messages
export interface SubscribeMessage {
  type: 'subscribe';
  payload: { channel: string };
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  payload: { channel: string };
}

export interface PresenceMessage {
  type: 'presence';
  payload: {
    nodeId: UUID;
    action: PresenceAction;
  };
}

export interface LockAcquireMessage {
  type: 'lock_acquire';
  payload: { nodeId: UUID };
  requestId: string;
}

export interface LockReleaseMessage {
  type: 'lock_release';
  payload: { nodeId: UUID };
}

export interface PingMessage {
  type: 'ping';
}

export type WSClientMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | PresenceMessage
  | LockAcquireMessage
  | LockReleaseMessage
  | PingMessage;

// Server to client messages
export interface SubscribedMessage {
  type: 'subscribed';
  payload: {
    channel: string;
    users?: PresenceUser[];
  };
}

export interface UnsubscribedMessage {
  type: 'unsubscribed';
  payload: { channel: string };
}

export interface NodeCreatedMessage {
  type: 'node_created';
  payload: { node: Node };
}

export interface NodeUpdatedMessage {
  type: 'node_updated';
  payload: {
    nodeId: UUID;
    changes: Partial<Node>;
    version: number;
  };
}

export interface NodeDeletedMessage {
  type: 'node_deleted';
  payload: { nodeId: UUID };
}

export interface PresenceUpdateMessage {
  type: 'presence_update';
  payload: {
    nodeId: UUID;
    users: PresenceUser[];
  };
}

export interface LockAcquiredMessage {
  type: 'lock_acquired';
  payload: {
    nodeId: UUID;
    lockedBy: UUID;
    userEmail?: string;
    expiresAt?: string;
  };
  requestId?: string;
}

export interface LockReleasedMessage {
  type: 'lock_released';
  payload: { nodeId: UUID };
}

export interface ExecutionUpdateMessage {
  type: 'execution_update';
  payload: {
    nodeId: UUID;
    status: AgentExecutionStatus;
    progress?: ExecutionProgress;
  };
}

export interface ErrorMessage {
  type: 'error';
  payload: {
    code: string;
    message: string;
  };
  requestId?: string;
}

export interface PongMessage {
  type: 'pong';
}

// Notification types
export type NotificationType =
  | 'node_created'
  | 'node_updated'
  | 'node_deleted'
  | 'execution_started'
  | 'execution_completed'
  | 'execution_failed'
  | 'hitl_request'
  | 'mention'
  | 'comment';

export interface NotificationMessage {
  type: 'notification';
  payload: {
    id: string;
    notificationType: NotificationType;
    title: string;
    message: string;
    projectId?: string;
    nodeId?: string;
    userId?: string;
    createdAt: string;
    read: boolean;
  };
}

export type WSServerMessage =
  | SubscribedMessage
  | UnsubscribedMessage
  | NodeCreatedMessage
  | NodeUpdatedMessage
  | NodeDeletedMessage
  | PresenceUpdateMessage
  | LockAcquiredMessage
  | LockReleasedMessage
  | ExecutionUpdateMessage
  | NotificationMessage
  | ErrorMessage
  | PongMessage;

// Presence types
export interface PresenceUser {
  userId: UUID;
  email: string;
  name?: string;
  avatarUrl?: string;
  action: PresenceAction;
  lastSeen: string;
}

// Event handlers
export type MessageHandler<T extends WSServerMessage = WSServerMessage> = (
  message: T
) => void;

export type ConnectionStateHandler = (state: ConnectionState) => void;

// Client options
export interface WebSocketClientOptions {
  url: string;
  token: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  debug?: boolean;
}

// Channel helpers
export type ChannelType = 'project' | 'node';

export function createChannel(type: ChannelType, id: UUID): string {
  return `${type}:${id}`;
}

export function parseChannel(channel: string): { type: ChannelType; id: UUID } | null {
  const [type, id] = channel.split(':');
  if ((type === 'project' || type === 'node') && id) {
    return { type: type as ChannelType, id };
  }
  return null;
}
