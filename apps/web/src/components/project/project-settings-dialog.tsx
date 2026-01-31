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
import { useProject, useUpdateProject, useDeleteProject } from '@/hooks/use-projects';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface ProjectSettingsDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  name: string;
  description: string;
}

export function ProjectSettingsDialog({ projectId, open, onOpenChange }: ProjectSettingsDialogProps) {
  const router = useRouter();
  const { data: project, isLoading } = useProject(projectId);
  const updateProject = useUpdateProject(projectId);
  const deleteProject = useDeleteProject(projectId);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>();

  // Reset form when project data loads
  React.useEffect(() => {
    if (project) {
      reset({
        name: project.name,
        description: project.description || '',
      });
    }
  }, [project, reset]);

  async function onSubmit(data: FormData) {
    try {
      await updateProject.mutateAsync({
        name: data.name,
        description: data.description || undefined,
      });
      toast.success('Project updated');
    } catch (error) {
      toast.error('Failed to update project');
      console.error(error);
    }
  }

  async function handleDelete() {
    try {
      await deleteProject.mutateAsync();
      toast.success('Project deleted');
      onOpenChange(false);
      router.push('/dashboard');
    } catch (error) {
      toast.error('Failed to delete project');
      console.error(error);
    }
  }

  if (isLoading || !project) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-modal">
          <DialogHeader>
            <DialogTitle>Project settings</DialogTitle>
            <DialogDescription>
              Manage your project settings.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project name</Label>
                <Input
                  id="name"
                  {...register('name', { required: 'Name is required' })}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  {...register('description')}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </form>

          <Separator />

          <div className="space-y-4 py-4">
            <div>
              <h3 className="text-lg font-medium text-destructive">Danger zone</h3>
              <p className="text-sm text-muted-foreground">
                Permanently delete this project and all its nodes and files.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete project
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete project?"
        description={`This will permanently delete "${project.name}" and all its nodes and files. This action cannot be undone.`}
        confirmLabel="Delete project"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
