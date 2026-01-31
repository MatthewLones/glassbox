'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Circle,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
  AlertCircle,
  Eye,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  draft: { label: 'Draft', icon: Circle, color: 'text-muted-foreground' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-blue-500' },
  review: { label: 'Review', icon: Eye, color: 'text-yellow-500' },
  complete: { label: 'Complete', icon: CheckCircle2, color: 'text-green-500' },
  blocked: { label: 'Blocked', icon: XCircle, color: 'text-red-500' },
  paused: { label: 'Paused', icon: Pause, color: 'text-muted-foreground' },
};

interface StatusSelectProps {
  value: string;
  onChange: (value: string) => void;
  options?: string[];
  disabled?: boolean;
  className?: string;
}

export function StatusSelect({
  value,
  onChange,
  options = Object.keys(STATUS_CONFIG),
  disabled,
  className,
}: StatusSelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue>
          <StatusOption status={value} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((status) => (
          <SelectItem key={status} value={status}>
            <StatusOption status={status} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusOption({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || {
    label: status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    icon: Circle,
    color: 'text-muted-foreground',
  };
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('h-4 w-4', config.color)} />
      <span>{config.label}</span>
    </div>
  );
}
