'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useConnectionStatus } from '@/lib/websocket';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';

interface ConnectionStatusProps {
  className?: string;
  showLabel?: boolean;
}

export function ConnectionStatus({
  className,
  showLabel = false,
}: ConnectionStatusProps) {
  const { state, isConnected, reconnect } = useConnectionStatus();

  const statusConfig = {
    disconnected: {
      icon: WifiOff,
      color: 'text-gray-400',
      bgColor: 'bg-gray-100',
      label: 'Disconnected',
    },
    connecting: {
      icon: Loader2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      label: 'Connecting...',
    },
    connected: {
      icon: Wifi,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      label: 'Connected',
    },
    reconnecting: {
      icon: Loader2,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
      label: 'Reconnecting...',
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      label: 'Connection Error',
    },
  };

  const config = statusConfig[state];
  const Icon = config.icon;
  const isAnimating = state === 'connecting' || state === 'reconnecting';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => {
            if (!isConnected) {
              reconnect();
            }
          }}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors',
            config.bgColor,
            !isConnected && 'cursor-pointer hover:opacity-80',
            className
          )}
        >
          <Icon
            className={cn(
              'h-3.5 w-3.5',
              config.color,
              isAnimating && 'animate-spin'
            )}
          />
          {showLabel && (
            <span className={cn('text-xs font-medium', config.color)}>
              {config.label}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{config.label}</p>
        {!isConnected && state !== 'connecting' && (
          <p className="text-xs text-muted-foreground">Click to reconnect</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// Minimal dot indicator for header
export function ConnectionStatusDot({ className }: { className?: string }) {
  const { state } = useConnectionStatus();

  const colors = {
    disconnected: 'bg-gray-400',
    connecting: 'bg-blue-500 animate-pulse',
    connected: 'bg-green-500',
    reconnecting: 'bg-amber-500 animate-pulse',
    error: 'bg-red-500',
  };

  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full', colors[state], className)}
      title={state}
    />
  );
}
