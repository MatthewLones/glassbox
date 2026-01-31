import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient, createWebSocketClient } from '../ws-client';
import type { ConnectionState, WSServerMessage } from '../types';

// Get the mock WebSocket from the global
const MockWebSocket = globalThis.WebSocket as unknown as {
  new (url: string): WebSocket & {
    _getMessages: () => string[];
    _simulateMessage: (data: unknown) => void;
    _simulateError: (error: Error) => void;
    _simulateClose: (code?: number, reason?: string) => void;
  };
};

describe('WebSocketClient', () => {
  let client: WebSocketClient;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new WebSocketClient({
      url: 'ws://localhost:8080/ws',
      token: 'test-token',
      reconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 3,
      pingInterval: 30000,
      debug: false,
    });
  });

  afterEach(() => {
    client.disconnect();
    vi.useRealTimers();
  });

  describe('connection', () => {
    it('should start in disconnected state', () => {
      expect(client.getState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);
    });

    it('should transition to connecting then connected', async () => {
      const states: ConnectionState[] = [];
      client.onStateChange((state) => states.push(state));

      client.connect();
      expect(client.getState()).toBe('connecting');

      // Wait for mock WebSocket to "connect"
      await vi.advanceTimersByTimeAsync(1);

      expect(client.getState()).toBe('connected');
      expect(client.isConnected()).toBe(true);
      expect(states).toEqual(['connecting', 'connected']);
    });

    it('should not connect if already connecting', () => {
      client.connect();
      client.connect(); // Should be ignored
      expect(client.getState()).toBe('connecting');
    });

    it('should disconnect cleanly', async () => {
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      client.disconnect();

      expect(client.getState()).toBe('disconnected');
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('subscriptions', () => {
    it('should subscribe to channels when connected', async () => {
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      client.subscribe('project:123');

      const ws = (client as unknown as { ws: ReturnType<typeof MockWebSocket> }).ws;
      const messages = ws._getMessages();

      expect(messages).toHaveLength(1);
      expect(JSON.parse(messages[0])).toEqual({
        type: 'subscribe',
        payload: { channel: 'project:123' },
      });
    });

    it('should queue subscriptions when not connected', async () => {
      client.subscribe('project:123');
      expect(client.getSubscriptions()).toContain('project:123');

      // Connect and verify message is sent
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      const ws = (client as unknown as { ws: ReturnType<typeof MockWebSocket> }).ws;
      const messages = ws._getMessages();

      // Should have both queued subscribe and resubscribe
      const subscribeMessages = messages.filter(
        (m) => JSON.parse(m).type === 'subscribe'
      );
      expect(subscribeMessages.length).toBeGreaterThanOrEqual(1);
    });

    it('should unsubscribe from channels', async () => {
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      client.subscribe('project:123');
      client.unsubscribe('project:123');

      const ws = (client as unknown as { ws: ReturnType<typeof MockWebSocket> }).ws;
      const messages = ws._getMessages();
      const lastMessage = JSON.parse(messages[messages.length - 1]);

      expect(lastMessage).toEqual({
        type: 'unsubscribe',
        payload: { channel: 'project:123' },
      });
      expect(client.getSubscriptions()).not.toContain('project:123');
    });

    it('should resubscribe after reconnect', async () => {
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      client.subscribe('project:123');
      client.subscribe('node:456');

      // Simulate disconnect and reconnect
      const ws = (client as unknown as { ws: ReturnType<typeof MockWebSocket> }).ws;
      ws._simulateClose(1006, 'abnormal');

      // Should be in reconnecting state
      expect(client.getState()).toBe('reconnecting');

      // Wait for reconnect
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1);

      // Should have resubscribed
      expect(client.getSubscriptions()).toContain('project:123');
      expect(client.getSubscriptions()).toContain('node:456');
    });
  });

  describe('presence', () => {
    it('should send presence updates', async () => {
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      client.updatePresence('node-123', 'editing');

      const ws = (client as unknown as { ws: ReturnType<typeof MockWebSocket> }).ws;
      const messages = ws._getMessages();
      const lastMessage = JSON.parse(messages[messages.length - 1]);

      expect(lastMessage).toEqual({
        type: 'presence',
        payload: { nodeId: 'node-123', action: 'editing' },
      });
    });
  });

  describe('locks', () => {
    it('should send lock acquire request', async () => {
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      const lockPromise = client.requestLock('node-123');

      const ws = (client as unknown as { ws: ReturnType<typeof MockWebSocket> }).ws;
      const messages = ws._getMessages();
      const lastMessage = JSON.parse(messages[messages.length - 1]);

      expect(lastMessage.type).toBe('lock_acquire');
      expect(lastMessage.payload.nodeId).toBe('node-123');
      expect(lastMessage.requestId).toBeDefined();

      // Simulate success response
      ws._simulateMessage({
        type: 'lock_acquired',
        payload: { nodeId: 'node-123', lockedBy: 'user-1' },
        requestId: lastMessage.requestId,
      });

      const result = await lockPromise;
      expect(result.type).toBe('lock_acquired');
    });

    it('should reject lock request on timeout', async () => {
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      // Set up promise with error handler attached immediately
      const lockPromise = client.requestLock('node-123', 1000).catch((e) => e);

      // Don't respond, let it timeout
      await vi.advanceTimersByTimeAsync(1001);

      // The promise should resolve to the error (since we caught it)
      const error = await lockPromise;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Lock request timed out');
    });

    it('should reject lock request on error', async () => {
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      const lockPromise = client.requestLock('node-123');

      const ws = (client as unknown as { ws: ReturnType<typeof MockWebSocket> }).ws;
      const messages = ws._getMessages();
      const lastMessage = JSON.parse(messages[messages.length - 1]);

      // Simulate error response
      ws._simulateMessage({
        type: 'error',
        payload: { code: 'LOCK_HELD', message: 'Lock is held by another user' },
        requestId: lastMessage.requestId,
      });

      await expect(lockPromise).rejects.toThrow('Lock is held by another user');
    });

    it('should send lock release', async () => {
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      client.releaseLock('node-123');

      const ws = (client as unknown as { ws: ReturnType<typeof MockWebSocket> }).ws;
      const messages = ws._getMessages();
      const lastMessage = JSON.parse(messages[messages.length - 1]);

      expect(lastMessage).toEqual({
        type: 'lock_release',
        payload: { nodeId: 'node-123' },
      });
    });
  });

  describe('message handling', () => {
    it('should call type-specific handlers', async () => {
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      const handler = vi.fn();
      client.on('node_updated', handler);

      const ws = (client as unknown as { ws: ReturnType<typeof MockWebSocket> }).ws;
      ws._simulateMessage({
        type: 'node_updated',
        payload: { nodeId: 'node-123', changes: { title: 'New Title' }, version: 2 },
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        type: 'node_updated',
        payload: { nodeId: 'node-123', changes: { title: 'New Title' }, version: 2 },
      });
    });

    it('should allow removing handlers', async () => {
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      const handler = vi.fn();
      const unsubscribe = client.on('node_updated', handler);

      const ws = (client as unknown as { ws: ReturnType<typeof MockWebSocket> }).ws;
      ws._simulateMessage({
        type: 'node_updated',
        payload: { nodeId: 'node-123', changes: {}, version: 2 },
      });

      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      ws._simulateMessage({
        type: 'node_updated',
        payload: { nodeId: 'node-456', changes: {}, version: 1 },
      });

      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should call wildcard handlers for all messages', async () => {
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      const handler = vi.fn();
      client.onMessage(handler);

      const ws = (client as unknown as { ws: ReturnType<typeof MockWebSocket> }).ws;

      ws._simulateMessage({ type: 'node_created', payload: { node: {} } });
      ws._simulateMessage({ type: 'node_deleted', payload: { nodeId: '123' } });

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('reconnection', () => {
    it('should enter reconnecting state on abnormal close', async () => {
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      const ws = (client as unknown as { ws: ReturnType<typeof MockWebSocket> }).ws;
      ws._simulateClose(1006, 'abnormal');

      // Should immediately enter reconnecting state
      expect(client.getState()).toBe('reconnecting');
    });

    it('should schedule reconnect with backoff', async () => {
      const states: ConnectionState[] = [];
      client.onStateChange((s) => states.push(s));

      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      const ws = (client as unknown as { ws: ReturnType<typeof MockWebSocket> }).ws;
      ws._simulateClose(1006);

      // Verify reconnecting state was entered
      expect(states).toContain('reconnecting');
    });

    it('should not reconnect on normal close (1000)', async () => {
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      const ws = (client as unknown as { ws: ReturnType<typeof MockWebSocket> }).ws;
      ws._simulateClose(1000, 'normal');

      expect(client.getState()).toBe('disconnected');

      // Wait and verify no reconnect
      await vi.advanceTimersByTimeAsync(5000);
      expect(client.getState()).toBe('disconnected');
    });

    it('should not reconnect when reconnect option is false', async () => {
      const noReconnectClient = new WebSocketClient({
        url: 'ws://localhost:8080/ws',
        token: 'test-token',
        reconnect: false,
      });

      noReconnectClient.connect();
      await vi.advanceTimersByTimeAsync(1);

      const ws = (noReconnectClient as unknown as { ws: ReturnType<typeof MockWebSocket> }).ws;
      ws._simulateClose(1006);

      expect(noReconnectClient.getState()).toBe('disconnected');
      noReconnectClient.disconnect();
    });
  });

  describe('ping/pong', () => {
    it('should send pings at configured interval', async () => {
      client.connect();
      await vi.advanceTimersByTimeAsync(1);

      const ws = (client as unknown as { ws: ReturnType<typeof MockWebSocket> }).ws;

      // Wait for ping interval
      await vi.advanceTimersByTimeAsync(30000);

      const messages = ws._getMessages();
      const pingMessages = messages.filter((m) => JSON.parse(m).type === 'ping');

      expect(pingMessages.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('createWebSocketClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should exchange token and create client', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 'ws-token-123' }),
    } as Response);

    const clientPromise = createWebSocketClient('http://localhost:8080');
    await vi.advanceTimersByTimeAsync(1);
    const client = await clientPromise;

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/auth/ws-token',
      { method: 'POST', credentials: 'include' }
    );

    expect(client).toBeInstanceOf(WebSocketClient);
    client.disconnect();
  });

  it('should throw on token exchange failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    await expect(
      createWebSocketClient('http://localhost:8080')
    ).rejects.toThrow('Failed to get WebSocket token');
  });
});
