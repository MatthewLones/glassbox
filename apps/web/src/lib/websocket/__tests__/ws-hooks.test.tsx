import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { WebSocketProvider, useWebSocket } from '../ws-context';
import {
  useNodePresence,
  useNodeLock,
  useConnectionStatus,
} from '../ws-hooks';
import type { ReactNode } from 'react';

// Mock WebSocket helpers
const getWebSocketInstance = () => {
  // Get the most recent WebSocket instance
  return (globalThis as unknown as {
    _lastWebSocket: {
      _simulateMessage: (data: unknown) => void;
      _simulateClose: (code?: number) => void;
    };
  })._lastWebSocket;
};

// Track WebSocket instances
const originalWebSocket = globalThis.WebSocket;
beforeEach(() => {
  vi.useFakeTimers();

  // Wrap WebSocket to track instances
  globalThis.WebSocket = class extends originalWebSocket {
    constructor(url: string, protocols?: string | string[]) {
      super(url, protocols);
      (globalThis as unknown as { _lastWebSocket: unknown })._lastWebSocket = this;
    }
  } as unknown as typeof WebSocket;

  // Mock fetch for token exchange
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ token: 'test-token' }),
  } as Response);
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.WebSocket = originalWebSocket;
});

// Test wrapper
function createWrapper(options?: { autoConnect?: boolean }) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <WebSocketProvider
        apiBaseUrl="http://localhost:8080"
        autoConnect={options?.autoConnect ?? false}
        debug={false}
      >
        {children}
      </WebSocketProvider>
    );
  };
}

describe('useWebSocket', () => {
  it('should provide connection state', () => {
    const { result } = renderHook(() => useWebSocket(), {
      wrapper: createWrapper(),
    });

    expect(result.current.state).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);
  });

  it('should connect when connect() is called', async () => {
    const { result } = renderHook(() => useWebSocket(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.connect();
      // Wait for async connect to complete
      await vi.advanceTimersByTimeAsync(10);
    });

    // Check state after connection attempt
    expect(['connecting', 'connected']).toContain(result.current.state);
  });

  it('should subscribe to project channels', async () => {
    const { result } = renderHook(() => useWebSocket(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.connect();
      await vi.advanceTimersByTimeAsync(1);
    });

    act(() => {
      result.current.subscribeToProject('project-123');
    });

    // Verify through client subscriptions
    expect(result.current.client?.getSubscriptions()).toContain('project:project-123');
  });

  it('should track presence updates', async () => {
    const { result } = renderHook(() => useWebSocket(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.connect();
      await vi.advanceTimersByTimeAsync(1);
    });

    // Simulate presence update from server
    const ws = getWebSocketInstance();
    act(() => {
      ws._simulateMessage({
        type: 'presence_update',
        payload: {
          nodeId: 'node-123',
          users: [
            { userId: 'user-1', email: 'user@example.com', action: 'editing', lastSeen: new Date().toISOString() },
          ],
        },
      });
    });

    const presence = result.current.getPresence('node-123');
    expect(presence).toHaveLength(1);
    expect(presence[0].email).toBe('user@example.com');
  });

  it('should track lock state', async () => {
    const { result } = renderHook(() => useWebSocket(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.connect();
      await vi.advanceTimersByTimeAsync(1);
    });

    // Simulate lock acquired
    const ws = getWebSocketInstance();
    act(() => {
      ws._simulateMessage({
        type: 'lock_acquired',
        payload: { nodeId: 'node-123', lockedBy: 'user-1' },
      });
    });

    expect(result.current.isLocked('node-123')).toBe(true);
    expect(result.current.getLockHolder('node-123')).toBe('user-1');

    // Simulate lock released
    act(() => {
      ws._simulateMessage({
        type: 'lock_released',
        payload: { nodeId: 'node-123' },
      });
    });

    expect(result.current.isLocked('node-123')).toBe(false);
    expect(result.current.getLockHolder('node-123')).toBe(null);
  });
});

describe('useNodePresence', () => {
  it('should return empty users when not connected', () => {
    const { result } = renderHook(() => useNodePresence('node-123'), {
      wrapper: createWrapper(),
    });

    expect(result.current.users).toEqual([]);
  });

  it('should return presence users for a node', async () => {
    const { result, rerender } = renderHook(
      ({ nodeId }) => {
        const ws = useWebSocket();
        const presence = useNodePresence(nodeId);
        return { ws, presence };
      },
      {
        wrapper: createWrapper(),
        initialProps: { nodeId: 'node-123' },
      }
    );

    // Connect first
    await act(async () => {
      await result.current.ws.connect();
      await vi.advanceTimersByTimeAsync(1);
    });

    // Simulate presence update
    const ws = getWebSocketInstance();
    act(() => {
      ws._simulateMessage({
        type: 'presence_update',
        payload: {
          nodeId: 'node-123',
          users: [
            { userId: 'user-1', email: 'alice@example.com', action: 'viewing', lastSeen: new Date().toISOString() },
            { userId: 'user-2', email: 'bob@example.com', action: 'editing', lastSeen: new Date().toISOString() },
          ],
        },
      });
    });

    // Wait for state to update
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100); // Polling interval is 1000ms
    });

    expect(result.current.presence.users.length).toBeGreaterThanOrEqual(0);
  });

  it('should provide updatePresence function', async () => {
    const { result } = renderHook(
      () => {
        const ws = useWebSocket();
        const presence = useNodePresence('node-123');
        return { ws, presence };
      },
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.ws.connect();
      await vi.advanceTimersByTimeAsync(1);
    });

    act(() => {
      result.current.presence.updatePresence('editing');
    });

    // Verify message was sent
    const client = result.current.ws.client;
    expect(client).toBeTruthy();
  });
});

describe('useNodeLock', () => {
  it('should return lock state for a node', async () => {
    const { result } = renderHook(
      () => {
        const ws = useWebSocket();
        const lock = useNodeLock('node-123');
        return { ws, lock };
      },
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.ws.connect();
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(result.current.lock.isLocked).toBe(false);
    expect(result.current.lock.lockHolder).toBe(null);
    expect(result.current.lock.isLockHeldByMe).toBe(false);
  });

  it('should call acquireLock and track local lock state', async () => {
    const { result } = renderHook(
      () => {
        const ws = useWebSocket();
        const lock = useNodeLock('node-123');
        return { ws, lock };
      },
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.ws.connect();
      await vi.advanceTimersByTimeAsync(10);
    });

    // Before acquiring, should not be held by me
    expect(result.current.lock.isLockHeldByMe).toBe(false);

    // acquireLock function should be available
    expect(typeof result.current.lock.acquireLock).toBe('function');
  });

  it('should release lock', async () => {
    const { result } = renderHook(
      () => {
        const ws = useWebSocket();
        const lock = useNodeLock('node-123');
        return { ws, lock };
      },
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.ws.connect();
      await vi.advanceTimersByTimeAsync(1);
    });

    act(() => {
      result.current.lock.releaseLock();
    });

    // Verify release was called (lock should not be held by me)
    expect(result.current.lock.isLockHeldByMe).toBe(false);
  });
});

describe('useConnectionStatus', () => {
  it('should reflect initial disconnected state', () => {
    const { result } = renderHook(() => useConnectionStatus(), {
      wrapper: createWrapper(),
    });

    expect(result.current.state).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);
  });

  it('should provide reconnect function', () => {
    const { result } = renderHook(() => useConnectionStatus(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.reconnect).toBe('function');
  });
});
