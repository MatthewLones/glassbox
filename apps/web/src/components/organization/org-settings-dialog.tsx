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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useOrganization, useUpdateOrganization, useDeleteOrganization } from '@/hooks/use-organizations';
import { useAppStore } from '@/stores/app-store';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { toast } from 'sonner';
import type { Organization } from '@glassbox/shared-types';

interface OrgSettingsDialogProps {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GeneralFormData {
  name: string;
  slug: string;
}

export function OrgSettingsDialog({ orgId, open, onOpenChange }: OrgSettingsDialogProps) {
  const { data: org, isLoading } = useOrganization(orgId);
  const updateOrg = useUpdateOrganization(orgId);
  const deleteOrg = useDeleteOrganization(orgId);
  const { setCurrentOrgId } = useAppStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<GeneralFormData>();

  // Reset form when org data loads
  React.useEffect(() => {
    if (org) {
      reset({
        name: org.name,
        slug: org.slug,
      });
    }
  }, [org, reset]);

  async function onSubmit(data: GeneralFormData) {
    try {
      await updateOrg.mutateAsync(data);
      toast.success('Organization updated');
    } catch (error) {
      toast.error('Failed to update organization');
      console.error(error);
    }
  }

  async function handleDelete() {
    try {
      await deleteOrg.mutateAsync();
      toast.success('Organization deleted');
      setCurrentOrgId('');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to delete organization');
      console.error(error);
    }
  }

  if (isLoading || !org) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-modal max-w-2xl">
          <DialogHeader>
            <DialogTitle>Organization settings</DialogTitle>
            <DialogDescription>
              Manage your organization settings and preferences.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-4">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Organization name</Label>
                    <Input
                      id="name"
                      {...register('name', { required: 'Name is required' })}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">URL slug</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">glassbox.io/</span>
                      <Input
                        id="slug"
                        {...register('slug', {
                          required: 'Slug is required',
                          pattern: {
                            value: /^[a-z0-9-]+$/,
                            message: 'Only lowercase letters, numbers, and hyphens',
                          },
                        })}
                      />
                    </div>
                    {errors.slug && (
                      <p className="text-sm text-destructive">{errors.slug.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting || !isDirty}>
                    {isSubmitting ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>
              </form>

              <Separator className="my-6" />

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-destructive">Danger zone</h3>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete this organization and all its data.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete organization
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="members" className="mt-4">
              <div className="py-8 text-center text-muted-foreground">
                Member management coming soon
              </div>
            </TabsContent>

            <TabsContent value="billing" className="mt-4">
              <div className="py-8 text-center text-muted-foreground">
                Billing management coming soon
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete organization?"
        description={`This will permanently delete "${org.name}" and all its projects, nodes, and files. This action cannot be undone.`}
        confirmLabel="Delete organization"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
