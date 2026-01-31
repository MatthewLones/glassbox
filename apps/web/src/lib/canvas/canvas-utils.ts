import type { Node as ReactFlowNode, Edge } from 'reactflow';
import type { Node } from '@glassbox/shared-types';

export interface GlassboxNodeData {
  node: Node;
  isSelected?: boolean;
  onEdit?: (node: Node) => void;
  onDelete?: (node: Node) => void;
  onAddChild?: (node: Node) => void;
  onExecute?: (node: Node) => void;
}

/**
 * Convert GlassBox nodes to Reactflow nodes
 */
export function toReactFlowNodes(
  nodes: Node[],
  selectedId?: string
): ReactFlowNode<GlassboxNodeData>[] {
  return nodes.map((node) => ({
    id: node.id,
    type: 'glassbox',
    position: node.position || { x: 0, y: 0 },
    data: {
      node,
      isSelected: node.id === selectedId,
    },
    selected: node.id === selectedId,
  }));
}

/**
 * Convert GlassBox nodes to Reactflow edges based on parent-child relationships
 */
export function toReactFlowEdges(nodes: Node[]): Edge[] {
  const edges: Edge[] = [];

  nodes.forEach((node) => {
    // Parent-child edges
    if (node.parentId) {
      edges.push({
        id: `parent-${node.parentId}-${node.id}`,
        source: node.parentId,
        target: node.id,
        type: 'parentChild',
        animated: false,
      });
    }

    // Input dependency edges (node references)
    node.inputs?.forEach((input) => {
      if (input.inputType === 'node_reference' && input.sourceNodeId) {
        edges.push({
          id: `dep-${input.sourceNodeId}-${node.id}`,
          source: input.sourceNodeId,
          target: node.id,
          type: 'dependency',
          animated: true,
          label: input.label,
        });
      }
    });
  });

  return edges;
}

/**
 * Auto-layout nodes in a tree structure
 */
export function autoLayoutNodes(nodes: Node[]): Node[] {
  const nodeMap = new Map<string, Node>();
  const childrenMap = new Map<string, Node[]>();
  const rootNodes: Node[] = [];

  // Build maps
  nodes.forEach((node) => {
    nodeMap.set(node.id, node);
    if (node.parentId) {
      const siblings = childrenMap.get(node.parentId) || [];
      siblings.push(node);
      childrenMap.set(node.parentId, siblings);
    } else {
      rootNodes.push(node);
    }
  });

  const HORIZONTAL_SPACING = 300;
  const VERTICAL_SPACING = 150;
  const positioned: Map<string, { x: number; y: number }> = new Map();

  function positionNode(node: Node, x: number, y: number): number {
    positioned.set(node.id, { x, y });

    const children = childrenMap.get(node.id) || [];
    if (children.length === 0) {
      return y;
    }

    let currentY = y;
    children.forEach((child, index) => {
      const childX = x + HORIZONTAL_SPACING;
      const childY = currentY + (index > 0 ? VERTICAL_SPACING : 0);
      const maxY = positionNode(child, childX, childY);
      currentY = Math.max(currentY, maxY);
    });

    return currentY;
  }

  let currentY = 0;
  rootNodes.forEach((root, index) => {
    const startY = currentY + (index > 0 ? VERTICAL_SPACING * 2 : 0);
    const maxY = positionNode(root, 0, startY);
    currentY = maxY;
  });

  return nodes.map((node) => ({
    ...node,
    position: positioned.get(node.id) || node.position || { x: 0, y: 0 },
  }));
}

/**
 * Snap position to grid
 */
export function snapToGrid(
  position: { x: number; y: number },
  gridSize: number = 20
): { x: number; y: number } {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  };
}
