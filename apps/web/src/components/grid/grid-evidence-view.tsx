'use client';

import * as React from 'react';
import { FileText, Link as LinkIcon, Type, Folder, ExternalLink, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Node, NodeInput, NodeOutput } from '@glassbox/shared-types';

interface GridEvidenceViewProps {
  node: Node;
  childNodes: Node[];
  onNavigateToChild: (nodeId: string) => void;
  className?: string;
}

export function GridEvidenceView({
  node,
  childNodes,
  onNavigateToChild,
  className,
}: GridEvidenceViewProps) {
  const inputs = node.inputs || [];
  const outputs = node.outputs || [];
  const hasEvidence = inputs.length > 0 || outputs.length > 0 || childNodes.length > 0;

  if (!hasEvidence) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 text-muted-foreground', className)}>
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm font-medium">No evidence yet</p>
        <p className="text-xs mt-1">Add inputs, outputs, or subnodes to this node</p>
      </div>
    );
  }

  return (
    <div className={cn('p-6 space-y-8', className)}>
      {/* Subnodes section */}
      {childNodes.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Folder className="h-4 w-4" />
            Subnodes ({childNodes.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {childNodes.map((child) => (
              <button
                key={child.id}
                onClick={() => onNavigateToChild(child.id)}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 text-left transition-colors"
              >
                <Folder className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{child.title}</p>
                  {child.description && (
                    <p className="text-xs text-muted-foreground truncate">{child.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Inputs section */}
      {inputs.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Inputs ({inputs.length})
          </h3>
          <div className="space-y-2">
            {inputs.map((input) => (
              <EvidenceItem key={input.id} type="input" item={input} />
            ))}
          </div>
        </section>
      )}

      {/* Outputs section */}
      {outputs.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Outputs ({outputs.length})
          </h3>
          <div className="space-y-2">
            {outputs.map((output) => (
              <EvidenceItem key={output.id} type="output" item={output} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface EvidenceItemProps {
  type: 'input' | 'output';
  item: NodeInput | NodeOutput;
}

function EvidenceItem({ type, item }: EvidenceItemProps) {
  const isInput = type === 'input';
  const inputItem = isInput ? (item as NodeInput) : null;
  const outputItem = !isInput ? (item as NodeOutput) : null;

  const itemType = isInput ? inputItem?.inputType : outputItem?.outputType;
  const label = item.label || 'Untitled';

  const getIcon = () => {
    switch (itemType) {
      case 'file':
        return FileText;
      case 'external_link':
        return ExternalLink;
      case 'text':
        return Type;
      case 'node_reference':
        return Folder;
      case 'structured_data':
        return FileText;
      default:
        return FileText;
    }
  };

  const Icon = getIcon();

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card/50">
      <div className="flex items-center justify-center w-8 h-8 rounded bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground capitalize">{itemType?.replace('_', ' ')}</p>
      </div>
      {itemType === 'external_link' && inputItem?.externalUrl && (
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <a href={inputItem.externalUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      )}
      {itemType === 'file' && (
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Download className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
