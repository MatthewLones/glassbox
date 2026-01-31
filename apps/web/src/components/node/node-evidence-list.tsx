'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  FileText,
  Link as LinkIcon,
  GitBranch,
  Type,
  Image,
  ExternalLink,
  Download,
  Eye,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NodeIcon } from './node-icon';
import type { Node, NodeInput, File as FileType } from '@glassbox/shared-types';

// Evidence can come from multiple sources
export interface EvidenceItem {
  id: string;
  type: 'subnode' | 'file' | 'link' | 'text' | 'image';
  label: string;
  description?: string;
  // Type-specific data
  node?: Node;
  file?: FileType;
  url?: string;
  textContent?: string;
  createdAt: string;
}

interface NodeEvidenceListProps {
  evidence: EvidenceItem[];
  onViewNode?: (node: Node) => void;
  onViewFile?: (file: FileType) => void;
  onAddEvidence?: () => void;
  className?: string;
}

const EVIDENCE_TYPE_ICONS = {
  subnode: GitBranch,
  file: FileText,
  link: LinkIcon,
  text: Type,
  image: Image,
};

export function NodeEvidenceList({
  evidence,
  onViewNode,
  onViewFile,
  onAddEvidence,
  className,
}: NodeEvidenceListProps) {
  if (evidence.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground mb-3">
          No evidence attached
        </p>
        {onAddEvidence && (
          <Button variant="outline" size="sm" onClick={onAddEvidence}>
            Add evidence
          </Button>
        )}
      </div>
    );
  }

  // Group evidence by type
  const grouped = evidence.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, EvidenceItem[]>);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Subnodes first - these are special */}
      {grouped.subnode && grouped.subnode.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Supporting Nodes ({grouped.subnode.length})
          </h4>
          <div className="space-y-1">
            {grouped.subnode.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => item.node && onViewNode?.(item.node)}
              >
                {item.node && <NodeIcon node={item.node} size="sm" />}
                <span className="flex-1 text-sm font-medium truncate">
                  {item.label}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      {grouped.file && grouped.file.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Files ({grouped.file.length})
          </h4>
          <div className="space-y-1">
            {grouped.file.map((item) => (
              <EvidenceFileItem
                key={item.id}
                item={item}
                onView={() => item.file && onViewFile?.(item.file)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Links */}
      {grouped.link && grouped.link.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Links ({grouped.link.length})
          </h4>
          <div className="space-y-1">
            {grouped.link.map((item) => (
              <EvidenceLinkItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Text snippets */}
      {grouped.text && grouped.text.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Notes ({grouped.text.length})
          </h4>
          <div className="space-y-1">
            {grouped.text.map((item) => (
              <EvidenceTextItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Add more button */}
      {onAddEvidence && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onAddEvidence}
        >
          Add evidence
        </Button>
      )}
    </div>
  );
}

function EvidenceFileItem({ item, onView }: { item: EvidenceItem; onView?: () => void }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background">
        <FileText className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.label}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {onView && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onView}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function EvidenceLinkItem({ item }: { item: EvidenceItem }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background">
        <LinkIcon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.label}</p>
        {item.url && (
          <p className="text-xs text-muted-foreground truncate">{item.url}</p>
        )}
      </div>
      {item.url && (
        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      )}
    </div>
  );
}

function EvidenceTextItem({ item }: { item: EvidenceItem }) {
  const [expanded, setExpanded] = React.useState(false);
  const isLong = (item.textContent?.length || 0) > 150;

  return (
    <div className="p-3 rounded-lg border bg-muted/30">
      <p className="text-sm font-medium mb-1">{item.label}</p>
      <p className={cn('text-sm text-muted-foreground', !expanded && isLong && 'line-clamp-3')}>
        {item.textContent}
      </p>
      {isLong && (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 mt-1"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </div>
  );
}
