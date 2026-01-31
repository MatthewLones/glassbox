'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { PresenceUser } from '@/lib/websocket/types';

interface PresenceAvatarsProps {
  users: PresenceUser[];
  maxVisible?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
};

const ringColors: Record<string, string> = {
  viewing: 'ring-blue-500',
  editing: 'ring-green-500',
  idle: 'ring-gray-400',
};

export function PresenceAvatars({
  users,
  maxVisible = 3,
  size = 'md',
  className,
}: PresenceAvatarsProps) {
  if (users.length === 0) {
    return null;
  }

  const visibleUsers = users.slice(0, maxVisible);
  const hiddenCount = users.length - maxVisible;

  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {visibleUsers.map((user) => (
        <PresenceAvatar key={user.userId} user={user} size={size} />
      ))}
      {hiddenCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex items-center justify-center rounded-full bg-muted border-2 border-background',
                sizeClasses[size]
              )}
            >
              <span className="font-medium text-muted-foreground">
                +{hiddenCount}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="space-y-1">
              {users.slice(maxVisible).map((user) => (
                <div key={user.userId} className="flex items-center gap-2">
                  <PresenceIndicator action={user.action} size="sm" />
                  <span>{user.name || user.email}</span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

interface PresenceAvatarProps {
  user: PresenceUser;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

export function PresenceAvatar({
  user,
  size = 'md',
  showTooltip = true,
  className,
}: PresenceAvatarProps) {
  const initials = getInitials(user.name || user.email);
  const ringColor = ringColors[user.action] || ringColors.viewing;

  const avatar = (
    <Avatar
      className={cn(
        'ring-2 border-2 border-background',
        ringColor,
        sizeClasses[size],
        className
      )}
    >
      <AvatarImage src={user.avatarUrl} alt={user.name || user.email} />
      <AvatarFallback className="font-medium">{initials}</AvatarFallback>
    </Avatar>
  );

  if (!showTooltip) {
    return avatar;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{avatar}</TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="flex items-center gap-2">
          <PresenceIndicator action={user.action} size="sm" />
          <div>
            <p className="font-medium">{user.name || user.email}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {user.action}
            </p>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface PresenceIndicatorProps {
  action: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function PresenceIndicator({
  action,
  size = 'md',
  className,
}: PresenceIndicatorProps) {
  const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-3 w-3';
  const colors: Record<string, string> = {
    viewing: 'bg-blue-500',
    editing: 'bg-green-500 animate-pulse',
    idle: 'bg-gray-400',
  };

  return (
    <span
      className={cn(
        'inline-block rounded-full',
        dotSize,
        colors[action] || colors.viewing,
        className
      )}
    />
  );
}

function getInitials(name: string): string {
  const parts = name.split(/[@\s]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
