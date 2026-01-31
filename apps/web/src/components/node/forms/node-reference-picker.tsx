'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NodeStatusBadge } from '../node-status-badge';
import { Search, Check, ChevronRight, FileText } from 'lucide-react';
import type { Node } from '@glassbox/shared-types';

interface NodeReferencePickerProps {
  nodes: Node[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  excludeIds?: string[];
  maxSelections?: number;
  className?: string;
}

export function NodeReferencePicker({
  nodes,
  selectedIds,
  onChange,
  excludeIds = [],
  maxSelections,
  className,
}: NodeReferencePickerProps) {
  const [search, setSearch] = React.useState('');

  // Filter nodes based on search and exclusions
  const filteredNodes = React.useMemo(() => {
    return nodes.filter((node) => {
      if (excludeIds.includes(node.id)) return false;
      if (!search) return true;
      return node.title.toLowerCase().includes(search.toLowerCase());
    });
  }, [nodes, excludeIds, search]);

  // Group nodes by parent for hierarchical display
  const { rootNodes, childrenMap } = React.useMemo(() => {
    const childrenMap = new Map<string, Node[]>();
    const rootNodes: Node[] = [];

    filteredNodes.forEach((node) => {
      if (node.parentId && !excludeIds.includes(node.parentId)) {
        const siblings = childrenMap.get(node.parentId) || [];
        siblings.push(node);
        childrenMap.set(node.parentId, siblings);
      } else {
        rootNodes.push(node);
      }
    });

    return { rootNodes, childrenMap };
  }, [filteredNodes, excludeIds]);

  function toggleSelection(nodeId: string) {
    if (selectedIds.includes(nodeId)) {
      onChange(selectedIds.filter((id) => id !== nodeId));
    } else if (!maxSelections || selectedIds.length < maxSelections) {
      onChange([...selectedIds, nodeId]);
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="h-[200px] border rounded-md">
        <div className="p-2">
          {filteredNodes.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No nodes found
            </div>
          ) : (
            <div className="space-y-1">
              {rootNodes.map((node) => (
                <NodePickerItem
                  key={node.id}
                  node={node}
                  childrenMap={childrenMap}
                  selectedIds={selectedIds}
                  onToggle={toggleSelection}
                  level={0}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{selectedIds.length} selected</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange([])}
            className="h-auto py-0.5 px-1.5 text-xs"
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

interface NodePickerItemProps {
  node: Node;
  childrenMap: Map<string, Node[]>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  level: number;
}

function NodePickerItem({
  node,
  childrenMap,
  selectedIds,
  onToggle,
  level,
}: NodePickerItemProps) {
  const [expanded, setExpanded] = React.useState(false);
  const children = childrenMap.get(node.id) || [];
  const hasChildren = children.length > 0;
  const isSelected = selectedIds.includes(node.id);

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors',
          isSelected ? 'bg-primary/10' : 'hover:bg-muted'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onToggle(node.id)}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5 hover:bg-muted-foreground/20 rounded"
          >
            <ChevronRight
              className={cn(
                'h-4 w-4 transition-transform',
                expanded && 'rotate-90'
              )}
            />
          </button>
        ) : (
          <span className="w-5" />
        )}

        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />

        <span className="flex-1 truncate text-sm">{node.title}</span>

        <NodeStatusBadge status={node.status} size="sm" />

        <div
          className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
            isSelected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/30'
          )}
        >
          {isSelected && <Check className="h-3 w-3" />}
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <NodePickerItem
              key={child.id}
              node={child}
              childrenMap={childrenMap}
              selectedIds={selectedIds}
              onToggle={onToggle}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
