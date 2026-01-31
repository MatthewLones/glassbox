import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as React from 'react';
import { useNotifications, useDemoNotifications } from '../use-notifications';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock WebSocket context
const mockOnMessage = vi.fn().mockReturnValue(() => {});

vi.mock('@/lib/websocket', () => ({
  useWebSocket: () => ({
    onMessage: mockOnMessage,
    isConnected: true,
  }),
}));

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('should initialize with empty notifications', () => {
    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('should load notifications from localStorage', () => {
    const storedNotifications = [
      {
        id: 'notif-1',
        type: 'node_created',
        title: 'Test',
        message: 'Test message',
        createdAt: new Date().toISOString(),
        read: false,
      },
    ];
    localStorageMock.setItem(
      'glassbox:notifications',
      JSON.stringify(storedNotifications)
    );

    const { result } = renderHook(() => useNotifications());

    // Wait for useEffect to run
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].title).toBe('Test');
  });

  it('should mark notification as read', () => {
    const storedNotifications = [
      {
        id: 'notif-1',
        type: 'node_created',
        title: 'Test',
        message: 'Test message',
        createdAt: new Date().toISOString(),
        read: false,
      },
    ];
    localStorageMock.setItem(
      'glassbox:notifications',
      JSON.stringify(storedNotifications)
    );

    const { result } = renderHook(() => useNotifications());

    expect(result.current.unreadCount).toBe(1);

    act(() => {
      result.current.markAsRead('notif-1');
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications[0].read).toBe(true);
  });

  it('should mark all notifications as read', () => {
    const storedNotifications = [
      {
        id: 'notif-1',
        type: 'node_created',
        title: 'Test 1',
        message: 'Message 1',
        createdAt: new Date().toISOString(),
        read: false,
      },
      {
        id: 'notif-2',
        type: 'node_updated',
        title: 'Test 2',
        message: 'Message 2',
        createdAt: new Date().toISOString(),
        read: false,
      },
    ];
    localStorageMock.setItem(
      'glassbox:notifications',
      JSON.stringify(storedNotifications)
    );

    const { result } = renderHook(() => useNotifications());

    expect(result.current.unreadCount).toBe(2);

    act(() => {
      result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
  });

  it('should dismiss a notification', () => {
    const storedNotifications = [
      {
        id: 'notif-1',
        type: 'node_created',
        title: 'Test',
        message: 'Test message',
        createdAt: new Date().toISOString(),
        read: false,
      },
    ];
    localStorageMock.setItem(
      'glassbox:notifications',
      JSON.stringify(storedNotifications)
    );

    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications).toHaveLength(1);

    act(() => {
      result.current.dismiss('notif-1');
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('should clear all notifications', () => {
    const storedNotifications = [
      {
        id: 'notif-1',
        type: 'node_created',
        title: 'Test 1',
        message: 'Message 1',
        createdAt: new Date().toISOString(),
        read: false,
      },
      {
        id: 'notif-2',
        type: 'node_updated',
        title: 'Test 2',
        message: 'Message 2',
        createdAt: new Date().toISOString(),
        read: true,
      },
    ];
    localStorageMock.setItem(
      'glassbox:notifications',
      JSON.stringify(storedNotifications)
    );

    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications).toHaveLength(2);

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.notifications).toHaveLength(0);
    expect(localStorageMock.getItem('glassbox:notifications')).toBeNull();
  });

  it('should persist notifications to localStorage', async () => {
    const storedNotifications = [
      {
        id: 'notif-1',
        type: 'node_created',
        title: 'Test',
        message: 'Test message',
        createdAt: new Date().toISOString(),
        read: false,
      },
    ];
    localStorageMock.setItem(
      'glassbox:notifications',
      JSON.stringify(storedNotifications)
    );

    const { result } = renderHook(() => useNotifications());

    act(() => {
      result.current.markAsRead('notif-1');
    });

    // Check that localStorage was updated
    const stored = localStorageMock.getItem('glassbox:notifications');
    const parsed = JSON.parse(stored!);
    expect(parsed[0].read).toBe(true);
  });
});

describe('useDemoNotifications', () => {
  it('should add demo notifications', () => {
    const { result } = renderHook(() => useDemoNotifications());

    expect(result.current.notifications).toHaveLength(0);

    act(() => {
      result.current.addDemoNotification('node_created');
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].type).toBe('node_created');
    expect(result.current.notifications[0].title).toBe('New Node Created');
  });

  it('should limit demo notifications to 10', () => {
    const { result } = renderHook(() => useDemoNotifications());

    for (let i = 0; i < 15; i++) {
      act(() => {
        result.current.addDemoNotification('node_created');
      });
    }

    expect(result.current.notifications).toHaveLength(10);
  });

  it('should add different types of notifications', () => {
    const { result } = renderHook(() => useDemoNotifications());

    const types = [
      'node_created',
      'execution_completed',
      'hitl_request',
    ] as const;

    types.forEach((type) => {
      act(() => {
        result.current.addDemoNotification(type);
      });
    });

    expect(result.current.notifications).toHaveLength(3);
    expect(result.current.notifications[0].type).toBe('hitl_request');
    expect(result.current.notifications[1].type).toBe('execution_completed');
    expect(result.current.notifications[2].type).toBe('node_created');
  });
});
