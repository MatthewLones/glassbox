import * as React from 'react';
import { api } from '@/lib/api';

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

export interface UploadedFile {
  id: string;
  fileName: string;
  fileType: string;
  size: number;
  url?: string;
}

interface UseFileUploadOptions {
  orgId: string;
  projectId?: string;
  nodeId?: string;
  onUploadComplete?: (file: UploadedFile) => void;
  onError?: (error: Error, fileName: string) => void;
  maxFileSize?: number; // in bytes
  allowedTypes?: string[];
}

export function useFileUpload({
  orgId,
  projectId,
  nodeId,
  onUploadComplete,
  onError,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  allowedTypes,
}: UseFileUploadOptions) {
  const [uploads, setUploads] = React.useState<Map<string, UploadProgress>>(
    new Map()
  );
  const [isUploading, setIsUploading] = React.useState(false);

  const updateUpload = React.useCallback(
    (fileId: string, updates: Partial<UploadProgress>) => {
      setUploads((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(fileId);
        if (existing) {
          newMap.set(fileId, { ...existing, ...updates });
        }
        return newMap;
      });
    },
    []
  );

  const validateFile = React.useCallback(
    (file: File): string | null => {
      if (file.size > maxFileSize) {
        return `File too large. Maximum size is ${Math.round(maxFileSize / 1024 / 1024)}MB`;
      }

      if (allowedTypes && allowedTypes.length > 0) {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const mimeType = file.type;

        const isAllowed = allowedTypes.some((type) => {
          if (type.startsWith('.')) {
            return fileExt === type.slice(1).toLowerCase();
          }
          if (type.endsWith('/*')) {
            return mimeType.startsWith(type.slice(0, -1));
          }
          return mimeType === type;
        });

        if (!isAllowed) {
          return `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`;
        }
      }

      return null;
    },
    [maxFileSize, allowedTypes]
  );

  const uploadFile = React.useCallback(
    async (file: File): Promise<UploadedFile | null> => {
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        const error = new Error(validationError);
        onError?.(error, file.name);
        return null;
      }

      // Initialize upload progress
      setUploads((prev) => {
        const newMap = new Map(prev);
        newMap.set(fileId, {
          fileId,
          fileName: file.name,
          progress: 0,
          status: 'pending',
        });
        return newMap;
      });

      setIsUploading(true);

      try {
        // Step 1: Get presigned URL from API
        updateUpload(fileId, { status: 'uploading', progress: 10 });

        const presignedResponse = await api.files.getUploadURL(orgId, {
          filename: file.name,
          contentType: file.type,
        });

        updateUpload(fileId, { progress: 20 });

        // Step 2: Upload file to S3 using presigned URL
        const uploadResponse = await fetch(presignedResponse.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file to storage');
        }

        updateUpload(fileId, { progress: 80, status: 'processing' });

        // Step 3: Confirm upload with backend
        const confirmResponse = await api.files.confirmUpload(
          presignedResponse.fileId
        );

        updateUpload(fileId, { progress: 100, status: 'complete' });

        const uploadedFile: UploadedFile = {
          id: confirmResponse.id,
          fileName: confirmResponse.filename,
          fileType: confirmResponse.contentType || file.type,
          size: confirmResponse.sizeBytes || file.size,
        };

        onUploadComplete?.(uploadedFile);

        // Remove from uploads after a delay
        setTimeout(() => {
          setUploads((prev) => {
            const newMap = new Map(prev);
            newMap.delete(fileId);
            return newMap;
          });
        }, 2000);

        return uploadedFile;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Upload failed';
        updateUpload(fileId, { status: 'error', error: errorMessage });
        onError?.(
          error instanceof Error ? error : new Error(errorMessage),
          file.name
        );
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [orgId, projectId, nodeId, validateFile, updateUpload, onUploadComplete, onError]
  );

  const uploadFiles = React.useCallback(
    async (files: FileList | File[]): Promise<UploadedFile[]> => {
      const fileArray = Array.from(files);
      const results = await Promise.all(fileArray.map(uploadFile));
      return results.filter((f): f is UploadedFile => f !== null);
    },
    [uploadFile]
  );

  const cancelUpload = React.useCallback((fileId: string) => {
    setUploads((prev) => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      return newMap;
    });
  }, []);

  const clearUploads = React.useCallback(() => {
    setUploads(new Map());
  }, []);

  return {
    uploads: Array.from(uploads.values()),
    isUploading,
    uploadFile,
    uploadFiles,
    cancelUpload,
    clearUploads,
  };
}
