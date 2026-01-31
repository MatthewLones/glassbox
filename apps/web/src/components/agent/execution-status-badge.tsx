'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Clock,
  Ban,
} from 'lucide-react';
import type { AgentExecutionStatus } from '@glassbox/shared-types';

interface ExecutionStatusBadgeProps {
  status: AgentExecutionStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<
  AgentExecutionStatus,
  { icon: React.ElementType; label: string; color: string; bgColor: string }
> = {
  pending: {
    icon: Clock,
    label: 'Pending',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
  },
  running: {
    icon: Loader2,
    label: 'Running',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  paused: {
    icon: PauseCircle,
    label: 'Paused',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  complete: {
    icon: CheckCircle2,
    label: 'Complete',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  cancelled: {
    icon: Ban,
    label: 'Cancelled',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
  },
};

const sizeConfig = {
  sm: { icon: 'h-3 w-3', text: 'text-xs', padding: 'px-1.5 py-0.5' },
  md: { icon: 'h-4 w-4', text: 'text-sm', padding: 'px-2 py-1' },
  lg: { icon: 'h-5 w-5', text: 'text-base', padding: 'px-3 py-1.5' },
};

export function ExecutionStatusBadge({
  status,
  size = 'md',
  showLabel = true,
  className,
}: ExecutionStatusBadgeProps) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.bgColor,
        config.color,
        sizes.padding,
        sizes.text,
        className
      )}
    >
      <Icon
        className={cn(
          sizes.icon,
          status === 'running' && 'animate-spin'
        )}
      />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
