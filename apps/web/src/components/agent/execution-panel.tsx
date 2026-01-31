'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExecutionStatusBadge } from './execution-status-badge';
import { ExecutionProgress, ExecutionProgressInline } from './execution-progress';
import { ExecutionControls } from './execution-controls';
import { TraceTimeline } from './trace-timeline';
import { X, ChevronRight, Bot, Play, History } from 'lucide-react';
import type {
  AgentExecution,
  ExecutionProgress as ProgressType,
  Node,
} from '@glassbox/shared-types';
import { useExecutionStore } from '@/stores/execution-store';

interface ExecutionPanelProps {
  node: Node;
  onClose?: () => void;
  onStartExecution?: () => void;
  className?: string;
}

export function ExecutionPanel({
  node,
  onClose,
  onStartExecution,
  className,
}: ExecutionPanelProps) {
  const [showTrace, setShowTrace] = React.useState(false);
  const { executions, progressUpdates } = useExecutionStore();

  const execution = executions.get(node.id);
  const progress = progressUpdates.get(node.id);

  // If there's no execution, show the start UI
  if (!execution) {
    return (
      <Card className={cn('p-4', className)}>
        <ExecutionStartView node={node} onStart={onStartExecution} />
      </Card>
    );
  }

  // If showing trace, render full trace timeline
  if (showTrace) {
    return (
      <div className={cn('h-full flex flex-col', className)}>
        <TraceTimeline
          execution={execution}
          progress={progress}
          onClose={() => setShowTrace(false)}
          // TODO: Wire up pause/resume/cancel to actual API
          onPause={() => console.log('Pause')}
          onResume={() => console.log('Resume')}
          onCancel={() => console.log('Cancel')}
        />
      </div>
    );
  }

  // Compact execution view
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-purple-500" />
          <span className="font-medium text-sm">Agent Execution</span>
        </div>
        <div className="flex items-center gap-1">
          <ExecutionStatusBadge status={execution.status} size="sm" />
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      {progress && (execution.status === 'running' || execution.status === 'paused') && (
        <div className="mb-3">
          <ExecutionProgress progress={progress} />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <ExecutionControls
          status={execution.status}
          size="sm"
          // TODO: Wire these up
          onPause={() => console.log('Pause')}
          onResume={() => console.log('Resume')}
          onCancel={() => console.log('Cancel')}
          onRetry={onStartExecution}
        />

        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          onClick={() => setShowTrace(true)}
        >
          <History className="h-4 w-4" />
          View Trace
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats */}
      {(execution.totalTokensIn > 0 || execution.totalTokensOut > 0) && (
        <div className="mt-3 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Tokens: <span className="font-mono">{execution.totalTokensIn + execution.totalTokensOut}</span>
          </span>
          {execution.estimatedCostUsd > 0 && (
            <span>
              Cost: <span className="font-mono">${execution.estimatedCostUsd.toFixed(4)}</span>
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

interface ExecutionStartViewProps {
  node: Node;
  onStart?: () => void;
}

function ExecutionStartView({ node, onStart }: ExecutionStartViewProps) {
  const canExecute = node.authorType === 'agent';

  return (
    <div className="text-center py-4">
      <div className="flex justify-center mb-3">
        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
          <Bot className="h-6 w-6 text-purple-600" />
        </div>
      </div>

      <h3 className="font-medium text-sm mb-1">
        {canExecute ? 'Ready to Execute' : 'Human-Authored Node'}
      </h3>

      <p className="text-xs text-muted-foreground mb-4">
        {canExecute
          ? 'Run the agent to process this node and generate outputs.'
          : 'This node is authored by a human and cannot be executed by an agent.'}
      </p>

      {canExecute && onStart && (
        <Button onClick={onStart} className="gap-2">
          <Play className="h-4 w-4" />
          Start Execution
        </Button>
      )}
    </div>
  );
}

// Inline execution indicator for use in node cards/lists
interface ExecutionIndicatorProps {
  nodeId: string;
  onClick?: () => void;
  className?: string;
}

export function ExecutionIndicator({
  nodeId,
  onClick,
  className,
}: ExecutionIndicatorProps) {
  const { executions, progressUpdates } = useExecutionStore();
  const execution = executions.get(nodeId);
  const progress = progressUpdates.get(nodeId);

  if (!execution || execution.status === 'complete' || execution.status === 'cancelled') {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-colors',
        className
      )}
    >
      <ExecutionStatusBadge status={execution.status} size="sm" showLabel={false} />
      {progress && <ExecutionProgressInline progress={progress} className="w-24" />}
    </button>
  );
}
