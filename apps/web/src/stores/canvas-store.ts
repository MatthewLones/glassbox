import { create } from 'zustand';
import type { Viewport } from 'reactflow';

interface CanvasState {
  // Viewport
  viewport: Viewport;
  setViewport: (viewport: Viewport) => void;

  // Grid
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  setGridSize: (size: number) => void;

  // Minimap
  showMinimap: boolean;
  toggleMinimap: () => void;

  // Selection
  multiSelectEnabled: boolean;
  toggleMultiSelect: () => void;

  // Interaction mode
  interactionMode: 'pan' | 'select';
  setInteractionMode: (mode: 'pan' | 'select') => void;

  // Zoom
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  // Viewport
  viewport: { x: 0, y: 0, zoom: 1 },
  setViewport: (viewport) => set({ viewport }),

  // Grid
  showGrid: true,
  snapToGrid: true,
  gridSize: 20,
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
  setGridSize: (gridSize) => set({ gridSize }),

  // Minimap
  showMinimap: true,
  toggleMinimap: () => set((state) => ({ showMinimap: !state.showMinimap })),

  // Selection
  multiSelectEnabled: false,
  toggleMultiSelect: () =>
    set((state) => ({ multiSelectEnabled: !state.multiSelectEnabled })),

  // Interaction mode
  interactionMode: 'select',
  setInteractionMode: (interactionMode) => set({ interactionMode }),

  // Zoom
  zoomLevel: 1,
  setZoomLevel: (zoomLevel) => set({ zoomLevel }),
}));
