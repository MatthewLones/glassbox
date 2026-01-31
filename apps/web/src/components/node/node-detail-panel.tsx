'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X, Edit2, Play, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NodeStatusBadge } from './node-status-badge';
import { NodeAuthorBadge } from './node-author-badge';
import { NodeInputsList } from './node-inputs-list';
import { NodeOutputsList } from './node-outputs-list';
import { NodeEvidenceList, type EvidenceItem } from './node-evidence-list';
import { PresenceAvatars } from '@/components/presence';
import { LockIndicator } from '@/components/lock';
import type { Node } from '@glassbox/shared-types';
import type { PresenceUser } from '@/lib/websocket/types';

interface NodeDetailPanelProps {
  node: Node;
  childNodes?: Node[];
  presenceUsers?: PresenceUser[];
  isLocked?: boolean;
  isLockHeldByMe?: boolean;
  lockHolderEmail?: string;
  onClose: () => void;
  onEdit?: () => void;
  onExecute?: () => void;
  onSelectNode?: (node: Node) => void;
  onAddEvidence?: () => void;
  onViewVersionHistory?: () => void;
  className?: string;
}

export function NodeDetailPanel({
  node,
  childNodes = [],
  presenceUsers = [],
  isLocked = false,
  isLockHeldByMe = false,
  lockHolderEmail,
  onClose,
  onEdit,
  onExecute,
  onSelectNode,
  onAddEvidence,
  onViewVersionHistory,
  className,
}: NodeDetailPanelProps) {
  // Build evidence list from child nodes and other sources
  const evidence = React.useMemo((): EvidenceItem[] => {
    const items: EvidenceItem[] = [];

    // Add child nodes as evidence
    childNodes.forEach((child) => {
      items.push({
        id: `subnode-${child.id}`,
        type: 'subnode',
        label: child.title,
        description: child.description,
        node: child,
        createdAt: child.createdAt,
      });
    });

    // Add files from inputs as evidence
    node.inputs?.forEach((input) => {
      if (input.inputType === 'file' && input.file) {
        items.push({
          id: `file-${input.id}`,
          type: 'file',
          label: input.label || input.file.filename,
          file: input.file,
          createdAt: input.createdAt,
        });
      }
      if (input.inputType === 'external_link' && input.externalUrl) {
        items.push({
          id: `link-${input.id}`,
          type: 'link',
          label: input.label || 'External Link',
          url: input.externalUrl,
          createdAt: input.createdAt,
        });
      }
      if (input.inputType === 'text' && input.textContent) {
        items.push({
          id: `text-${input.id}`,
          type: 'text',
          label: input.label || 'Note',
          textContent: input.textContent,
          createdAt: input.createdAt,
        });
      }
    });

    return items;
  }, [node, childNodes]);

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full border-l bg-background',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold truncate flex-1">{node.title}</h2>
            {isLocked && (
              <LockIndicator
                isLocked={isLocked}
                isLockHeldByMe={isLockHeldByMe}
                lockHolderEmail={lockHolderEmail}
                size="sm"
              />
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <NodeStatusBadge status={node.status} size="sm" />
            <NodeAuthorBadge authorType={node.authorType} size="sm" />
            {presenceUsers.length > 0 && (
              <>
                <span className="text-muted-foreground">•</span>
                <PresenceAvatars users={presenceUsers} size="sm" maxVisible={3} />
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
          {onExecute && node.authorType === 'agent' && (
            <Button variant="ghost" size="icon" onClick={onExecute}>
              <Play className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Description */}
          {node.description && (
            <div>
              <h3 className="text-sm font-medium mb-2">Description</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {node.description}
              </p>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Created</span>
              <p className="font-medium">{formatDate(node.createdAt)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Updated</span>
              <p className="font-medium">{formatDate(node.updatedAt)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Version</span>
              <div className="flex items-center gap-1">
                <p className="font-medium">v{node.version}</p>
                {onViewVersionHistory && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onViewVersionHistory}
                  >
                    <History className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            {node.metadata?.priority && (
              <div>
                <span className="text-muted-foreground">Priority</span>
                <p className="font-medium capitalize">{node.metadata.priority}</p>
              </div>
            )}
          </div>

          {/* Tags */}
          {node.metadata?.tags && node.metadata.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Tags</h3>
              <div className="flex flex-wrap gap-1">
                {node.metadata.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-muted rounded-full text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Evidence, Inputs & Outputs tabs */}
          <Tabs defaultValue="evidence" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="evidence" className="flex-1">
                Evidence ({evidence.length})
              </TabsTrigger>
              <TabsTrigger value="inputs" className="flex-1">
                Inputs ({node.inputs?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="outputs" className="flex-1">
                Outputs ({node.outputs?.length || 0})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="evidence" className="mt-4">
              <NodeEvidenceList
                evidence={evidence}
                onViewNode={onSelectNode}
                onAddEvidence={onAddEvidence}
              />
            </TabsContent>
            <TabsContent value="inputs" className="mt-4">
              <NodeInputsList inputs={node.inputs || []} />
            </TabsContent>
            <TabsContent value="outputs" className="mt-4">
              <NodeOutputsList outputs={node.outputs || []} />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
