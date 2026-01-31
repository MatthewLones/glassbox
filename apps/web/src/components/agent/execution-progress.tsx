'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import type { ExecutionProgress as ExecutionProgressType } from '@glassbox/shared-types';

interface ExecutionProgressProps {
  progress: ExecutionProgressType;
  className?: string;
}

export function ExecutionProgress({
  progress,
  className,
}: ExecutionProgressProps) {
  const {
    currentStep,
    stepsCompleted = 0,
    totalSteps = 0,
    tokensUsed = 0,
  } = progress;

  const percentage = totalSteps > 0 ? (stepsCompleted / totalSteps) * 100 : 0;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">
            {stepsCompleted}/{totalSteps} steps
          </span>
        </div>
        <Progress value={percentage} className="h-2" />
      </div>

      {/* Current step */}
      {currentStep && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Current:</span>
          <span className="font-medium truncate">{currentStep}</span>
        </div>
      )}

      {/* Token usage */}
      {tokensUsed > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Tokens used:</span>
          <span className="font-mono">{tokensUsed.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

// Minimal inline progress indicator for compact displays
interface ExecutionProgressInlineProps {
  progress?: ExecutionProgressType;
  className?: string;
}

export function ExecutionProgressInline({
  progress,
  className,
}: ExecutionProgressInlineProps) {
  if (!progress) return null;

  const { stepsCompleted = 0, totalSteps = 0 } = progress;
  const percentage = totalSteps > 0 ? (stepsCompleted / totalSteps) * 100 : 0;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {stepsCompleted}/{totalSteps}
      </span>
    </div>
  );
}
