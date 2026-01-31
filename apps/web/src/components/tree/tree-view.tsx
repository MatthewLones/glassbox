'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { TreeBranch } from './tree-branch';
import { EmptyState } from '@/components/common/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderTree } from 'lucide-react';
import type { Node } from '@glassbox/shared-types';

interface TreeViewProps {
  nodes: Node[];
  isLoading?: boolean;
  selectedId: string | null;
  onSelect: (node: Node) => void;
  onEdit?: (node: Node) => void;
  onDelete?: (node: Node) => void;
  onAddChild?: (parentNode: Node | null) => void;
  onExecute?: (node: Node) => void;
  className?: string;
}

export function TreeView({
  nodes,
  isLoading,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onAddChild,
  onExecute,
  className,
}: TreeViewProps) {
  // Track expanded nodes
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  // Build parent-children map for efficient lookup
  const { rootNodes, childrenMap } = React.useMemo(() => {
    const childrenMap = new Map<string, Node[]>();
    const rootNodes: Node[] = [];

    // Initialize map
    nodes.forEach((node) => {
      if (!childrenMap.has(node.id)) {
        childrenMap.set(node.id, []);
      }
    });

    // Build tree structure
    nodes.forEach((node) => {
      if (node.parentId) {
        const siblings = childrenMap.get(node.parentId) || [];
        siblings.push(node);
        childrenMap.set(node.parentId, siblings);
      } else {
        rootNodes.push(node);
      }
    });

    // Sort children by position or createdAt
    childrenMap.forEach((children) => {
      children.sort((a, b) => {
        // Sort by position.y first, then by createdAt
        const posA = a.position?.y ?? 0;
        const posB = b.position?.y ?? 0;
        if (posA !== posB) return posA - posB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    });

    // Sort root nodes
    rootNodes.sort((a, b) => {
      const posA = a.position?.y ?? 0;
      const posB = b.position?.y ?? 0;
      if (posA !== posB) return posA - posB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return { rootNodes, childrenMap };
  }, [nodes]);

  // Toggle node expansion
  const handleToggle = React.useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Expand all ancestors when a node is selected
  React.useEffect(() => {
    if (selectedId) {
      const node = nodes.find((n) => n.id === selectedId);
      if (node?.parentId) {
        // Find all ancestors and expand them
        const ancestors: string[] = [];
        let current: Node | undefined = node;
        while (current?.parentId) {
          ancestors.push(current.parentId);
          current = nodes.find((n) => n.id === current?.parentId);
        }
        setExpandedIds((prev) => {
          const next = new Set(prev);
          ancestors.forEach((id) => next.add(id));
          return next;
        });
      }
    }
  }, [selectedId, nodes]);

  if (isLoading) {
    return (
      <div className={cn('space-y-2 p-2', className)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <EmptyState
        icon={FolderTree}
        title="No nodes yet"
        description="Create your first node to get started."
        action={onAddChild ? { label: 'Create node', onClick: () => onAddChild(null) } : undefined}
        className={className}
      />
    );
  }

  return (
    <div
      role="tree"
      aria-label="Node tree"
      className={cn('py-2', className)}
    >
      <TreeBranch
        nodes={rootNodes}
        level={0}
        expandedIds={expandedIds}
        selectedId={selectedId}
        onToggle={handleToggle}
        onSelect={onSelect}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddChild={onAddChild}
        onExecute={onExecute}
        childrenMap={childrenMap}
      />
    </div>
  );
}
