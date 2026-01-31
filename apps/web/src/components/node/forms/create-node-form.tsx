'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusSelect } from './status-select';
import { AuthorSelect } from './author-select';
import { useCreateNode } from '@/hooks/use-nodes';
import { toast } from 'sonner';
import type { AuthorType } from '@glassbox/shared-types';

interface CreateNodeFormProps {
  projectId: string;
  parentId?: string;
  workflowStates?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (nodeId: string) => void;
}

interface FormData {
  title: string;
  description: string;
  status: string;
  authorType: AuthorType;
}

export function CreateNodeForm({
  projectId,
  parentId,
  workflowStates = ['draft', 'in_progress', 'review', 'complete'],
  open,
  onOpenChange,
  onSuccess,
}: CreateNodeFormProps) {
  const createNode = useCreateNode(projectId);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      title: '',
      description: '',
      status: workflowStates[0] || 'draft',
      authorType: 'human',
    },
  });

  const authorType = watch('authorType');
  const status = watch('status');

  async function onSubmit(data: FormData) {
    try {
      const node = await createNode.mutateAsync({
        projectId,
        parentId,
        title: data.title,
        description: data.description || undefined,
        status: data.status,
        authorType: data.authorType,
      });
      toast.success('Node created');
      reset();
      onOpenChange(false);
      onSuccess?.(node.id);
    } catch (error) {
      toast.error('Failed to create node');
      console.error(error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-modal max-w-md">
        <DialogHeader>
          <DialogTitle>
            {parentId ? 'Add child node' : 'Create new node'}
          </DialogTitle>
          <DialogDescription>
            {parentId
              ? 'Add a child node to provide supporting evidence.'
              : 'Create a new node in your project.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Enter node title..."
              {...register('title', { required: 'Title is required' })}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <textarea
              id="description"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Describe what this node is about..."
              {...register('description')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Author</Label>
              <AuthorSelect
                value={authorType}
                onChange={(value) => setValue('authorType', value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <StatusSelect
                value={status}
                onChange={(value) => setValue('status', value)}
                options={workflowStates}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create node'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
