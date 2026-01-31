'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Circle,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
  AlertCircle,
} from 'lucide-react';

// Common workflow states
const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'glass'; icon: React.ElementType }> = {
  draft: { label: 'Draft', variant: 'glass', icon: Circle },
  in_progress: { label: 'In Progress', variant: 'info', icon: Clock },
  review: { label: 'Review', variant: 'warning', icon: AlertCircle },
  complete: { label: 'Complete', variant: 'success', icon: CheckCircle2 },
  blocked: { label: 'Blocked', variant: 'error', icon: XCircle },
  paused: { label: 'Paused', variant: 'glass', icon: Pause },
};

interface NodeStatusBadgeProps {
  status: string;
  showIcon?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

export function NodeStatusBadge({
  status,
  showIcon = true,
  size = 'default',
  className,
}: NodeStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    variant: 'glass' as const,
    icon: Circle,
  };

  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'gap-1 capitalize',
        size === 'sm' && 'text-xs px-1.5 py-0',
        className
      )}
    >
      {showIcon && <Icon className={cn('h-3 w-3', size === 'sm' && 'h-2.5 w-2.5')} />}
      {config.label}
    </Badge>
  );
}
