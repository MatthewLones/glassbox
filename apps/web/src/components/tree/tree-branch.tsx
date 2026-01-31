'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { TreeNode } from './tree-node';
import type { Node } from '@glassbox/shared-types';

interface TreeBranchProps {
  nodes: Node[];
  level: number;
  expandedIds: Set<string>;
  selectedId: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (node: Node) => void;
  onEdit?: (node: Node) => void;
  onDelete?: (node: Node) => void;
  onAddChild?: (parentNode: Node) => void;
  onExecute?: (node: Node) => void;
  childrenMap: Map<string, Node[]>;
}

export function TreeBranch({
  nodes,
  level,
  expandedIds,
  selectedId,
  onToggle,
  onSelect,
  onEdit,
  onDelete,
  onAddChild,
  onExecute,
  childrenMap,
}: TreeBranchProps) {
  return (
    <div role="group" className="flex flex-col">
      {nodes.map((node) => {
        const children = childrenMap.get(node.id) || [];
        const hasChildren = children.length > 0;
        const isExpanded = expandedIds.has(node.id);
        const isSelected = selectedId === node.id;

        return (
          <div key={node.id}>
            <TreeNode
              node={node}
              level={level}
              isExpanded={isExpanded}
              isSelected={isSelected}
              hasChildren={hasChildren}
              onToggle={() => onToggle(node.id)}
              onSelect={() => onSelect(node)}
              onEdit={onEdit ? () => onEdit(node) : undefined}
              onDelete={onDelete ? () => onDelete(node) : undefined}
              onAddChild={onAddChild ? () => onAddChild(node) : undefined}
              onExecute={onExecute ? () => onExecute(node) : undefined}
            />

            {/* Render children if expanded */}
            {hasChildren && isExpanded && (
              <TreeBranch
                nodes={children}
                level={level + 1}
                expandedIds={expandedIds}
                selectedId={selectedId}
                onToggle={onToggle}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
                onExecute={onExecute}
                childrenMap={childrenMap}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
