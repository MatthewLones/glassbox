'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  FileText,
  Image as ImageIcon,
  FileCode,
  FileSpreadsheet,
  Film,
  Music,
  Archive,
  File,
} from 'lucide-react';

interface FilePreviewProps {
  fileName: string;
  fileType: string;
  url?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const FILE_ICONS: Record<string, React.ElementType> = {
  // Documents
  'application/pdf': FileText,
  'application/msword': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'text/plain': FileText,
  'text/markdown': FileText,
  // Images
  'image/png': ImageIcon,
  'image/jpeg': ImageIcon,
  'image/gif': ImageIcon,
  'image/webp': ImageIcon,
  'image/svg+xml': ImageIcon,
  // Code
  'application/json': FileCode,
  'application/javascript': FileCode,
  'text/html': FileCode,
  'text/css': FileCode,
  // Spreadsheets
  'application/vnd.ms-excel': FileSpreadsheet,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileSpreadsheet,
  'text/csv': FileSpreadsheet,
  // Media
  'video/mp4': Film,
  'video/webm': Film,
  'audio/mpeg': Music,
  'audio/wav': Music,
  // Archives
  'application/zip': Archive,
  'application/x-rar-compressed': Archive,
  'application/x-7z-compressed': Archive,
};

function getFileIcon(mimeType: string): React.ElementType {
  // Direct match
  if (FILE_ICONS[mimeType]) {
    return FILE_ICONS[mimeType];
  }
  // Category match
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.startsWith('text/')) return FileText;
  // Default
  return File;
}

function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/') && !mimeType.includes('svg');
}

const SIZES = {
  sm: { container: 'h-10 w-10', icon: 'h-5 w-5' },
  md: { container: 'h-16 w-16', icon: 'h-8 w-8' },
  lg: { container: 'h-24 w-24', icon: 'h-12 w-12' },
};

export function FilePreview({
  fileName,
  fileType,
  url,
  size = 'md',
  className,
}: FilePreviewProps) {
  const [imageError, setImageError] = React.useState(false);
  const isImage = isImageType(fileType) && url && !imageError;
  const Icon = getFileIcon(fileType);
  const sizeStyles = SIZES[size];

  if (isImage) {
    return (
      <div
        className={cn(
          'rounded-md overflow-hidden bg-muted',
          sizeStyles.container,
          className
        )}
      >
        <img
          src={url}
          alt={fileName}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-md bg-muted flex items-center justify-center',
        sizeStyles.container,
        className
      )}
    >
      <Icon className={cn('text-muted-foreground', sizeStyles.icon)} />
    </div>
  );
}

// Utility function to format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Utility function to get file extension
export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts.pop()?.toUpperCase() || '' : '';
}
