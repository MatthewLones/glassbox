'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, X } from 'lucide-react';

interface HITLApprovalRequestProps {
  prompt: string;
  details?: string;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  className?: string;
}

export function HITLApprovalRequest({
  prompt,
  details,
  onApprove,
  onReject,
  onCancel,
  className,
}: HITLApprovalRequestProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Prompt */}
      <div className="flex gap-3">
        <div className="flex items-start justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-600 shrink-0">
          <AlertTriangle className="h-4 w-4 mt-2" />
        </div>
        <div>
          <p className="font-medium text-sm">Agent needs approval:</p>
          <p className="text-sm text-muted-foreground mt-1">{prompt}</p>
          {details && (
            <div className="mt-2 p-2 bg-muted rounded text-xs font-mono whitespace-pre-wrap">
              {details}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pl-11">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Skip
        </Button>
        <Button variant="destructive" size="sm" onClick={onReject}>
          <X className="h-4 w-4 mr-1" />
          Reject
        </Button>
        <Button variant="default" size="sm" onClick={onApprove}>
          <Check className="h-4 w-4 mr-1" />
          Approve
        </Button>
      </div>
    </div>
  );
}
