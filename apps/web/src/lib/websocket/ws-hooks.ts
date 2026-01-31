'use client';

import * as React from 'react';
import { useWebSocket } from './ws-context';
import type {
  PresenceUser,
  NodeCreatedMessage,
  NodeUpdatedMessage,
  NodeDeletedMessage,
  ExecutionUpdateMessage,
} from './types';
import type { Node, AgentExecutionStatus, ExecutionProgress } from '@glassbox/shared-types';

/**
 * Hook to subscribe to a project and receive real-time updates
 */
export function useProjectSubscription(
  projectId: string | undefined,
  options?: {
    onNodeCreated?: (node: Node) => void;
    onNodeUpdated?: (nodeId: string, changes: Partial<Node>, version: number) => void;
    onNodeDeleted?: (nodeId: string) => void;
  }
) {
  const { subscribeToProject, unsubscribeFromProject, onMessage, isConnected } =
    useWebSocket();

  React.useEffect(() => {
    if (!projectId || !isConnected) return;

    subscribeToProject(projectId);

    const unsubscribes: (() => void)[] = [];

    if (options?.onNodeCreated) {
      unsubscribes.push(
        onMessage<NodeCreatedMessage>('node_created', (msg) => {
          options.onNodeCreated!(msg.payload.node);
        })
      );
    }

    if (options?.onNodeUpdated) {
      unsubscribes.push(
        onMessage<NodeUpdatedMessage>('node_updated', (msg) => {
          options.onNodeUpdated!(
            msg.payload.nodeId,
            msg.payload.changes,
            msg.payload.version
          );
        })
      );
    }

    if (options?.onNodeDeleted) {
      unsubscribes.push(
        onMessage<NodeDeletedMessage>('node_deleted', (msg) => {
          options.onNodeDeleted!(msg.payload.nodeId);
        })
      );
    }

    return () => {
      unsubscribeFromProject(projectId);
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [
    projectId,
    isConnected,
    subscribeToProject,
    unsubscribeFromProject,
    onMessage,
    options?.onNodeCreated,
    options?.onNodeUpdated,
    options?.onNodeDeleted,
  ]);
}

/**
 * Hook to get presence information for a node
 */
export function useNodePresence(nodeId: string | undefined): {
  users: PresenceUser[];
  updatePresence: (action: 'viewing' | 'editing' | 'idle') => void;
} {
  const {
    subscribeToNode,
    unsubscribeFromNode,
    getPresence,
    updatePresence: wsUpdatePresence,
    isConnected,
  } = useWebSocket();

  const [users, setUsers] = React.useState<PresenceUser[]>([]);

  React.useEffect(() => {
    if (!nodeId || !isConnected) {
      setUsers([]);
      return;
    }

    subscribeToNode(nodeId);

    // Poll for presence updates (the context handles the actual subscription)
    const interval = setInterval(() => {
      setUsers(getPresence(nodeId));
    }, 1000);

    // Initial fetch
    setUsers(getPresence(nodeId));

    return () => {
      unsubscribeFromNode(nodeId);
      clearInterval(interval);
    };
  }, [nodeId, isConnected, subscribeToNode, unsubscribeFromNode, getPresence]);

  const updatePresence = React.useCallback(
    (action: 'viewing' | 'editing' | 'idle') => {
      if (nodeId) {
        wsUpdatePresence(nodeId, action);
      }
    },
    [nodeId, wsUpdatePresence]
  );

  return { users, updatePresence };
}

/**
 * Hook for node locking
 */
export function useNodeLock(nodeId: string | undefined): {
  isLocked: boolean;
  lockHolder: string | null;
  isLockHeldByMe: boolean;
  acquireLock: () => Promise<boolean>;
  releaseLock: () => void;
} {
  const {
    requestLock,
    releaseLock: wsReleaseLock,
    isLocked: checkIsLocked,
    getLockHolder,
    isConnected,
  } = useWebSocket();

  const [myLocks, setMyLocks] = React.useState<Set<string>>(new Set());

  const isLocked = nodeId ? checkIsLocked(nodeId) : false;
  const lockHolder = nodeId ? getLockHolder(nodeId) : null;
  const isLockHeldByMe = nodeId ? myLocks.has(nodeId) : false;

  const acquireLock = React.useCallback(async (): Promise<boolean> => {
    if (!nodeId || !isConnected) return false;

    const success = await requestLock(nodeId);
    if (success) {
      setMyLocks((prev) => new Set(prev).add(nodeId));
    }
    return success;
  }, [nodeId, isConnected, requestLock]);

  const releaseLock = React.useCallback(() => {
    if (!nodeId) return;

    wsReleaseLock(nodeId);
    setMyLocks((prev) => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
  }, [nodeId, wsReleaseLock]);

  // Clean up locks on unmount
  React.useEffect(() => {
    return () => {
      Array.from(myLocks).forEach((lockedNodeId) => {
        wsReleaseLock(lockedNodeId);
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isLocked,
    lockHolder,
    isLockHeldByMe,
    acquireLock,
    releaseLock,
  };
}

/**
 * Hook for real-time execution updates
 */
export function useExecutionUpdates(
  nodeId: string | undefined,
  onUpdate?: (status: AgentExecutionStatus, progress?: ExecutionProgress) => void
): {
  status: AgentExecutionStatus | null;
  progress: ExecutionProgress | null;
} {
  const { onMessage, isConnected } = useWebSocket();
  const [status, setStatus] = React.useState<AgentExecutionStatus | null>(null);
  const [progress, setProgress] = React.useState<ExecutionProgress | null>(null);

  React.useEffect(() => {
    if (!nodeId || !isConnected) return;

    const unsubscribe = onMessage<ExecutionUpdateMessage>(
      'execution_update',
      (msg) => {
        if (msg.payload.nodeId === nodeId) {
          setStatus(msg.payload.status);
          setProgress(msg.payload.progress || null);
          onUpdate?.(msg.payload.status, msg.payload.progress);
        }
      }
    );

    return unsubscribe;
  }, [nodeId, isConnected, onMessage, onUpdate]);

  return { status, progress };
}

/**
 * Hook for connection status indicator
 */
export function useConnectionStatus(): {
  state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  isConnected: boolean;
  reconnect: () => Promise<void>;
} {
  const { state, isConnected, connect } = useWebSocket();

  return {
    state,
    isConnected,
    reconnect: connect,
  };
}
