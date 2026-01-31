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
import { ZoomIn, ZoomOut, Maximize2, RefreshCw } from 'lucide-react';

interface GraphToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onResetLayout: () => void;
  className?: string;
}

export function GraphToolbar({
  onZoomIn,
  onZoomOut,
  onFitView,
  onResetLayout,
  className,
}: GraphToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'flex items-center gap-1 p-1 bg-card/90 backdrop-blur-sm border rounded-lg shadow-md',
          className
        )}
      >
        {/* Zoom controls */}
        <ToolbarButton icon={ZoomOut} tooltip="Zoom out" onClick={onZoomOut} />
        <ToolbarButton icon={ZoomIn} tooltip="Zoom in" onClick={onZoomIn} />
        <ToolbarButton icon={Maximize2} tooltip="Fit view" onClick={onFitView} />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Layout controls */}
        <ToolbarButton icon={RefreshCw} tooltip="Reset layout" onClick={onResetLayout} />
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

function ToolbarButton({ icon: Icon, tooltip, active, onClick }: ToolbarButtonProps) {
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
