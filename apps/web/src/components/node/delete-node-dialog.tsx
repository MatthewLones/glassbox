'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { Node } from '@glassbox/shared-types';

interface DeleteNodeDialogProps {
  node: Node | null;
  childCount?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (nodeId: string) => Promise<void>;
}

export function DeleteNodeDialog({
  node,
  childCount = 0,
  open,
  onOpenChange,
  onConfirm,
}: DeleteNodeDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  async function handleDelete() {
    if (!node) return;

    setIsDeleting(true);
    try {
      await onConfirm(node.id);
      toast.success('Node deleted');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to delete node');
    } finally {
      setIsDeleting(false);
    }
  }

  if (!node) return null;

  const hasChildren = childCount > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete node?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              You are about to delete{' '}
              <span className="font-medium text-foreground">{node.title}</span>.
            </p>

            {hasChildren && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">
                  This node has{' '}
                  <Badge variant="destructive" className="mx-1">
                    {childCount}
                  </Badge>{' '}
                  child node{childCount > 1 ? 's' : ''} that will also be deleted.
                </p>
              </div>
            )}

            <p className="text-sm">
              This action cannot be undone. All data associated with this node will be
              permanently removed.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
