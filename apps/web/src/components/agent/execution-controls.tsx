'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';
import type { AgentExecutionStatus } from '@glassbox/shared-types';

interface ExecutionControlsProps {
  status: AgentExecutionStatus;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

export function ExecutionControls({
  status,
  onStart,
  onPause,
  onResume,
  onCancel,
  onRetry,
  size = 'md',
  disabled = false,
  className,
}: ExecutionControlsProps) {
  const buttonSize = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const renderButton = (
    icon: React.ReactNode,
    label: string,
    onClick?: () => void,
    variant: 'default' | 'destructive' | 'outline' | 'ghost' = 'outline'
  ) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size="icon"
          className={buttonSize}
          onClick={onClick}
          disabled={disabled || !onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Start button - shows when pending or not started */}
      {status === 'pending' &&
        renderButton(
          <Play className={iconSize} />,
          'Start Execution',
          onStart,
          'default'
        )}

      {/* Pause button - shows when running */}
      {status === 'running' &&
        renderButton(
          <Pause className={iconSize} />,
          'Pause Execution',
          onPause
        )}

      {/* Resume button - shows when paused */}
      {status === 'paused' &&
        renderButton(
          <Play className={iconSize} />,
          'Resume Execution',
          onResume,
          'default'
        )}

      {/* Cancel button - shows when running or paused */}
      {(status === 'running' || status === 'paused') &&
        renderButton(
          <Square className={iconSize} />,
          'Cancel Execution',
          onCancel,
          'destructive'
        )}

      {/* Retry button - shows when failed or cancelled */}
      {(status === 'failed' || status === 'cancelled') &&
        renderButton(
          <RotateCcw className={iconSize} />,
          'Retry Execution',
          onRetry
        )}
    </div>
  );
}

// Compact single-button control for inline use
interface ExecutionControlButtonProps {
  status: AgentExecutionStatus;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function ExecutionControlButton({
  status,
  onStart,
  onPause,
  onResume,
  size = 'md',
  className,
}: ExecutionControlButtonProps) {
  const buttonSize = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  if (status === 'running') {
    return (
      <Button
        variant="outline"
        size="icon"
        className={cn(buttonSize, className)}
        onClick={onPause}
      >
        <Pause className={iconSize} />
      </Button>
    );
  }

  if (status === 'paused') {
    return (
      <Button
        variant="default"
        size="icon"
        className={cn(buttonSize, className)}
        onClick={onResume}
      >
        <Play className={iconSize} />
      </Button>
    );
  }

  if (status === 'pending' || status === 'failed' || status === 'cancelled') {
    return (
      <Button
        variant="default"
        size="icon"
        className={cn(buttonSize, className)}
        onClick={onStart}
      >
        <Play className={iconSize} />
      </Button>
    );
  }

  return null;
}
