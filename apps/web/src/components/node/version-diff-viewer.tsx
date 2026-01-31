'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, User, Bot, ArrowRight } from 'lucide-react';
import type { NodeVersion } from './version-history-panel';

interface VersionDiffViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionA: NodeVersion | null;
  versionB: NodeVersion | null;
}

export function VersionDiffViewer({
  open,
  onOpenChange,
  versionA,
  versionB,
}: VersionDiffViewerProps) {
  if (!versionA || !versionB) return null;

  const diffs = computeDiffs(versionA, versionB);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Compare Versions
            <Badge variant="outline">v{versionA.version}</Badge>
            <ArrowRight className="h-4 w-4" />
            <Badge variant="outline">v{versionB.version}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <VersionSummary version={versionA} label="Before" />
            <VersionSummary version={versionB} label="After" />
          </div>

          <Separator className="my-4" />

          <ScrollArea className="max-h-[400px]">
            <div className="space-y-4">
              {diffs.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No differences found
                </p>
              ) : (
                diffs.map((diff, index) => (
                  <DiffItem key={index} diff={diff} />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface VersionSummaryProps {
  version: NodeVersion;
  label: string;
}

function VersionSummary({ version, label }: VersionSummaryProps) {
  const AuthorIcon = version.authorType === 'agent' ? Bot : User;
  const formattedDate = new Date(version.createdAt).toLocaleString();

  return (
    <div className="p-3 rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {label}
        </span>
        <Badge variant="secondary">v{version.version}</Badge>
      </div>
      <p className="font-medium text-sm mb-2">{version.title}</p>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formattedDate}
        </div>
        <div className="flex items-center gap-1">
          <AuthorIcon className="h-3 w-3" />
          {version.authorName || version.authorType}
        </div>
      </div>
    </div>
  );
}

interface DiffData {
  field: string;
  oldValue: string;
  newValue: string;
  type: 'added' | 'removed' | 'changed';
}

function DiffItem({ diff }: { diff: DiffData }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="px-3 py-2 bg-muted/50 border-b">
        <span className="text-sm font-medium capitalize">{diff.field}</span>
      </div>
      <div className="grid grid-cols-2 divide-x">
        <div
          className={cn(
            'p-3 text-sm',
            diff.type === 'removed' || diff.type === 'changed'
              ? 'bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200'
              : ''
          )}
        >
          {diff.oldValue || (
            <span className="text-muted-foreground italic">(empty)</span>
          )}
        </div>
        <div
          className={cn(
            'p-3 text-sm',
            diff.type === 'added' || diff.type === 'changed'
              ? 'bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-200'
              : ''
          )}
        >
          {diff.newValue || (
            <span className="text-muted-foreground italic">(empty)</span>
          )}
        </div>
      </div>
    </div>
  );
}

function computeDiffs(versionA: NodeVersion, versionB: NodeVersion): DiffData[] {
  const diffs: DiffData[] = [];

  // Compare title
  if (versionA.title !== versionB.title) {
    diffs.push({
      field: 'title',
      oldValue: versionA.title,
      newValue: versionB.title,
      type: 'changed',
    });
  }

  // Compare description
  if (versionA.description !== versionB.description) {
    diffs.push({
      field: 'description',
      oldValue: versionA.description || '',
      newValue: versionB.description || '',
      type: !versionA.description ? 'added' : !versionB.description ? 'removed' : 'changed',
    });
  }

  // Compare status
  if (versionA.status !== versionB.status) {
    diffs.push({
      field: 'status',
      oldValue: versionA.status,
      newValue: versionB.status,
      type: 'changed',
    });
  }

  // Compare author type
  if (versionA.authorType !== versionB.authorType) {
    diffs.push({
      field: 'author type',
      oldValue: versionA.authorType,
      newValue: versionB.authorType,
      type: 'changed',
    });
  }

  return diffs;
}
