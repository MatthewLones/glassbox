'use client';

import * as React from 'react';
import { useWebSocket } from '@/lib/websocket';
import type { NotificationMessage, NotificationType } from '@/lib/websocket/types';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  projectId?: string;
  nodeId?: string;
  userId?: string;
  createdAt: string;
  read: boolean;
}

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

// Store notifications in localStorage for persistence
const STORAGE_KEY = 'glassbox:notifications';
const MAX_NOTIFICATIONS = 50;

function loadNotifications(): Notification[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifications: Notification[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // Ignore localStorage errors
  }
}

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const { onMessage, isConnected } = useWebSocket();

  // Load notifications from localStorage on mount
  React.useEffect(() => {
    setNotifications(loadNotifications());
  }, []);

  // Save notifications to localStorage when they change
  React.useEffect(() => {
    if (notifications.length > 0) {
      saveNotifications(notifications);
    }
  }, [notifications]);

  // Listen for WebSocket notifications
  React.useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = onMessage<NotificationMessage>('notification', (msg) => {
      const newNotification: Notification = {
        id: msg.payload.id,
        type: msg.payload.notificationType,
        title: msg.payload.title,
        message: msg.payload.message,
        projectId: msg.payload.projectId,
        nodeId: msg.payload.nodeId,
        userId: msg.payload.userId,
        createdAt: msg.payload.createdAt,
        read: false,
      };

      setNotifications((prev) => {
        // Don't add duplicates
        if (prev.some((n) => n.id === newNotification.id)) {
          return prev;
        }
        return [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
      });
    });

    return unsubscribe;
  }, [isConnected, onMessage]);

  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const markAsRead = React.useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = React.useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = React.useCallback(() => {
    setNotifications([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismiss,
    clearAll,
  };
}

// Helper to generate demo notifications for testing
export function useDemoNotifications() {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);

  const addDemoNotification = React.useCallback((type: NotificationType = 'node_created') => {
    const demoNotifications: Record<NotificationType, Partial<Notification>> = {
      node_created: {
        title: 'New Node Created',
        message: 'A new node "Research Analysis" was created in your project.',
      },
      node_updated: {
        title: 'Node Updated',
        message: 'The node "Q4 Planning" was updated with new content.',
      },
      node_deleted: {
        title: 'Node Deleted',
        message: 'A node was removed from your project.',
      },
      execution_started: {
        title: 'Execution Started',
        message: 'Agent execution has started on "Market Research".',
      },
      execution_completed: {
        title: 'Execution Completed',
        message: 'Agent successfully completed the analysis task.',
      },
      execution_failed: {
        title: 'Execution Failed',
        message: 'Agent execution encountered an error.',
      },
      hitl_request: {
        title: 'Input Required',
        message: 'Agent is waiting for your input on "Budget Approval".',
      },
      mention: {
        title: 'You were mentioned',
        message: 'John mentioned you in a comment on "Project Overview".',
      },
      comment: {
        title: 'New Comment',
        message: 'Sarah added a comment on "Research Notes".',
      },
    };

    const demo = demoNotifications[type];
    const notification: Notification = {
      id: `demo-${Date.now()}`,
      type,
      title: demo.title || 'Notification',
      message: demo.message || 'Something happened.',
      createdAt: new Date().toISOString(),
      read: false,
    };

    setNotifications((prev) => [notification, ...prev].slice(0, 10));
  }, []);

  return { notifications, addDemoNotification };
}
