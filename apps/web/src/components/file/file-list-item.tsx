'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilePreview, formatFileSize, getFileExtension } from './file-preview';
import { MoreVertical, Download, ExternalLink, Trash2 } from 'lucide-react';

export interface FileItem {
  id: string;
  fileName: string;
  fileType: string;
  size: number;
  url?: string;
  createdAt?: string;
}

interface FileListItemProps {
  file: FileItem;
  onDownload?: (file: FileItem) => void;
  onOpen?: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
  showActions?: boolean;
  className?: string;
}

export function FileListItem({
  file,
  onDownload,
  onOpen,
  onDelete,
  showActions = true,
  className,
}: FileListItemProps) {
  const extension = getFileExtension(file.fileName);
  const sizeText = formatFileSize(file.size);

  const handleDownload = React.useCallback(() => {
    if (onDownload) {
      onDownload(file);
    } else if (file.url) {
      // Default download behavior
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [file, onDownload]);

  const handleOpen = React.useCallback(() => {
    if (onOpen) {
      onOpen(file);
    } else if (file.url) {
      window.open(file.url, '_blank');
    }
  }, [file, onOpen]);

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group',
        className
      )}
    >
      <FilePreview
        fileName={file.fileName}
        fileType={file.fileType}
        url={file.url}
        size="sm"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.fileName}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {extension && <span className="uppercase">{extension}</span>}
          {extension && <span>·</span>}
          <span>{sizeText}</span>
        </div>
      </div>

      {showActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {file.url && (
              <>
                <DropdownMenuItem onClick={handleOpen}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </DropdownMenuItem>
              </>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(file)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

interface FileListProps {
  files: FileItem[];
  onDownload?: (file: FileItem) => void;
  onOpen?: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
  showActions?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function FileList({
  files,
  onDownload,
  onOpen,
  onDelete,
  showActions = true,
  emptyMessage = 'No files',
  className,
}: FileListProps) {
  if (files.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground text-sm', className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {files.map((file) => (
        <FileListItem
          key={file.id}
          file={file}
          onDownload={onDownload}
          onOpen={onOpen}
          onDelete={onDelete}
          showActions={showActions}
        />
      ))}
    </div>
  );
}
