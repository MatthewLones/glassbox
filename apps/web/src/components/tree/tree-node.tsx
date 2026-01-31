'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NodeIcon } from '@/components/node/node-icon';
import { NodeStatusBadge } from '@/components/node/node-status-badge';
import { NodeAuthorBadge } from '@/components/node/node-author-badge';
import type { Node } from '@glassbox/shared-types';

interface TreeNodeProps {
  node: Node;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onAddChild?: () => void;
  onExecute?: () => void;
}

export function TreeNode({
  node,
  level,
  isExpanded,
  isSelected,
  hasChildren,
  onToggle,
  onSelect,
  onEdit,
  onDelete,
  onAddChild,
  onExecute,
}: TreeNodeProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
    if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
      e.preventDefault();
      onToggle();
    }
    if (e.key === 'ArrowLeft' && isExpanded) {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      tabIndex={0}
      className={cn(
        'group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
        'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary/20',
        isSelected && 'bg-primary/10 hover:bg-primary/15'
      )}
      style={{ paddingLeft: `${level * 20 + 8}px` }}
      onClick={onSelect}
      onDoubleClick={onToggle}
      onKeyDown={handleKeyDown}
    >
      {/* Expand/collapse button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-5 w-5 p-0 shrink-0',
          !hasChildren && 'invisible'
        )}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
      </Button>

      {/* Node icon */}
      <NodeIcon node={node} size="sm" />

      {/* Node title */}
      <span className="flex-1 truncate text-sm font-medium">
        {node.title}
      </span>

      {/* Badges */}
      <div className="hidden sm:flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <NodeStatusBadge status={node.status} size="sm" showIcon={false} />
        <NodeAuthorBadge authorType={node.authorType} size="sm" showLabel={false} />
      </div>

      {/* Actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {onAddChild && (
            <DropdownMenuItem onClick={onAddChild}>
              Add child node
            </DropdownMenuItem>
          )}
          {onExecute && node.authorType === 'agent' && (
            <DropdownMenuItem onClick={onExecute}>
              Execute agent
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {onEdit && (
            <DropdownMenuItem onClick={onEdit}>
              Edit
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
