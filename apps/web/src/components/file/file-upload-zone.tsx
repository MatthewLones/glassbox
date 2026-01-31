'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { UploadProgress } from '@/hooks/use-file-upload';

interface FileUploadZoneProps {
  onFilesSelected: (files: FileList) => void;
  uploads: UploadProgress[];
  onCancelUpload?: (fileId: string) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

export function FileUploadZone({
  onFilesSelected,
  uploads,
  onCancelUpload,
  accept = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif',
  multiple = true,
  maxFiles = 10,
  disabled = false,
  className,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        if (!multiple && files.length > 1) {
          // Create a new FileList with only the first file
          const dt = new DataTransfer();
          dt.items.add(files[0]);
          onFilesSelected(dt.files);
        } else if (files.length > maxFiles) {
          // Limit to maxFiles
          const dt = new DataTransfer();
          for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
            dt.items.add(files[i]);
          }
          onFilesSelected(dt.files);
        } else {
          onFilesSelected(files);
        }
      }
    },
    [disabled, multiple, maxFiles, onFilesSelected]
  );

  const handleClick = React.useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const handleFileChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFilesSelected(files);
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [onFilesSelected]
  );

  const hasUploads = uploads.length > 0;

  return (
    <div className={cn('space-y-4', className)}>
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer',
          isDragging && 'border-primary bg-primary/5',
          !isDragging && !disabled && 'hover:border-primary/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange}
          disabled={disabled}
        />

        <div className="flex flex-col items-center text-center">
          <Upload
            className={cn(
              'h-10 w-10 mb-3',
              isDragging ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <p className="text-sm font-medium">
            {isDragging ? 'Drop files here' : 'Click to upload or drag and drop'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, DOCX, TXT, images up to 10MB
          </p>
          {multiple && (
            <p className="text-xs text-muted-foreground">
              Up to {maxFiles} files at a time
            </p>
          )}
        </div>
      </div>

      {hasUploads && (
        <div className="space-y-2">
          {uploads.map((upload) => (
            <UploadProgressItem
              key={upload.fileId}
              upload={upload}
              onCancel={onCancelUpload}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface UploadProgressItemProps {
  upload: UploadProgress;
  onCancel?: (fileId: string) => void;
}

function UploadProgressItem({ upload, onCancel }: UploadProgressItemProps) {
  const isComplete = upload.status === 'complete';
  const isError = upload.status === 'error';
  const isUploading = upload.status === 'uploading' || upload.status === 'processing';

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border',
        isError && 'border-destructive/50 bg-destructive/5',
        isComplete && 'border-green-500/50 bg-green-500/5'
      )}
    >
      <div className="flex-shrink-0">
        {isUploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <FileText
            className={cn(
              'h-5 w-5',
              isError ? 'text-destructive' : 'text-muted-foreground'
            )}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{upload.fileName}</p>
        {isError ? (
          <p className="text-xs text-destructive">{upload.error}</p>
        ) : isComplete ? (
          <p className="text-xs text-green-600">Upload complete</p>
        ) : (
          <div className="mt-1">
            <Progress value={upload.progress} className="h-1" />
            <p className="text-xs text-muted-foreground mt-1">
              {upload.status === 'processing' ? 'Processing...' : `${upload.progress}%`}
            </p>
          </div>
        )}
      </div>

      {onCancel && !isComplete && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={() => onCancel(upload.fileId)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
