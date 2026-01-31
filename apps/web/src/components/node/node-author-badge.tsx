'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { User, Bot } from 'lucide-react';
import type { AuthorType } from '@glassbox/shared-types';

interface NodeAuthorBadgeProps {
  authorType: AuthorType;
  showLabel?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

export function NodeAuthorBadge({
  authorType,
  showLabel = true,
  size = 'default',
  className,
}: NodeAuthorBadgeProps) {
  const isAgent = authorType === 'agent';
  const Icon = isAgent ? Bot : User;

  return (
    <Badge
      variant={isAgent ? 'info' : 'glass'}
      className={cn(
        'gap-1',
        size === 'sm' && 'text-xs px-1.5 py-0',
        className
      )}
    >
      <Icon className={cn('h-3 w-3', size === 'sm' && 'h-2.5 w-2.5')} />
      {showLabel && (isAgent ? 'Agent' : 'Human')}
    </Badge>
  );
}
