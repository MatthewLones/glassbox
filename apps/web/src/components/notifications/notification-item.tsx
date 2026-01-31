'use client';

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  FileText,
  CheckCircle,
  XCircle,
  Play,
  MessageSquare,
  AtSign,
  AlertCircle,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Notification } from '@/hooks/use-notifications';
import type { NotificationType } from '@/lib/websocket/types';

interface NotificationItemProps {
  notification: Notification;
  onRead?: () => void;
  onDismiss?: () => void;
  onClick?: () => void;
}

const typeIcons: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  node_created: FileText,
  node_updated: FileText,
  node_deleted: Trash2,
  execution_started: Play,
  execution_completed: CheckCircle,
  execution_failed: XCircle,
  hitl_request: AlertCircle,
  mention: AtSign,
  comment: MessageSquare,
};

const typeColors: Record<NotificationType, string> = {
  node_created: 'text-blue-500 bg-blue-50',
  node_updated: 'text-blue-500 bg-blue-50',
  node_deleted: 'text-gray-500 bg-gray-50',
  execution_started: 'text-yellow-500 bg-yellow-50',
  execution_completed: 'text-green-500 bg-green-50',
  execution_failed: 'text-red-500 bg-red-50',
  hitl_request: 'text-orange-500 bg-orange-50',
  mention: 'text-purple-500 bg-purple-50',
  comment: 'text-indigo-500 bg-indigo-50',
};

export function NotificationItem({
  notification,
  onRead,
  onDismiss,
  onClick,
}: NotificationItemProps) {
  const Icon = typeIcons[notification.type] || FileText;
  const colorClass = typeColors[notification.type] || 'text-gray-500 bg-gray-50';

  const handleClick = () => {
    if (!notification.read && onRead) {
      onRead();
    }
    onClick?.();
  };

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  });

  return (
    <div
      className={cn(
        'group relative flex gap-3 p-3 rounded-lg cursor-pointer transition-colors',
        notification.read
          ? 'bg-transparent hover:bg-muted/50'
          : 'bg-muted/30 hover:bg-muted/50'
      )}
      onClick={handleClick}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
      )}

      {/* Icon */}
      <div
        className={cn(
          'shrink-0 flex items-center justify-center h-9 w-9 rounded-full',
          colorClass
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{notification.title}</p>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
        >
          <X className="h-3 w-3" />
          <span className="sr-only">Dismiss</span>
        </Button>
      )}
    </div>
  );
}

export function NotificationItemSkeleton() {
  return (
    <div className="flex gap-3 p-3 animate-pulse">
      <div className="shrink-0 h-9 w-9 rounded-full bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/2 rounded bg-muted" />
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/4 rounded bg-muted" />
      </div>
    </div>
  );
}
