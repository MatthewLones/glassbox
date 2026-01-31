'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { User, Bot } from 'lucide-react';
import type { AuthorType } from '@glassbox/shared-types';

interface AuthorSelectProps {
  value: AuthorType;
  onChange: (value: AuthorType) => void;
  disabled?: boolean;
  className?: string;
}

export function AuthorSelect({
  value,
  onChange,
  disabled,
  className,
}: AuthorSelectProps) {
  return (
    <div className={cn('flex gap-1', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('human')}
        className={cn(
          'flex-1 flex items-center justify-center gap-1.5 rounded-md border py-2 px-2 text-sm transition-all',
          value === 'human'
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-input hover:bg-muted',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <User className="h-4 w-4" />
        <span className="font-medium">Human</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('agent')}
        className={cn(
          'flex-1 flex items-center justify-center gap-1.5 rounded-md border py-2 px-2 text-sm transition-all',
          value === 'agent'
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-input hover:bg-muted',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Bot className="h-4 w-4" />
        <span className="font-medium">Agent</span>
      </button>
    </div>
  );
}
