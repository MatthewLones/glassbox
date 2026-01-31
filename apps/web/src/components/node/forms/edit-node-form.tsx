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
import { Separator } from '@/components/ui/separator';
import { StatusSelect } from './status-select';
import { useUpdateNode } from '@/hooks/use-nodes';
import { toast } from 'sonner';
import type { Node } from '@glassbox/shared-types';

interface EditNodeFormProps {
  node: Node;
  workflowStates?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface FormData {
  title: string;
  description: string;
  status: string;
}

export function EditNodeForm({
  node,
  workflowStates = ['draft', 'in_progress', 'review', 'complete'],
  open,
  onOpenChange,
  onSuccess,
}: EditNodeFormProps) {
  const updateNode = useUpdateNode(node.id);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    defaultValues: {
      title: node.title,
      description: node.description || '',
      status: node.status,
    },
  });

  const status = watch('status');

  // Reset form when node changes
  React.useEffect(() => {
    reset({
      title: node.title,
      description: node.description || '',
      status: node.status,
    });
  }, [node, reset]);

  async function onSubmit(data: FormData) {
    try {
      await updateNode.mutateAsync({
        title: data.title,
        description: data.description || undefined,
        status: data.status,
      });
      toast.success('Node updated');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Failed to update node');
      console.error(error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-modal max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit node</DialogTitle>
          <DialogDescription>
            Update the node details. Changes will be versioned.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              {...register('title', { required: 'Title is required' })}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Describe what this node is about..."
              {...register('description')}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <StatusSelect
              value={status}
              onChange={(value) => setValue('status', value, { shouldDirty: true })}
              options={workflowStates}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Version {node.version}</span>
            <span>
              Author: {node.authorType === 'agent' ? 'Agent' : 'Human'}
            </span>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
