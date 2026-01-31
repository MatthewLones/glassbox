'use client';

import * as React from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeChange,
  type Node as ReactFlowNode,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvas-store';
import { useCanvasContext } from './canvas-provider';
import { GlassboxNode } from './nodes/glassbox-node';
import { ParentChildEdge } from './edges/parent-child-edge';
import { DependencyEdge } from './edges/dependency-edge';
import { CanvasToolbar } from './controls/canvas-toolbar';
import { ZoomIndicator } from './controls/zoom-indicator';
import {
  toReactFlowNodes,
  toReactFlowEdges,
  autoLayoutNodes,
  snapToGrid,
  type GlassboxNodeData,
} from '@/lib/canvas/canvas-utils';
import type { Node } from '@glassbox/shared-types';

const nodeTypes = {
  glassbox: GlassboxNode,
};

const edgeTypes = {
  parentChild: ParentChildEdge,
  dependency: DependencyEdge,
};

interface CanvasViewProps {
  nodes: Node[];
  selectedNodeId?: string;
  className?: string;
}

export function CanvasView({ nodes: glassboxNodes, selectedNodeId, className }: CanvasViewProps) {
  const reactFlowWrapper = React.useRef<HTMLDivElement>(null);
  const { fitView, zoomIn, zoomOut, getViewport } = useReactFlow();

  const {
    showGrid,
    snapToGrid: shouldSnapToGrid,
    gridSize,
    showMinimap,
    interactionMode,
    setZoomLevel,
    setViewport,
  } = useCanvasStore();

  const {
    onNodeSelect,
    onNodeEdit,
    onNodeDelete,
    onNodeAddChild,
    onNodeExecute,
    onPositionChange,
  } = useCanvasContext();

  // Convert GlassBox nodes to ReactFlow nodes with callbacks
  const initialNodes = React.useMemo(() => {
    const rfNodes = toReactFlowNodes(glassboxNodes, selectedNodeId);
    return rfNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onEdit: onNodeEdit,
        onDelete: onNodeDelete,
        onAddChild: onNodeAddChild,
        onExecute: onNodeExecute,
      },
    }));
  }, [glassboxNodes, selectedNodeId, onNodeEdit, onNodeDelete, onNodeAddChild, onNodeExecute]);

  const initialEdges = React.useMemo(() => toReactFlowEdges(glassboxNodes), [glassboxNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when glassboxNodes change
  React.useEffect(() => {
    const rfNodes = toReactFlowNodes(glassboxNodes, selectedNodeId);
    const nodesWithCallbacks = rfNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onEdit: onNodeEdit,
        onDelete: onNodeDelete,
        onAddChild: onNodeAddChild,
        onExecute: onNodeExecute,
      },
    }));
    setNodes(nodesWithCallbacks);
    setEdges(toReactFlowEdges(glassboxNodes));
  }, [glassboxNodes, selectedNodeId, onNodeEdit, onNodeDelete, onNodeAddChild, onNodeExecute, setNodes, setEdges]);

  // Handle node position changes with snapping
  const handleNodesChange: OnNodesChange = React.useCallback(
    (changes: NodeChange[]) => {
      const processedChanges = changes.map((change) => {
        if (change.type === 'position' && change.position && shouldSnapToGrid) {
          return {
            ...change,
            position: snapToGrid(change.position, gridSize),
          };
        }
        return change;
      });

      onNodesChange(processedChanges);

      // Notify parent of position changes for persistence
      processedChanges.forEach((change) => {
        if (change.type === 'position' && change.position && !change.dragging && onPositionChange) {
          onPositionChange(change.id, change.position);
        }
      });
    },
    [onNodesChange, shouldSnapToGrid, gridSize, onPositionChange]
  );

  // Handle node selection
  const handleNodeClick = React.useCallback(
    (_: React.MouseEvent, node: ReactFlowNode<GlassboxNodeData>) => {
      onNodeSelect?.(node.data.node);
    },
    [onNodeSelect]
  );

  // Handle viewport changes
  const handleMove = React.useCallback(() => {
    const viewport = getViewport();
    setViewport(viewport);
    setZoomLevel(viewport.zoom);
  }, [getViewport, setViewport, setZoomLevel]);

  // Auto layout handler
  const handleAutoLayout = React.useCallback(() => {
    const layoutedNodes = autoLayoutNodes(glassboxNodes);
    const rfNodes = toReactFlowNodes(layoutedNodes, selectedNodeId);
    const nodesWithCallbacks = rfNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onEdit: onNodeEdit,
        onDelete: onNodeDelete,
        onAddChild: onNodeAddChild,
        onExecute: onNodeExecute,
      },
    }));
    setNodes(nodesWithCallbacks);

    // Fit view after layout with a slight delay
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 });
    }, 50);
  }, [glassboxNodes, selectedNodeId, onNodeEdit, onNodeDelete, onNodeAddChild, onNodeExecute, setNodes, fitView]);

  // Zoom handlers
  const handleZoomIn = React.useCallback(() => {
    zoomIn({ duration: 200 });
  }, [zoomIn]);

  const handleZoomOut = React.useCallback(() => {
    zoomOut({ duration: 200 });
  }, [zoomOut]);

  const handleFitView = React.useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  return (
    <div ref={reactFlowWrapper} className={cn('relative w-full h-full', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onMove={handleMove}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        panOnDrag={interactionMode === 'pan'}
        selectionOnDrag={interactionMode === 'select'}
        panOnScroll={interactionMode === 'pan'}
        zoomOnScroll
        zoomOnPinch
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        snapToGrid={shouldSnapToGrid}
        snapGrid={[gridSize, gridSize]}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        {showGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={gridSize}
            size={1}
            className="!bg-background"
          />
        )}

        {showMinimap && (
          <MiniMap
            nodeColor={(node) => {
              const data = node.data as GlassboxNodeData;
              const status = data.node.status;
              switch (status) {
                case 'complete':
                  return '#22c55e';
                case 'in_progress':
                  return '#3b82f6';
                case 'review':
                  return '#f59e0b';
                case 'draft':
                default:
                  return '#6b7280';
              }
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
            className="!bg-card/80 backdrop-blur-sm !border !rounded-lg !shadow-md"
            pannable
            zoomable
          />
        )}
      </ReactFlow>

      {/* Toolbar */}
      <CanvasToolbar
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        onAutoLayout={handleAutoLayout}
        className="absolute top-4 left-1/2 -translate-x-1/2"
      />

      {/* Zoom indicator */}
      <ZoomIndicator className="absolute bottom-4 right-4" />
    </div>
  );
}
