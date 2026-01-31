import type {
  ConnectionState,
  WSClientMessage,
  WSServerMessage,
  WebSocketClientOptions,
  MessageHandler,
  ConnectionStateHandler,
} from './types';

const DEFAULT_OPTIONS: Partial<WebSocketClientOptions> = {
  reconnect: true,
  reconnectInterval: 1000,
  maxReconnectAttempts: 10,
  pingInterval: 30000,
  debug: false,
};

/**
 * WebSocket client for GlassBox real-time communication.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Ping/pong keepalive
 * - Message queuing during disconnection
 * - Event-based message handling
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private options: WebSocketClientOptions;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private messageQueue: WSClientMessage[] = [];
  private subscriptions: Set<string> = new Set();

  // Event handlers
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private stateHandlers: Set<ConnectionStateHandler> = new Set();

  // Request tracking for lock operations
  private pendingRequests: Map<string, {
    resolve: (value: WSServerMessage) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = new Map();

  constructor(options: WebSocketClientOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Get current subscriptions
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.ws && (this.state === 'connecting' || this.state === 'connected')) {
      this.log('Already connected or connecting');
      return;
    }

    this.setState('connecting');
    this.clearReconnectTimeout();

    try {
      const url = `${this.options.url}?token=${this.options.token}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
    } catch (error) {
      this.log('Connection error:', error);
      this.setState('error');
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.log('Disconnecting...');
    this.clearReconnectTimeout();
    this.clearPingInterval();
    this.subscriptions.clear();
    this.messageQueue = [];

    // Reject all pending requests
    Array.from(this.pendingRequests.entries()).forEach(([requestId, request]) => {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection closed'));
    });
    this.pendingRequests.clear();

    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setState('disconnected');
  }

  /**
   * Subscribe to a channel (project or node)
   */
  subscribe(channel: string): void {
    this.subscriptions.add(channel);
    this.send({ type: 'subscribe', payload: { channel } });
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string): void {
    this.subscriptions.delete(channel);
    this.send({ type: 'unsubscribe', payload: { channel } });
  }

  /**
   * Update presence on a node
   */
  updatePresence(nodeId: string, action: 'viewing' | 'editing' | 'idle'): void {
    this.send({ type: 'presence', payload: { nodeId, action } });
  }

  /**
   * Request a lock on a node (returns a promise)
   */
  async requestLock(nodeId: string, timeoutMs = 5000): Promise<WSServerMessage> {
    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Lock request timed out'));
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      this.send({ type: 'lock_acquire', payload: { nodeId }, requestId });
    });
  }

  /**
   * Release a lock on a node
   */
  releaseLock(nodeId: string): void {
    this.send({ type: 'lock_release', payload: { nodeId } });
  }

  /**
   * Send a ping (for keepalive)
   */
  ping(): void {
    this.send({ type: 'ping' });
  }

  /**
   * Add a message handler for a specific message type
   */
  on<T extends WSServerMessage>(
    type: T['type'],
    handler: MessageHandler<T>
  ): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler as MessageHandler);

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(type)?.delete(handler as MessageHandler);
    };
  }

  /**
   * Add a handler for all messages
   */
  onMessage(handler: MessageHandler): () => void {
    return this.on('*' as WSServerMessage['type'], handler);
  }

  /**
   * Add a connection state change handler
   */
  onStateChange(handler: ConnectionStateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  /**
   * Remove all handlers
   */
  removeAllHandlers(): void {
    this.messageHandlers.clear();
    this.stateHandlers.clear();
  }

  // Private methods

  private send(message: WSClientMessage): void {
    if (this.ws && this.state === 'connected') {
      this.log('Sending:', message);
      this.ws.send(JSON.stringify(message));
    } else {
      this.log('Queueing message (not connected):', message);
      this.messageQueue.push(message);
    }
  }

  private handleOpen(): void {
    this.log('Connected');
    this.setState('connected');
    this.reconnectAttempts = 0;
    this.startPingInterval();
    this.flushMessageQueue();
    this.resubscribe();
  }

  private handleClose(event: CloseEvent): void {
    this.log('Connection closed:', event.code, event.reason);
    this.clearPingInterval();
    this.ws = null;

    if (event.code === 1000) {
      // Normal closure
      this.setState('disconnected');
    } else if (this.options.reconnect) {
      this.setState('reconnecting');
      this.scheduleReconnect();
    } else {
      this.setState('disconnected');
    }
  }

  private handleError(event: Event): void {
    this.log('WebSocket error:', event);
    // The close event will follow, so we don't need to do much here
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as WSServerMessage;
      this.log('Received:', message);

      // Handle pending lock requests
      if (
        (message.type === 'lock_acquired' || message.type === 'error') &&
        'requestId' in message &&
        message.requestId
      ) {
        const pending = this.pendingRequests.get(message.requestId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.requestId);
          if (message.type === 'error') {
            pending.reject(new Error(message.payload.message));
          } else {
            pending.resolve(message);
          }
        }
      }

      // Notify type-specific handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        Array.from(handlers).forEach((handler) => {
          try {
            handler(message);
          } catch (error) {
            console.error('Message handler error:', error);
          }
        });
      }

      // Notify wildcard handlers
      const wildcardHandlers = this.messageHandlers.get('*' as WSServerMessage['type']);
      if (wildcardHandlers) {
        Array.from(wildcardHandlers).forEach((handler) => {
          try {
            handler(message);
          } catch (error) {
            console.error('Message handler error:', error);
          }
        });
      }
    } catch (error) {
      this.log('Failed to parse message:', error);
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.log('State change:', this.state, '->', state);
      this.state = state;
      Array.from(this.stateHandlers).forEach((handler) => {
        try {
          handler(state);
        } catch (error) {
          console.error('State handler error:', error);
        }
      });
    }
  }

  private scheduleReconnect(): void {
    if (
      this.reconnectAttempts >= (this.options.maxReconnectAttempts || 10)
    ) {
      this.log('Max reconnect attempts reached');
      this.setState('error');
      return;
    }

    // Exponential backoff with jitter
    const baseDelay = this.options.reconnectInterval || 1000;
    const delay = Math.min(
      baseDelay * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
      30000 // Max 30 seconds
    );

    this.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private startPingInterval(): void {
    this.clearPingInterval();
    this.pingInterval = setInterval(() => {
      this.ping();
    }, this.options.pingInterval || 30000);
  }

  private clearPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.send(message);
    }
  }

  private resubscribe(): void {
    Array.from(this.subscriptions).forEach((channel) => {
      this.send({ type: 'subscribe', payload: { channel } });
    });
  }

  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log('[WebSocket]', ...args);
    }
  }
}

/**
 * Create a WebSocket client with token exchange
 */
export async function createWebSocketClient(
  apiBaseUrl: string,
  options?: Partial<Omit<WebSocketClientOptions, 'url' | 'token'>>
): Promise<WebSocketClient> {
  // Exchange JWT for WebSocket token
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/ws-token`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to get WebSocket token');
  }

  const { token } = await response.json();

  // Construct WebSocket URL
  const wsUrl = apiBaseUrl
    .replace(/^http/, 'ws')
    .replace(/\/$/, '') + '/ws';

  return new WebSocketClient({
    url: wsUrl,
    token,
    ...options,
  });
}
