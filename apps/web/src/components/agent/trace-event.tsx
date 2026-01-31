'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Play,
  Brain,
  Wrench,
  HelpCircle,
  MessageSquare,
  GitBranch,
  FileOutput,
  AlertCircle,
  Bookmark,
  CheckCircle2,
} from 'lucide-react';
import type { TraceEvent as TraceEventType, TraceEventType as EventType } from '@glassbox/shared-types';

interface TraceEventProps {
  event: TraceEventType;
  isLast?: boolean;
  className?: string;
}

const eventConfig: Record<
  EventType,
  { icon: React.ElementType; label: string; color: string }
> = {
  execution_start: {
    icon: Play,
    label: 'Started',
    color: 'text-blue-500',
  },
  llm_call: {
    icon: Brain,
    label: 'LLM Call',
    color: 'text-purple-500',
  },
  tool_call: {
    icon: Wrench,
    label: 'Tool Call',
    color: 'text-orange-500',
  },
  decision: {
    icon: GitBranch,
    label: 'Decision',
    color: 'text-cyan-500',
  },
  human_input_requested: {
    icon: HelpCircle,
    label: 'Input Requested',
    color: 'text-amber-500',
  },
  human_input_received: {
    icon: MessageSquare,
    label: 'Input Received',
    color: 'text-green-500',
  },
  subnode_created: {
    icon: GitBranch,
    label: 'Subnode Created',
    color: 'text-indigo-500',
  },
  output_added: {
    icon: FileOutput,
    label: 'Output Added',
    color: 'text-emerald-500',
  },
  error: {
    icon: AlertCircle,
    label: 'Error',
    color: 'text-red-500',
  },
  checkpoint: {
    icon: Bookmark,
    label: 'Checkpoint',
    color: 'text-gray-500',
  },
  execution_complete: {
    icon: CheckCircle2,
    label: 'Completed',
    color: 'text-green-600',
  },
};

export function TraceEvent({ event, isLast = false, className }: TraceEventProps) {
  const config = eventConfig[event.eventType];
  const Icon = config.icon;
  const eventData = event.eventData || {};

  // Format timestamp
  const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Format duration
  const duration = event.durationMs
    ? event.durationMs < 1000
      ? `${event.durationMs}ms`
      : `${(event.durationMs / 1000).toFixed(1)}s`
    : null;

  return (
    <div className={cn('relative flex gap-3', className)}>
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-8 bottom-0 w-px bg-border" />
      )}

      {/* Icon */}
      <div
        className={cn(
          'relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-background border-2',
          config.color.replace('text-', 'border-')
        )}
      >
        <Icon className={cn('h-4 w-4', config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{config.label}</span>
          <span className="text-xs text-muted-foreground">{time}</span>
          {duration && (
            <span className="text-xs text-muted-foreground font-mono">
              ({duration})
            </span>
          )}
        </div>

        {/* Event-specific content */}
        <TraceEventContent event={event} />

        {/* Token usage */}
        {(event.tokensIn || event.tokensOut) && (
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {event.tokensIn && (
              <span>
                <span className="font-mono">{event.tokensIn}</span> tokens in
              </span>
            )}
            {event.tokensOut && (
              <span>
                <span className="font-mono">{event.tokensOut}</span> tokens out
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface TraceEventContentProps {
  event: TraceEventType;
}

// Helper to safely get string from event data
function getEventDataString(data: Record<string, unknown>, key: string): string | null {
  if (key in data && data[key]) {
    return String(data[key]);
  }
  return null;
}

function TraceEventContent({ event }: TraceEventContentProps) {
  const data = event.eventData || {};

  switch (event.eventType) {
    case 'llm_call': {
      const prompt = getEventDataString(data, 'prompt');
      const response = getEventDataString(data, 'response');
      return (
        <div className="mt-1 space-y-1">
          {event.model && (
            <p className="text-xs text-muted-foreground">
              Model: <span className="font-mono">{event.model}</span>
            </p>
          )}
          {prompt && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {prompt}
            </p>
          )}
          {response && (
            <div className="mt-1 p-2 bg-muted/50 rounded text-sm line-clamp-3">
              {response}
            </div>
          )}
        </div>
      );
    }

    case 'tool_call': {
      const tool = getEventDataString(data, 'tool');
      const hasArgs = 'args' in data && data.args !== null && data.args !== undefined;
      const hasResult = 'result' in data && data.result !== null && data.result !== undefined;
      return (
        <div className="mt-1 space-y-1">
          {tool && (
            <p className="text-sm">
              <span className="font-mono text-orange-600">{tool}</span>
            </p>
          )}
          {hasArgs && (
            <pre className="mt-1 p-2 bg-muted/50 rounded text-xs overflow-x-auto">
              {JSON.stringify(data.args, null, 2)}
            </pre>
          )}
          {hasResult && (
            <div className="mt-1 p-2 bg-green-50 rounded text-xs">
              Result: {typeof data.result === 'string' ? String(data.result) : JSON.stringify(data.result)}
            </div>
          )}
        </div>
      );
    }

    case 'human_input_requested': {
      const prompt = getEventDataString(data, 'prompt');
      return (
        <div className="mt-1">
          {prompt && (
            <p className="text-sm text-amber-700 bg-amber-50 p-2 rounded">
              {prompt}
            </p>
          )}
        </div>
      );
    }

    case 'human_input_received': {
      const input = getEventDataString(data, 'input');
      return (
        <div className="mt-1">
          {input && (
            <p className="text-sm text-green-700 bg-green-50 p-2 rounded">
              {input}
            </p>
          )}
        </div>
      );
    }

    case 'error': {
      const message = getEventDataString(data, 'message');
      return (
        <div className="mt-1">
          {message && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {message}
            </p>
          )}
        </div>
      );
    }

    case 'subnode_created': {
      const title = getEventDataString(data, 'title');
      return (
        <div className="mt-1">
          {title && (
            <p className="text-sm text-indigo-600">
              Created: <span className="font-medium">{title}</span>
            </p>
          )}
        </div>
      );
    }

    case 'output_added': {
      const label = getEventDataString(data, 'label');
      return (
        <div className="mt-1">
          {label && (
            <p className="text-sm text-emerald-600">
              {label}
            </p>
          )}
        </div>
      );
    }

    case 'decision': {
      const decision = getEventDataString(data, 'decision');
      return (
        <div className="mt-1">
          {decision && (
            <p className="text-sm">{decision}</p>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
