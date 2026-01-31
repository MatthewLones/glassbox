'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface GraphLegendProps {
  className?: string;
}

export function GraphLegend({ className }: GraphLegendProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-3 bg-card/90 backdrop-blur-sm border rounded-lg shadow-md text-xs',
        className
      )}
    >
      <div className="font-medium text-foreground">Legend</div>

      {/* Node status */}
      <div className="space-y-1.5">
        <div className="text-muted-foreground">Status</div>
        <div className="flex flex-col gap-1">
          <LegendItem color="bg-green-500" label="Complete" />
          <LegendItem color="bg-blue-500" label="In Progress" />
          <LegendItem color="bg-amber-500" label="Review" />
          <LegendItem color="bg-muted-foreground/30" label="Draft" />
        </div>
      </div>

      {/* Author type */}
      <div className="space-y-1.5">
        <div className="text-muted-foreground">Author</div>
        <div className="flex flex-col gap-1">
          <LegendItem color="bg-blue-500" label="Human" indicator="H" />
          <LegendItem color="bg-purple-500" label="Agent" indicator="A" />
        </div>
      </div>

      {/* Connection types */}
      <div className="space-y-1.5">
        <div className="text-muted-foreground">Connections</div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-muted-foreground" />
            <span>Parent-Child</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-primary border-dashed" style={{ borderStyle: 'dashed' }} />
            <span>Dependency</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface LegendItemProps {
  color: string;
  label: string;
  indicator?: string;
}

function LegendItem({ color, label, indicator }: LegendItemProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn('w-3 h-3 rounded-full', color)}>
        {indicator && (
          <span className="flex items-center justify-center text-[8px] text-white font-medium h-full">
            {indicator}
          </span>
        )}
      </div>
      <span>{label}</span>
    </div>
  );
}
