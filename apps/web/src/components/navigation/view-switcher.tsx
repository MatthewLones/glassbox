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
import { List, LayoutGrid, Network, Box } from 'lucide-react';

export type ViewMode = 'tree' | 'canvas' | 'graph' | 'grid';

interface ViewSwitcherProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
  disabled?: ViewMode[];
}

const views: { mode: ViewMode; icon: React.ElementType; label: string; shortcut: string }[] = [
  { mode: 'tree', icon: List, label: 'Tree View', shortcut: '⌘1' },
  { mode: 'canvas', icon: Box, label: 'Canvas View', shortcut: '⌘2' },
  { mode: 'graph', icon: Network, label: 'Graph View', shortcut: '⌘3' },
  { mode: 'grid', icon: LayoutGrid, label: 'Grid View', shortcut: '⌘4' },
];

export function ViewSwitcher({ value, onChange, className, disabled = [] }: ViewSwitcherProps) {
  // Keyboard shortcuts
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.metaKey && !e.ctrlKey) return;

      const keyMap: Record<string, ViewMode> = {
        '1': 'tree',
        '2': 'canvas',
        '3': 'graph',
        '4': 'grid',
      };

      const mode = keyMap[e.key];
      if (mode && !disabled.includes(mode)) {
        e.preventDefault();
        onChange(mode);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onChange, disabled]);

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'inline-flex items-center gap-1 p-1 bg-card/90 backdrop-blur-sm border rounded-lg',
          className
        )}
      >
        {views.map(({ mode, icon: Icon, label, shortcut }) => {
          const isDisabled = disabled.includes(mode);
          const isActive = value === mode;

          return (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-8 px-3 gap-2',
                    isActive && 'bg-accent',
                    isDisabled && 'opacity-50 cursor-not-allowed'
                  )}
                  onClick={() => !isDisabled && onChange(mode)}
                  disabled={isDisabled}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">{label.split(' ')[0]}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                <div className="flex items-center gap-2">
                  <span>{label}</span>
                  <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">{shortcut}</kbd>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
