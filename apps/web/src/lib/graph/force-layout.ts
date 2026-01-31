import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import type { Node } from '@glassbox/shared-types';

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  node: Node;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'parent-child' | 'dependency';
  label?: string;
}

export interface ForceLayoutOptions {
  width: number;
  height: number;
  linkDistance?: number;
  chargeStrength?: number;
  collideRadius?: number;
}

export function createForceLayout(
  nodes: Node[],
  options: ForceLayoutOptions
): { nodes: GraphNode[]; links: GraphLink[]; simulation: Simulation<GraphNode, GraphLink> } {
  const {
    width,
    height,
    linkDistance = 150,
    chargeStrength = -300,
    collideRadius = 80,
  } = options;

  // Create graph nodes
  const graphNodes: GraphNode[] = nodes.map((node) => ({
    id: node.id,
    node,
    x: node.position?.x ?? width / 2 + (Math.random() - 0.5) * 200,
    y: node.position?.y ?? height / 2 + (Math.random() - 0.5) * 200,
  }));

  // Create links from parent-child and dependency relationships
  const graphLinks: GraphLink[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  nodes.forEach((node) => {
    // Parent-child links
    if (node.parentId && nodeIds.has(node.parentId)) {
      graphLinks.push({
        id: `parent-${node.parentId}-${node.id}`,
        source: node.parentId,
        target: node.id,
        type: 'parent-child',
      });
    }

    // Input dependency links
    node.inputs?.forEach((input) => {
      if (input.inputType === 'node_reference' && input.sourceNodeId && nodeIds.has(input.sourceNodeId)) {
        graphLinks.push({
          id: `dep-${input.sourceNodeId}-${node.id}`,
          source: input.sourceNodeId,
          target: node.id,
          type: 'dependency',
          label: input.label,
        });
      }
    });
  });

  // Create force simulation
  const simulation = forceSimulation<GraphNode, GraphLink>(graphNodes)
    .force(
      'link',
      forceLink<GraphNode, GraphLink>(graphLinks)
        .id((d) => d.id)
        .distance(linkDistance)
    )
    .force('charge', forceManyBody().strength(chargeStrength))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide<GraphNode>().radius(collideRadius));

  return { nodes: graphNodes, links: graphLinks, simulation };
}

export function stopSimulation(simulation: Simulation<GraphNode, GraphLink>) {
  simulation.stop();
}

export function restartSimulation(
  simulation: Simulation<GraphNode, GraphLink>,
  alpha: number = 0.3
) {
  simulation.alpha(alpha).restart();
}
