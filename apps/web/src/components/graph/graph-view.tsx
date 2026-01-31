'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { GraphNode } from './graph-node';
import { GraphToolbar } from './graph-toolbar';
import { GraphLegend } from './graph-legend';
import {
  createForceLayout,
  restartSimulation,
  type GraphNode as GraphNodeType,
  type GraphLink,
} from '@/lib/graph/force-layout';
import type { Node } from '@glassbox/shared-types';

interface GraphViewProps {
  nodes: Node[];
  selectedNodeId?: string;
  onNodeSelect?: (node: Node) => void;
  className?: string;
}

export function GraphView({
  nodes: glassboxNodes,
  selectedNodeId,
  onNodeSelect,
  className,
}: GraphViewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });
  const [graphNodes, setGraphNodes] = React.useState<GraphNodeType[]>([]);
  const [graphLinks, setGraphLinks] = React.useState<GraphLink[]>([]);
  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null);
  const [transform, setTransform] = React.useState({ x: 0, y: 0, scale: 1 });

  const simulationRef = React.useRef<ReturnType<typeof createForceLayout>['simulation'] | null>(null);

  // Measure container
  React.useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Initialize force simulation
  React.useEffect(() => {
    if (glassboxNodes.length === 0) return;

    const { nodes, links, simulation } = createForceLayout(glassboxNodes, {
      width: dimensions.width,
      height: dimensions.height,
    });

    simulationRef.current = simulation;
    setGraphNodes(nodes);
    setGraphLinks(links);

    // Update positions on each tick
    simulation.on('tick', () => {
      setGraphNodes([...simulation.nodes()]);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [glassboxNodes, dimensions.width, dimensions.height]);

  // Get connected node IDs for highlighting
  const connectedNodeIds = React.useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();

    const connected = new Set<string>();
    connected.add(hoveredNodeId);

    graphLinks.forEach((link) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      if (sourceId === hoveredNodeId) connected.add(targetId);
      if (targetId === hoveredNodeId) connected.add(sourceId);
    });

    return connected;
  }, [hoveredNodeId, graphLinks]);

  // Zoom handlers
  const handleZoomIn = () => {
    setTransform((t) => ({ ...t, scale: Math.min(t.scale * 1.2, 3) }));
  };

  const handleZoomOut = () => {
    setTransform((t) => ({ ...t, scale: Math.max(t.scale / 1.2, 0.3) }));
  };

  const handleFitView = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  const handleResetLayout = () => {
    if (simulationRef.current) {
      restartSimulation(simulationRef.current, 1);
    }
  };

  // Pan handling
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setTransform((t) => ({
        ...t,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => ({
      ...t,
      scale: Math.min(Math.max(t.scale * delta, 0.3), 3),
    }));
  };

  return (
    <div ref={containerRef} className={cn('relative w-full h-full bg-background', className)}>
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        <defs>
          {/* Arrow marker for parent-child */}
          <marker
            id="arrow-parent"
            viewBox="0 0 10 10"
            refX={50}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
          </marker>
          {/* Arrow marker for dependency */}
          <marker
            id="arrow-dependency"
            viewBox="0 0 10 10"
            refX={50}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-primary" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Links */}
          {graphLinks.map((link) => {
            const source = link.source as GraphNodeType;
            const target = link.target as GraphNodeType;

            if (!source.x || !source.y || !target.x || !target.y) return null;

            const isHighlighted =
              hoveredNodeId &&
              (source.id === hoveredNodeId || target.id === hoveredNodeId);
            const isDimmed = hoveredNodeId && !isHighlighted;

            return (
              <line
                key={link.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className={cn(
                  'transition-opacity',
                  link.type === 'parent-child'
                    ? 'stroke-muted-foreground'
                    : 'stroke-primary',
                  isDimmed && 'opacity-20'
                )}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
                strokeDasharray={link.type === 'dependency' ? '5,5' : undefined}
                markerEnd={
                  link.type === 'parent-child'
                    ? 'url(#arrow-parent)'
                    : 'url(#arrow-dependency)'
                }
              />
            );
          })}

          {/* Nodes */}
          {graphNodes.map((graphNode) => {
            const isHighlighted = Boolean(
              hoveredNodeId && connectedNodeIds.has(graphNode.id)
            );
            const isDimmed = Boolean(
              hoveredNodeId && !connectedNodeIds.has(graphNode.id)
            );

            return (
              <GraphNode
                key={graphNode.id}
                graphNode={graphNode}
                isSelected={graphNode.id === selectedNodeId}
                isHighlighted={isHighlighted}
                isDimmed={isDimmed}
                onClick={() => onNodeSelect?.(graphNode.node)}
                onMouseEnter={() => setHoveredNodeId(graphNode.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              />
            );
          })}
        </g>
      </svg>

      {/* Toolbar */}
      <GraphToolbar
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        onResetLayout={handleResetLayout}
        className="absolute top-4 left-1/2 -translate-x-1/2"
      />

      {/* Legend */}
      <GraphLegend className="absolute bottom-4 left-4" />

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 px-2 py-1 bg-card/90 backdrop-blur-sm border rounded-md shadow-sm text-xs font-medium">
        {Math.round(transform.scale * 100)}%
      </div>
    </div>
  );
}
