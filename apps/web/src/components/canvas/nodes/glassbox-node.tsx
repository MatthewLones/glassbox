'use client';

import * as React from 'react';
import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { cn } from '@/lib/utils';
import { NodeStatusBadge } from '@/components/node/node-status-badge';
import { NodeAuthorBadge } from '@/components/node/node-author-badge';
import { Edit2, Trash2, Plus, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GlassboxNodeData } from '@/lib/canvas/canvas-utils';

function GlassboxNodeComponent({ data, selected }: NodeProps<GlassboxNodeData>) {
  const { node, onEdit, onDelete, onAddChild, onExecute } = data;
  const [showActions, setShowActions] = React.useState(false);

  return (
    <div
      className={cn(
        'relative w-[280px] rounded-lg border bg-card shadow-md transition-all',
        selected && 'ring-2 ring-primary shadow-lg',
        'hover:shadow-lg'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Input handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />

      {/* Card content */}
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-medium text-sm leading-tight line-clamp-2">
            {node.title}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <NodeAuthorBadge authorType={node.authorType} size="sm" />
          </div>
        </div>

        {/* Description */}
        {node.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {node.description}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <NodeStatusBadge status={node.status} size="sm" />
          <span className="text-xs text-muted-foreground">v{node.version}</span>
        </div>
      </div>

      {/* Action buttons (shown on hover) */}
      {showActions && (
        <div className="absolute -top-2 -right-2 flex gap-1 bg-card rounded-md shadow-md border p-1">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(node);
              }}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          )}
          {onAddChild && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(node);
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          {onExecute && node.authorType === 'agent' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onExecute(node);
              }}
            >
              <Play className="h-3 w-3" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {/* Output handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
    </div>
  );
}

export const GlassboxNode = memo(GlassboxNodeComponent);
