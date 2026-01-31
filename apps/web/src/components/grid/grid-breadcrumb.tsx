'use client';

import * as React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Node } from '@glassbox/shared-types';

interface BreadcrumbItem {
  id: string | null;
  title: string;
}

interface GridBreadcrumbProps {
  path: BreadcrumbItem[];
  onNavigate: (nodeId: string | null) => void;
  className?: string;
}

export function GridBreadcrumb({ path, onNavigate, className }: GridBreadcrumbProps) {
  return (
    <nav
      className={cn(
        'flex items-center gap-1 px-4 py-2 bg-card/50 backdrop-blur-sm border-b text-sm',
        className
      )}
      aria-label="Breadcrumb"
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 gap-1.5"
        onClick={() => onNavigate(null)}
      >
        <Home className="h-3.5 w-3.5" />
        <span>Root</span>
      </Button>

      {path.map((item, index) => (
        <React.Fragment key={item.id ?? 'root'}>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          {index === path.length - 1 ? (
            <span className="px-2 py-1 font-medium text-foreground truncate max-w-[200px]">
              {item.title}
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 truncate max-w-[150px]"
              onClick={() => onNavigate(item.id)}
            >
              {item.title}
            </Button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

/**
 * Build breadcrumb path from current node to root
 */
export function buildBreadcrumbPath(
  currentNodeId: string | null,
  nodes: Node[]
): BreadcrumbItem[] {
  if (!currentNodeId) return [];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const path: BreadcrumbItem[] = [];

  let current = nodeMap.get(currentNodeId);
  while (current) {
    path.unshift({ id: current.id, title: current.title });
    current = current.parentId ? nodeMap.get(current.parentId) : undefined;
  }

  return path;
}
