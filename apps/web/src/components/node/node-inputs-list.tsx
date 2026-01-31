'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  FileText,
  Link as LinkIcon,
  GitBranch,
  Type,
  ExternalLink,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NodeInput } from '@glassbox/shared-types';

interface NodeInputsListProps {
  inputs: NodeInput[];
  onRemove?: (inputId: string) => void;
  className?: string;
}

const INPUT_TYPE_ICONS = {
  file: FileText,
  node_reference: GitBranch,
  external_link: LinkIcon,
  text: Type,
};

export function NodeInputsList({ inputs, onRemove, className }: NodeInputsListProps) {
  if (inputs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No inputs
      </p>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {inputs.map((input) => {
        const Icon = INPUT_TYPE_ICONS[input.inputType] || FileText;

        return (
          <div
            key={input.id}
            className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {input.label || getInputLabel(input)}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {input.inputType.replace('_', ' ')}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {input.inputType === 'external_link' && input.externalUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  asChild
                >
                  <a href={input.externalUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
              {input.inputType === 'file' && input.file && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getInputLabel(input: NodeInput): string {
  switch (input.inputType) {
    case 'file':
      return input.file?.filename || 'File';
    case 'node_reference':
      return input.sourceNode?.title || 'Referenced node';
    case 'external_link':
      return input.externalUrl || 'External link';
    case 'text':
      return input.textContent?.slice(0, 50) || 'Text content';
    default:
      return 'Input';
  }
}
