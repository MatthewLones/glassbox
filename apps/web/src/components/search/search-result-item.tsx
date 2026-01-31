'use client';

import * as React from 'react';
import { FileText, FolderKanban, Paperclip, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SearchResultItemProps {
  id: string;
  type: 'node' | 'project' | 'file';
  title: string;
  description?: string;
  status?: string;
  authorType?: 'human' | 'agent';
  projectName?: string;
  matchedField?: string;
  className?: string;
}

const typeIcons = {
  node: FileText,
  project: FolderKanban,
  file: Paperclip,
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-yellow-100 text-yellow-700',
  complete: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
};

export function SearchResultItem({
  type,
  title,
  description,
  status,
  authorType,
  projectName,
  matchedField,
  className,
}: SearchResultItemProps) {
  const Icon = typeIcons[type];
  const AuthorIcon = authorType === 'agent' ? Bot : User;

  return (
    <div className={cn('flex items-start gap-3 py-1', className)}>
      <div className="shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{title}</span>
          {authorType && (
            <AuthorIcon className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          {projectName && (
            <span className="text-xs text-muted-foreground">{projectName}</span>
          )}
          {status && (
            <Badge variant="secondary" className={cn('text-xs py-0', statusColors[status])}>
              {status.replace('_', ' ')}
            </Badge>
          )}
          {matchedField && (
            <span className="text-xs text-muted-foreground italic">
              matched in {matchedField}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function SearchResultSkeleton() {
  return (
    <div className="flex items-start gap-3 py-1 animate-pulse">
      <div className="shrink-0 mt-0.5">
        <div className="h-4 w-4 rounded bg-muted" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
    </div>
  );
}
