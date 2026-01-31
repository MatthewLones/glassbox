'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvas-store';

interface ZoomIndicatorProps {
  className?: string;
}

export function ZoomIndicator({ className }: ZoomIndicatorProps) {
  const { zoomLevel } = useCanvasStore();
  const percentage = Math.round(zoomLevel * 100);

  return (
    <div
      className={cn(
        'px-2 py-1 bg-card/90 backdrop-blur-sm border rounded-md shadow-sm text-xs font-medium',
        className
      )}
    >
      {percentage}%
    </div>
  );
}
