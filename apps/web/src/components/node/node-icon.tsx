'use client';

import { cn } from '@/lib/utils';
import {
  FileText,
  FolderOpen,
  Bot,
  CheckSquare,
  Lightbulb,
  Target,
  Layers,
  GitBranch,
} from 'lucide-react';
import type { Node } from '@glassbox/shared-types';

// Icon based on node characteristics
function getNodeIcon(node: Pick<Node, 'authorType' | 'children' | 'metadata'>) {
  // Agent-authored nodes
  if (node.authorType === 'agent') {
    return Bot;
  }

  // Nodes with children (parent nodes)
  if (node.children && node.children.length > 0) {
    return FolderOpen;
  }

  // Based on metadata tags or type
  const tags = node.metadata?.tags || [];
  if (tags.includes('task')) return CheckSquare;
  if (tags.includes('idea')) return Lightbulb;
  if (tags.includes('goal')) return Target;
  if (tags.includes('decision')) return GitBranch;

  // Default
  return FileText;
}

interface NodeIconProps {
  node: Pick<Node, 'authorType' | 'children' | 'metadata'>;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function NodeIcon({ node, size = 'default', className }: NodeIconProps) {
  const Icon = getNodeIcon(node);

  const sizeClasses = {
    sm: 'h-4 w-4',
    default: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <Icon
      className={cn(
        sizeClasses[size],
        node.authorType === 'agent' ? 'text-primary' : 'text-muted-foreground',
        className
      )}
    />
  );
}
