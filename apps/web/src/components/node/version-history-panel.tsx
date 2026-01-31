'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Clock,
  User,
  Bot,
  RotateCcw,
  ChevronRight,
  FileText,
  Edit2,
  Plus,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { toast } from 'sonner';

export interface NodeVersion {
  id: string;
  version: number;
  title: string;
  description?: string;
  status: string;
  authorType: 'human' | 'agent';
  authorId?: string;
  authorName?: string;
  createdAt: string;
  changeType: 'created' | 'updated' | 'status_change';
  changes?: {
    field: string;
    oldValue?: string;
    newValue?: string;
  }[];
}

interface VersionHistoryPanelProps {
  nodeId: string;
  currentVersion: number;
  versions: NodeVersion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRevert?: (versionId: string) => Promise<void>;
  onViewDiff?: (versionA: NodeVersion, versionB: NodeVersion) => void;
}

export function VersionHistoryPanel({
  nodeId,
  currentVersion,
  versions,
  open,
  onOpenChange,
  onRevert,
  onViewDiff,
}: VersionHistoryPanelProps) {
  const [selectedVersionId, setSelectedVersionId] = React.useState<string | null>(null);
  const [isReverting, setIsReverting] = React.useState(false);
  const [confirmRevertOpen, setConfirmRevertOpen] = React.useState(false);

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);

  async function handleRevert() {
    if (!selectedVersionId || !onRevert) return;

    setIsReverting(true);
    try {
      await onRevert(selectedVersionId);
      toast.success(`Reverted to version ${selectedVersion?.version}`);
      setConfirmRevertOpen(false);
      setSelectedVersionId(null);
    } catch (error) {
      toast.error('Failed to revert version');
    } finally {
      setIsReverting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Version History</SheetTitle>
          <SheetDescription>
            View and restore previous versions of this node.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col h-[calc(100vh-140px)]">
          <ScrollArea className="flex-1">
            <div className="space-y-1 pr-4">
              {versions.map((version, index) => {
                const isSelected = selectedVersionId === version.id;
                const isCurrent = version.version === currentVersion;
                const previousVersion = versions[index + 1];

                return (
                  <VersionItem
                    key={version.id}
                    version={version}
                    isSelected={isSelected}
                    isCurrent={isCurrent}
                    onSelect={() => setSelectedVersionId(isSelected ? null : version.id)}
                    onViewDiff={
                      previousVersion && onViewDiff
                        ? () => onViewDiff(previousVersion, version)
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </ScrollArea>

          {selectedVersion && selectedVersion.version !== currentVersion && onRevert && (
            <>
              <Separator className="my-4" />
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-muted-foreground">Selected: </span>
                  <span className="font-medium">Version {selectedVersion.version}</span>
                </div>
                <Button
                  onClick={() => setConfirmRevertOpen(true)}
                  variant="outline"
                  size="sm"
                  disabled={isReverting}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Revert to this version
                </Button>
              </div>
            </>
          )}
        </div>

        <ConfirmDialog
          open={confirmRevertOpen}
          onOpenChange={setConfirmRevertOpen}
          title="Revert to previous version?"
          description={`This will create a new version with the content from version ${selectedVersion?.version}. The current version will still be preserved in history.`}
          confirmLabel="Revert"
          onConfirm={handleRevert}
          loading={isReverting}
        />
      </SheetContent>
    </Sheet>
  );
}

interface VersionItemProps {
  version: NodeVersion;
  isSelected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
  onViewDiff?: () => void;
}

function VersionItem({
  version,
  isSelected,
  isCurrent,
  onSelect,
  onViewDiff,
}: VersionItemProps) {
  const AuthorIcon = version.authorType === 'agent' ? Bot : User;

  const changeIcon = {
    created: Plus,
    updated: Edit2,
    status_change: FileText,
  }[version.changeType];
  const ChangeIcon = changeIcon;

  const formattedDate = new Date(version.createdAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div
      className={cn(
        'p-3 rounded-lg cursor-pointer transition-colors',
        isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-muted">
            <ChangeIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">Version {version.version}</span>
              {isCurrent && (
                <Badge variant="secondary" className="text-xs">
                  Current
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{version.title}</p>
          </div>
        </div>

        {onViewDiff && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onViewDiff();
            }}
          >
            View diff
          </Button>
        )}
      </div>

      {isSelected && version.changes && version.changes.length > 0 && (
        <div className="mt-3 pl-8 space-y-1">
          {version.changes.map((change, i) => (
            <div key={i} className="text-xs">
              <span className="text-muted-foreground">{change.field}:</span>{' '}
              {change.oldValue && (
                <>
                  <span className="line-through text-red-500/70">{change.oldValue}</span>
                  <ChevronRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                </>
              )}
              <span className="text-green-600">{change.newValue}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 pl-8 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formattedDate}
        </div>
        <div className="flex items-center gap-1">
          <AuthorIcon className="h-3 w-3" />
          {version.authorName || (version.authorType === 'agent' ? 'Agent' : 'Human')}
        </div>
      </div>
    </div>
  );
}
