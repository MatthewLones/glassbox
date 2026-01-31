'use client';

import * as React from 'react';
import { ReactFlowProvider } from 'reactflow';
import type { Node } from '@glassbox/shared-types';

interface CanvasContextValue {
  onNodeSelect?: (node: Node) => void;
  onNodeEdit?: (node: Node) => void;
  onNodeDelete?: (node: Node) => void;
  onNodeAddChild?: (node: Node) => void;
  onNodeExecute?: (node: Node) => void;
  onPositionChange?: (nodeId: string, position: { x: number; y: number }) => void;
}

const CanvasContext = React.createContext<CanvasContextValue>({});

export function useCanvasContext() {
  return React.useContext(CanvasContext);
}

interface CanvasProviderProps {
  children: React.ReactNode;
  onNodeSelect?: (node: Node) => void;
  onNodeEdit?: (node: Node) => void;
  onNodeDelete?: (node: Node) => void;
  onNodeAddChild?: (node: Node) => void;
  onNodeExecute?: (node: Node) => void;
  onPositionChange?: (nodeId: string, position: { x: number; y: number }) => void;
}

export function CanvasProvider({
  children,
  onNodeSelect,
  onNodeEdit,
  onNodeDelete,
  onNodeAddChild,
  onNodeExecute,
  onPositionChange,
}: CanvasProviderProps) {
  const value = React.useMemo(
    () => ({
      onNodeSelect,
      onNodeEdit,
      onNodeDelete,
      onNodeAddChild,
      onNodeExecute,
      onPositionChange,
    }),
    [onNodeSelect, onNodeEdit, onNodeDelete, onNodeAddChild, onNodeExecute, onPositionChange]
  );

  return (
    <ReactFlowProvider>
      <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
    </ReactFlowProvider>
  );
}
