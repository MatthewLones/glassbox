'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TraceEvent } from './trace-event';
import { ExecutionStatusBadge } from './execution-status-badge';
import { ExecutionProgress } from './execution-progress';
import { ExecutionControls } from './execution-controls';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import type {
  AgentExecution,
  TraceEvent as TraceEventType,
  TraceEventType as EventType,
  ExecutionProgress as ProgressType,
} from '@glassbox/shared-types';

interface TraceTimelineProps {
  execution: AgentExecution;
  progress?: ProgressType;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
  className?: string;
}

const eventTypeLabels: Record<EventType, string> = {
  execution_start: 'Start',
  llm_call: 'LLM',
  tool_call: 'Tool',
  decision: 'Decision',
  human_input_requested: 'HITL Request',
  human_input_received: 'HITL Response',
  subnode_created: 'Subnode',
  output_added: 'Output',
  error: 'Error',
  checkpoint: 'Checkpoint',
  execution_complete: 'Complete',
};

export function TraceTimeline({
  execution,
  progress,
  onPause,
  onResume,
  onCancel,
  onClose,
  className,
}: TraceTimelineProps) {
  const [filters, setFilters] = React.useState<Set<EventType>>(new Set());
  const [showFilters, setShowFilters] = React.useState(false);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Filter events
  const events = execution.traceSummary || [];
  const filteredEvents = filters.size > 0
    ? events.filter((e) => filters.has(e.eventType))
    : events;

  // Auto-scroll to bottom when new events arrive
  React.useEffect(() => {
    if (autoScroll && scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [events.length, autoScroll]);

  const toggleFilter = (type: EventType) => {
    const newFilters = new Set(filters);
    if (newFilters.has(type)) {
      newFilters.delete(type);
    } else {
      newFilters.add(type);
    }
    setFilters(newFilters);
  };

  // Calculate stats
  const totalTokensIn = events.reduce((sum, e) => sum + (e.tokensIn || 0), 0);
  const totalTokensOut = events.reduce((sum, e) => sum + (e.tokensOut || 0), 0);
  const llmCalls = events.filter((e) => e.eventType === 'llm_call').length;
  const toolCalls = events.filter((e) => e.eventType === 'tool_call').length;

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Execution Trace</h2>
          <ExecutionStatusBadge status={execution.status} size="sm" />
        </div>
        <div className="flex items-center gap-2">
          <ExecutionControls
            status={execution.status}
            onPause={onPause}
            onResume={onResume}
            onCancel={onCancel}
            size="sm"
          />
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress (if running) */}
      {(execution.status === 'running' || execution.status === 'paused') && progress && (
        <div className="px-4 py-3 border-b bg-muted/30">
          <ExecutionProgress progress={progress} />
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{events.length} events</span>
          <span>{llmCalls} LLM calls</span>
          <span>{toolCalls} tool calls</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono">{totalTokensIn.toLocaleString()} in</span>
          <span className="font-mono">{totalTokensOut.toLocaleString()} out</span>
        </div>
      </div>

      {/* Filter toggle */}
      <div className="px-4 py-2 border-b">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-3.5 w-3.5" />
          <span>Filter</span>
          {showFilters ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          {filters.size > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-primary text-primary-foreground rounded text-xs">
              {filters.size}
            </span>
          )}
        </Button>

        {/* Filter chips */}
        {showFilters && (
          <div className="flex flex-wrap gap-1 mt-2">
            {(Object.keys(eventTypeLabels) as EventType[]).map((type) => (
              <button
                key={type}
                onClick={() => toggleFilter(type)}
                className={cn(
                  'px-2 py-1 text-xs rounded-full transition-colors',
                  filters.has(type)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {eventTypeLabels[type]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event, index) => (
              <TraceEvent
                key={event.id}
                event={event}
                isLast={index === filteredEvents.length - 1}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">
                {filters.size > 0 ? 'No events match filters' : 'No events yet'}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Auto-scroll toggle */}
      {execution.status === 'running' && (
        <div className="px-4 py-2 border-t bg-muted/20">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            <span>Auto-scroll to new events</span>
          </label>
        </div>
      )}

      {/* Footer with cost */}
      {execution.estimatedCostUsd > 0 && (
        <div className="px-4 py-2 border-t text-xs text-muted-foreground">
          Estimated cost: <span className="font-mono">${execution.estimatedCostUsd.toFixed(4)}</span>
        </div>
      )}
    </div>
  );
}
