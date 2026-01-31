'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Lock, Unlock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

interface LockIndicatorProps {
  isLocked: boolean;
  isLockHeldByMe: boolean;
  lockHolderEmail?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function LockIndicator({
  isLocked,
  isLockHeldByMe,
  lockHolderEmail,
  size = 'md',
  className,
}: LockIndicatorProps) {
  if (!isLocked) {
    return null;
  }

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
            isLockHeldByMe
              ? 'bg-green-100 text-green-700'
              : 'bg-amber-100 text-amber-700',
            size === 'sm' ? 'text-xs' : 'text-sm',
            className
          )}
        >
          <Lock className={iconSize} />
          {isLockHeldByMe ? 'You' : 'Locked'}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isLockHeldByMe ? (
          <p>You have the edit lock</p>
        ) : (
          <p>
            Locked by <strong>{lockHolderEmail || 'another user'}</strong>
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

interface LockButtonProps {
  isLocked: boolean;
  isLockHeldByMe: boolean;
  onAcquire: () => Promise<boolean>;
  onRelease: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function LockButton({
  isLocked,
  isLockHeldByMe,
  onAcquire,
  onRelease,
  disabled = false,
  size = 'md',
  className,
}: LockButtonProps) {
  const [loading, setLoading] = React.useState(false);

  const handleClick = async () => {
    if (isLockHeldByMe) {
      onRelease();
    } else if (!isLocked) {
      setLoading(true);
      try {
        await onAcquire();
      } finally {
        setLoading(false);
      }
    }
  };

  const buttonSize = size === 'sm' ? 'h-7 px-2' : 'h-9 px-3';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  // Can't click if locked by someone else
  const isDisabled = disabled || loading || (isLocked && !isLockHeldByMe);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isLockHeldByMe ? 'default' : 'outline'}
          size="sm"
          className={cn(buttonSize, className)}
          onClick={handleClick}
          disabled={isDisabled}
        >
          {isLockHeldByMe ? (
            <>
              <Unlock className={cn(iconSize, 'mr-1')} />
              Release
            </>
          ) : (
            <>
              <Lock className={cn(iconSize, 'mr-1')} />
              {loading ? 'Locking...' : 'Edit'}
            </>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isLocked && !isLockHeldByMe
          ? 'Locked by another user'
          : isLockHeldByMe
            ? 'Click to release the edit lock'
            : 'Click to acquire the edit lock'}
      </TooltipContent>
    </Tooltip>
  );
}

interface LockWarningProps {
  show: boolean;
  lockHolderEmail?: string;
  onDismiss: () => void;
  className?: string;
}

export function LockWarning({
  show,
  lockHolderEmail,
  onDismiss,
  className,
}: LockWarningProps) {
  if (!show) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800',
        className
      )}
    >
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium">This node is being edited</p>
        <p className="text-xs text-amber-600">
          {lockHolderEmail ? (
            <>
              <strong>{lockHolderEmail}</strong> is currently editing this node.
            </>
          ) : (
            'Another user is currently editing this node.'
          )}{' '}
          Changes you make may conflict.
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}

interface LockConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lockHolderEmail?: string;
  onForceEdit?: () => void;
  onViewOnly?: () => void;
}

export function LockConflictDialog({
  open,
  onOpenChange,
  lockHolderEmail,
  onForceEdit,
  onViewOnly,
}: LockConflictDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            Node is Currently Locked
          </AlertDialogTitle>
          <AlertDialogDescription>
            {lockHolderEmail ? (
              <>
                <strong>{lockHolderEmail}</strong> is currently editing this
                node.
              </>
            ) : (
              'Another user is currently editing this node.'
            )}{' '}
            Editing simultaneously may cause conflicts.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onViewOnly}>View Only</AlertDialogCancel>
          {onForceEdit && (
            <AlertDialogAction onClick={onForceEdit}>
              Edit Anyway
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
