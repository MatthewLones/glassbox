'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  Grid3X3,
  Magnet,
  Map,
  ZoomIn,
  ZoomOut,
  Maximize2,
  MousePointer,
  Hand,
  LayoutGrid,
} from 'lucide-react';
import { useCanvasStore } from '@/stores/canvas-store';

interface CanvasToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onAutoLayout?: () => void;
  className?: string;
}

export function CanvasToolbar({
  onZoomIn,
  onZoomOut,
  onFitView,
  onAutoLayout,
  className,
}: CanvasToolbarProps) {
  const {
    showGrid,
    snapToGrid,
    showMinimap,
    interactionMode,
    toggleGrid,
    toggleSnapToGrid,
    toggleMinimap,
    setInteractionMode,
  } = useCanvasStore();

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'flex items-center gap-1 p-1 bg-card/90 backdrop-blur-sm border rounded-lg shadow-md',
          className
        )}
      >
        {/* Interaction mode */}
        <ToolbarButton
          icon={MousePointer}
          tooltip="Select mode"
          active={interactionMode === 'select'}
          onClick={() => setInteractionMode('select')}
        />
        <ToolbarButton
          icon={Hand}
          tooltip="Pan mode"
          active={interactionMode === 'pan'}
          onClick={() => setInteractionMode('pan')}
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Grid controls */}
        <ToolbarButton
          icon={Grid3X3}
          tooltip="Toggle grid"
          active={showGrid}
          onClick={toggleGrid}
        />
        <ToolbarButton
          icon={Magnet}
          tooltip="Snap to grid"
          active={snapToGrid}
          onClick={toggleSnapToGrid}
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Zoom controls */}
        <ToolbarButton icon={ZoomOut} tooltip="Zoom out" onClick={onZoomOut} />
        <ToolbarButton icon={ZoomIn} tooltip="Zoom in" onClick={onZoomIn} />
        <ToolbarButton icon={Maximize2} tooltip="Fit view" onClick={onFitView} />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* View controls */}
        <ToolbarButton
          icon={Map}
          tooltip="Toggle minimap"
          active={showMinimap}
          onClick={toggleMinimap}
        />
        {onAutoLayout && (
          <ToolbarButton
            icon={LayoutGrid}
            tooltip="Auto layout"
            onClick={onAutoLayout}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

interface ToolbarButtonProps {
  icon: React.ElementType;
  tooltip: string;
  active?: boolean;
  onClick: () => void;
}

function ToolbarButton({
  icon: Icon,
  tooltip,
  active,
  onClick,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', active && 'bg-accent')}
          onClick={onClick}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
