'use client';

import * as React from 'react';
import { WebSocketClient, createWebSocketClient } from './ws-client';
import type {
  ConnectionState,
  WSServerMessage,
  PresenceUser,
  PresenceUpdateMessage,
  LockAcquiredMessage,
  LockReleasedMessage,
  SubscribedMessage,
} from './types';
import { createChannel } from './types';

interface WebSocketContextValue {
  // Connection
  client: WebSocketClient | null;
  state: ConnectionState;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;

  // Subscriptions
  subscribeToProject: (projectId: string) => void;
  unsubscribeFromProject: (projectId: string) => void;
  subscribeToNode: (nodeId: string) => void;
  unsubscribeFromNode: (nodeId: string) => void;

  // Presence
  updatePresence: (nodeId: string, action: 'viewing' | 'editing' | 'idle') => void;
  getPresence: (nodeId: string) => PresenceUser[];

  // Locks
  requestLock: (nodeId: string) => Promise<boolean>;
  releaseLock: (nodeId: string) => void;
  isLocked: (nodeId: string) => boolean;
  getLockHolder: (nodeId: string) => string | null;

  // Message handling
  onMessage: <T extends WSServerMessage>(
    type: T['type'],
    handler: (message: T) => void
  ) => () => void;
}

const WebSocketContext = React.createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
  apiBaseUrl: string;
  autoConnect?: boolean;
  debug?: boolean;
}

export function WebSocketProvider({
  children,
  apiBaseUrl,
  autoConnect = true,
  debug = false,
}: WebSocketProviderProps) {
  const [client, setClient] = React.useState<WebSocketClient | null>(null);
  const [state, setState] = React.useState<ConnectionState>('disconnected');
  const [presence, setPresence] = React.useState<Map<string, PresenceUser[]>>(new Map());
  const [locks, setLocks] = React.useState<Map<string, string>>(new Map()); // nodeId -> userId

  // Track subscriptions for cleanup
  const projectSubscriptions = React.useRef<Set<string>>(new Set());
  const nodeSubscriptions = React.useRef<Set<string>>(new Set());

  // Connect to WebSocket
  const connect = React.useCallback(async () => {
    if (client && (state === 'connected' || state === 'connecting')) {
      return;
    }

    try {
      const newClient = await createWebSocketClient(apiBaseUrl, {
        reconnect: true,
        debug,
      });

      // Set up state change handler
      newClient.onStateChange((newState) => {
        setState(newState);
      });

      // Set up message handlers with properly typed callbacks
      newClient.on<PresenceUpdateMessage>('presence_update', (message) => {
        setPresence((prev) => {
          const next = new Map(prev);
          next.set(message.payload.nodeId, message.payload.users);
          return next;
        });
      });

      newClient.on<LockAcquiredMessage>('lock_acquired', (message) => {
        setLocks((prev) => {
          const next = new Map(prev);
          next.set(message.payload.nodeId, message.payload.lockedBy);
          return next;
        });
      });

      newClient.on<LockReleasedMessage>('lock_released', (message) => {
        setLocks((prev) => {
          const next = new Map(prev);
          next.delete(message.payload.nodeId);
          return next;
        });
      });

      // Set up subscribed handler to get initial presence
      newClient.on<SubscribedMessage>('subscribed', (message) => {
        if (message.payload.users) {
          const channelId = message.payload.channel.split(':')[1];
          setPresence((prev) => {
            const next = new Map(prev);
            next.set(channelId, message.payload.users!);
            return next;
          });
        }
      });

      setClient(newClient);
      newClient.connect();
    } catch (error) {
      console.error('Failed to create WebSocket client:', error);
      setState('error');
    }
  }, [apiBaseUrl, client, state, debug]);

  // Disconnect from WebSocket
  const disconnect = React.useCallback(() => {
    if (client) {
      client.disconnect();
      setClient(null);
    }
    projectSubscriptions.current.clear();
    nodeSubscriptions.current.clear();
    setPresence(new Map());
    setLocks(new Map());
  }, [client]);

  // Auto-connect on mount
  React.useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscription methods
  const subscribeToProject = React.useCallback(
    (projectId: string) => {
      if (client && !projectSubscriptions.current.has(projectId)) {
        projectSubscriptions.current.add(projectId);
        client.subscribe(createChannel('project', projectId));
      }
    },
    [client]
  );

  const unsubscribeFromProject = React.useCallback(
    (projectId: string) => {
      if (client && projectSubscriptions.current.has(projectId)) {
        projectSubscriptions.current.delete(projectId);
        client.unsubscribe(createChannel('project', projectId));
      }
    },
    [client]
  );

  const subscribeToNode = React.useCallback(
    (nodeId: string) => {
      if (client && !nodeSubscriptions.current.has(nodeId)) {
        nodeSubscriptions.current.add(nodeId);
        client.subscribe(createChannel('node', nodeId));
      }
    },
    [client]
  );

  const unsubscribeFromNode = React.useCallback(
    (nodeId: string) => {
      if (client && nodeSubscriptions.current.has(nodeId)) {
        nodeSubscriptions.current.delete(nodeId);
        client.unsubscribe(createChannel('node', nodeId));
      }
    },
    [client]
  );

  // Presence methods
  const updatePresence = React.useCallback(
    (nodeId: string, action: 'viewing' | 'editing' | 'idle') => {
      client?.updatePresence(nodeId, action);
    },
    [client]
  );

  const getPresence = React.useCallback(
    (nodeId: string): PresenceUser[] => {
      return presence.get(nodeId) || [];
    },
    [presence]
  );

  // Lock methods
  const requestLock = React.useCallback(
    async (nodeId: string): Promise<boolean> => {
      if (!client) return false;
      try {
        await client.requestLock(nodeId);
        return true;
      } catch {
        return false;
      }
    },
    [client]
  );

  const releaseLock = React.useCallback(
    (nodeId: string) => {
      client?.releaseLock(nodeId);
    },
    [client]
  );

  const isLocked = React.useCallback(
    (nodeId: string): boolean => {
      return locks.has(nodeId);
    },
    [locks]
  );

  const getLockHolder = React.useCallback(
    (nodeId: string): string | null => {
      return locks.get(nodeId) || null;
    },
    [locks]
  );

  // Message handling
  const onMessage = React.useCallback(
    <T extends WSServerMessage>(
      type: T['type'],
      handler: (message: T) => void
    ): (() => void) => {
      if (!client) {
        return () => {};
      }
      return client.on(type, handler as (message: WSServerMessage) => void);
    },
    [client]
  );

  const value: WebSocketContextValue = {
    client,
    state,
    isConnected: state === 'connected',
    connect,
    disconnect,
    subscribeToProject,
    unsubscribeFromProject,
    subscribeToNode,
    unsubscribeFromNode,
    updatePresence,
    getPresence,
    requestLock,
    releaseLock,
    isLocked,
    getLockHolder,
    onMessage,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextValue {
  const context = React.useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
