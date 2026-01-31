'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { NodeStatusBadge } from '@/components/node/node-status-badge';
import { NodeAuthorBadge } from '@/components/node/node-author-badge';
import type { GraphNode as GraphNodeType } from '@/lib/graph/force-layout';

interface GraphNodeProps {
  graphNode: GraphNodeType;
  isSelected?: boolean;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function GraphNode({
  graphNode,
  isSelected,
  isHighlighted,
  isDimmed,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: GraphNodeProps) {
  const { node } = graphNode;
  const x = graphNode.x ?? 0;
  const y = graphNode.y ?? 0;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="cursor-pointer"
      style={{ opacity: isDimmed ? 0.3 : 1 }}
    >
      {/* Background circle */}
      <circle
        r={40}
        className={cn(
          'fill-card stroke-border transition-all',
          isSelected && 'stroke-primary stroke-2',
          isHighlighted && 'stroke-primary/50 stroke-2'
        )}
      />

      {/* Status indicator ring */}
      <circle
        r={44}
        fill="none"
        strokeWidth={3}
        className={cn(
          'transition-colors',
          node.status === 'complete' && 'stroke-green-500',
          node.status === 'in_progress' && 'stroke-blue-500',
          node.status === 'review' && 'stroke-amber-500',
          node.status === 'draft' && 'stroke-muted-foreground/30'
        )}
      />

      {/* Author type indicator */}
      <circle
        cx={28}
        cy={-28}
        r={10}
        className={cn(
          'transition-colors',
          node.authorType === 'agent' ? 'fill-purple-500' : 'fill-blue-500'
        )}
      />
      <text
        x={28}
        y={-24}
        textAnchor="middle"
        className="text-[10px] fill-white font-medium pointer-events-none"
      >
        {node.authorType === 'agent' ? 'A' : 'H'}
      </text>

      {/* Title (truncated) */}
      <text
        y={4}
        textAnchor="middle"
        className="text-xs font-medium fill-foreground pointer-events-none"
      >
        {node.title.length > 12 ? `${node.title.slice(0, 10)}...` : node.title}
      </text>

      {/* Version */}
      <text
        y={18}
        textAnchor="middle"
        className="text-[10px] fill-muted-foreground pointer-events-none"
      >
        v{node.version}
      </text>
    </g>
  );
}
