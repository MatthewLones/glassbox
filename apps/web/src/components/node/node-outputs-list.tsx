'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  FileText,
  Link as LinkIcon,
  Code,
  Type,
  ExternalLink,
  Download,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NodeOutput } from '@glassbox/shared-types';

interface NodeOutputsListProps {
  outputs: NodeOutput[];
  onRemove?: (outputId: string) => void;
  onView?: (output: NodeOutput) => void;
  className?: string;
}

const OUTPUT_TYPE_ICONS = {
  file: FileText,
  structured_data: Code,
  text: Type,
  external_link: LinkIcon,
};

export function NodeOutputsList({ outputs, onRemove, onView, className }: NodeOutputsListProps) {
  if (outputs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No outputs
      </p>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {outputs.map((output) => {
        const Icon = OUTPUT_TYPE_ICONS[output.outputType] || FileText;

        return (
          <div
            key={output.id}
            className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {output.label || getOutputLabel(output)}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {output.outputType.replace('_', ' ')}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {onView && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onView(output)}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              )}
              {output.outputType === 'external_link' && output.externalUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  asChild
                >
                  <a href={output.externalUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
              {output.outputType === 'file' && output.file && (
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

function getOutputLabel(output: NodeOutput): string {
  switch (output.outputType) {
    case 'file':
      return output.file?.filename || 'File';
    case 'structured_data':
      return 'Structured data';
    case 'text':
      return output.textContent?.slice(0, 50) || 'Text content';
    case 'external_link':
      return output.externalUrl || 'External link';
    default:
      return 'Output';
  }
}
