'use client';

import * as React from 'react';
import { Plus, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GridBreadcrumb, buildBreadcrumbPath } from './grid-breadcrumb';
import { GridNodeCard } from './grid-node-card';
import { GridEvidenceView } from './grid-evidence-view';
import type { Node } from '@glassbox/shared-types';

interface GridViewProps {
  nodes: Node[];
  selectedNodeId?: string;
  onNodeSelect?: (node: Node) => void;
  onNodeEdit?: (node: Node) => void;
  onNodeDelete?: (node: Node) => void;
  onNodeExecute?: (node: Node) => void;
  onAddNode?: (parentId: string | null) => void;
  className?: string;
}

export function GridView({
  nodes,
  selectedNodeId,
  onNodeSelect,
  onNodeEdit,
  onNodeDelete,
  onNodeExecute,
  onAddNode,
  className,
}: GridViewProps) {
  // Current folder being viewed (null = root level)
  const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(null);

  // Build maps for efficient lookup
  const nodeMap = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const childrenMap = React.useMemo(() => {
    const map = new Map<string | null, Node[]>();
    map.set(null, []); // Root level

    nodes.forEach((node) => {
      const parentId = node.parentId || null;
      const siblings = map.get(parentId) || [];
      siblings.push(node);
      map.set(parentId, siblings);
    });

    return map;
  }, [nodes]);

  // Get current node and its children
  const currentNode = currentFolderId ? nodeMap.get(currentFolderId) : null;
  const currentChildren = childrenMap.get(currentFolderId) || [];

  // Check if each node has children
  const hasChildrenMap = React.useMemo(() => {
    const map = new Map<string, boolean>();
    nodes.forEach((node) => {
      const children = childrenMap.get(node.id) || [];
      map.set(node.id, children.length > 0);
    });
    return map;
  }, [nodes, childrenMap]);

  // Build breadcrumb path
  const breadcrumbPath = React.useMemo(
    () => buildBreadcrumbPath(currentFolderId, nodes),
    [currentFolderId, nodes]
  );

  // Navigate to a folder
  const handleNavigate = (nodeId: string | null) => {
    setCurrentFolderId(nodeId);
  };

  // Handle card click (select)
  const handleCardClick = (node: Node) => {
    onNodeSelect?.(node);
  };

  // Handle card double-click (navigate into)
  const handleCardDoubleClick = (node: Node) => {
    // Navigate into the node
    setCurrentFolderId(node.id);
    onNodeSelect?.(node);
  };

  // Determine if we should show evidence view
  // Show evidence view when:
  // 1. We're viewing a specific node (currentFolderId is set)
  // 2. AND that node has no children (it's a leaf node)
  const showEvidenceView = currentNode && currentChildren.length === 0;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Breadcrumb navigation */}
      <GridBreadcrumb path={breadcrumbPath} onNavigate={handleNavigate} />

      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {showEvidenceView ? (
          // Evidence view for leaf nodes
          <GridEvidenceView
            node={currentNode}
            childNodes={[]}
            onNavigateToChild={handleNavigate}
          />
        ) : (
          // Grid of children
          <div className="p-6">
            {currentChildren.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {currentChildren.map((node) => (
                  <GridNodeCard
                    key={node.id}
                    node={node}
                    hasChildren={hasChildrenMap.get(node.id) || false}
                    isSelected={node.id === selectedNodeId}
                    onClick={() => handleCardClick(node)}
                    onDoubleClick={() => handleCardDoubleClick(node)}
                    onEdit={onNodeEdit ? () => onNodeEdit(node) : undefined}
                    onDelete={onNodeDelete ? () => onNodeDelete(node) : undefined}
                    onExecute={onNodeExecute ? () => onNodeExecute(node) : undefined}
                  />
                ))}
              </div>
            ) : (
              // Empty state
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm font-medium">
                  {currentFolderId ? 'No subnodes' : 'No nodes yet'}
                </p>
                <p className="text-xs mt-1 mb-4">
                  {currentFolderId
                    ? 'Add subnodes to organize your work'
                    : 'Create your first node to get started'}
                </p>
                {onAddNode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddNode(currentFolderId)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add {currentFolderId ? 'Subnode' : 'Node'}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Current folder info bar (when inside a node) */}
      {currentNode && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-t text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{currentChildren.length} items</span>
            {currentNode.description && (
              <>
                <span>•</span>
                <span className="truncate max-w-[300px]">{currentNode.description}</span>
              </>
            )}
          </div>
          {onAddNode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddNode(currentFolderId)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
