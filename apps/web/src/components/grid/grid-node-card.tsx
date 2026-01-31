'use client';

import * as React from 'react';
import { Folder, FileText, Bot, User, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NodeStatusBadge } from '@/components/node/node-status-badge';
import type { Node } from '@glassbox/shared-types';

interface GridNodeCardProps {
  node: Node;
  hasChildren: boolean;
  isSelected?: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onExecute?: () => void;
}

export function GridNodeCard({
  node,
  hasChildren,
  isSelected,
  onClick,
  onDoubleClick,
  onEdit,
  onDelete,
  onExecute,
}: GridNodeCardProps) {
  const Icon = hasChildren ? Folder : FileText;
  const AuthorIcon = node.authorType === 'agent' ? Bot : User;

  return (
    <div
      className={cn(
        'group relative flex flex-col p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-all',
        isSelected && 'ring-2 ring-primary bg-accent/30',
        hasChildren && 'border-l-4 border-l-primary/50'
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Actions dropdown */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                Edit
              </DropdownMenuItem>
            )}
            {onExecute && node.authorType === 'agent' && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onExecute(); }}>
                Execute
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Icon and title */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-lg shrink-0',
            hasChildren ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm leading-tight line-clamp-2 pr-6">
            {node.title}
          </h3>
          {node.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
              {node.description}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
        <div className="flex items-center gap-2">
          <NodeStatusBadge status={node.status} size="sm" />
          <div
            className={cn(
              'flex items-center justify-center w-5 h-5 rounded-full',
              node.authorType === 'agent' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'
            )}
          >
            <AuthorIcon className="h-3 w-3" />
          </div>
        </div>

        {hasChildren && (
          <div className="flex items-center text-xs text-muted-foreground">
            <span>Open</span>
            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </div>
        )}
      </div>
    </div>
  );
}
