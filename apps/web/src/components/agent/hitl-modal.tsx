'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HITLInputRequest } from './hitl-input-request';
import { HITLApprovalRequest } from './hitl-approval-request';
import { useExecutionStore, type HITLRequest } from '@/stores/execution-store';
import { Bell, Bot } from 'lucide-react';

interface HITLModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HITLModal({ open, onOpenChange }: HITLModalProps) {
  const { hitlRequests, removeHITLRequest } = useExecutionStore();

  const handleResponse = (requestId: string, response: string | boolean) => {
    // TODO: Send response to backend via WebSocket or API
    console.log('HITL Response:', { requestId, response });
    removeHITLRequest(requestId);
  };

  const handleDismiss = (requestId: string) => {
    removeHITLRequest(requestId);
  };

  // Auto-close when no requests
  React.useEffect(() => {
    if (hitlRequests.length === 0 && open) {
      onOpenChange(false);
    }
  }, [hitlRequests.length, open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-500" />
            Agent Needs Input
            {hitlRequests.length > 1 && (
              <Badge variant="secondary">{hitlRequests.length}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            The agent is waiting for your input to continue execution.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-4 pr-4">
            {hitlRequests.map((request, index) => (
              <HITLRequestCard
                key={request.id}
                request={request}
                onRespond={(response) => handleResponse(request.id, response)}
                onDismiss={() => handleDismiss(request.id)}
                isFirst={index === 0}
              />
            ))}

            {hitlRequests.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mb-2 opacity-50" />
                <p className="text-sm">No pending requests</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface HITLRequestCardProps {
  request: HITLRequest;
  onRespond: (response: string | boolean) => void;
  onDismiss: () => void;
  isFirst: boolean;
}

function HITLRequestCard({
  request,
  onRespond,
  onDismiss,
  isFirst,
}: HITLRequestCardProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg border',
        isFirst ? 'bg-amber-50 border-amber-200' : 'bg-card'
      )}
    >
      {request.type === 'input' ? (
        <HITLInputRequest
          prompt={request.prompt}
          options={request.options}
          onSubmit={(value) => onRespond(value)}
          onCancel={onDismiss}
        />
      ) : (
        <HITLApprovalRequest
          prompt={request.prompt}
          onApprove={() => onRespond(true)}
          onReject={() => onRespond(false)}
          onCancel={onDismiss}
        />
      )}

      <div className="mt-2 text-xs text-muted-foreground">
        {new Date(request.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

// Button to open HITL modal (shows count badge)
interface HITLNotificationButtonProps {
  onClick: () => void;
  className?: string;
}

export function HITLNotificationButton({
  onClick,
  className,
}: HITLNotificationButtonProps) {
  const hitlRequests = useExecutionStore((s) => s.hitlRequests);

  if (hitlRequests.length === 0) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn('relative gap-2', className)}
    >
      <Bell className="h-4 w-4 text-amber-500" />
      <span>Agent Needs Input</span>
      <Badge
        variant="destructive"
        className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center"
      >
        {hitlRequests.length}
      </Badge>
    </Button>
  );
}
