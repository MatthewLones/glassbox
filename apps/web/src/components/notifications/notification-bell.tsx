'use client';

import * as React from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NotificationBellProps {
  unreadCount: number;
  onClick?: () => void;
  className?: string;
}

export function NotificationBell({
  unreadCount,
  onClick,
  className,
}: NotificationBellProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('relative', className)}
      onClick={onClick}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span
          className={cn(
            'absolute flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium',
            unreadCount > 9 ? '-right-1 -top-1 h-5 min-w-5 px-1' : 'right-0.5 top-0.5 h-4 w-4'
          )}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      <span className="sr-only">
        {unreadCount === 0
          ? 'No notifications'
          : `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
      </span>
    </Button>
  );
}
