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
import { NodeReferencePicker } from './node-reference-picker';
import { FileText, Link as LinkIcon, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import type { Node } from '@glassbox/shared-types';

interface AddInputFormProps {
  nodeId: string;
  nodes: Node[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface NodeRefFormData {
  selectedNodeIds: string[];
}

interface LinkFormData {
  url: string;
  label: string;
}

export function AddInputForm({
  nodeId,
  nodes,
  open,
  onOpenChange,
  onSuccess,
}: AddInputFormProps) {
  const [activeTab, setActiveTab] = React.useState('node');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = React.useState<string[]>([]);

  const linkForm = useForm<LinkFormData>({
    defaultValues: { url: '', label: '' },
  });

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setSelectedNodeIds([]);
      linkForm.reset();
      setActiveTab('node');
    }
  }, [open, linkForm]);

  async function handleAddNodeRefs() {
    if (selectedNodeIds.length === 0) {
      toast.error('Please select at least one node');
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Call API to add node references as inputs
      console.log('Adding node inputs:', selectedNodeIds);
      toast.success(`Added ${selectedNodeIds.length} node reference(s)`);
      setSelectedNodeIds([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Failed to add inputs');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddLink(data: LinkFormData) {
    setIsSubmitting(true);
    try {
      // TODO: Call API to add external link as input
      console.log('Adding link input:', data);
      toast.success('Link added as input');
      linkForm.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Failed to add link');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-modal max-w-md">
        <DialogHeader>
          <DialogTitle>Add input</DialogTitle>
          <DialogDescription>
            Add inputs that this node depends on.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="node" className="flex-1 gap-1">
              <GitBranch className="h-4 w-4" />
              Node
            </TabsTrigger>
            <TabsTrigger value="link" className="flex-1 gap-1">
              <LinkIcon className="h-4 w-4" />
              Link
            </TabsTrigger>
          </TabsList>

          {/* Node reference tab */}
          <TabsContent value="node" className="mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select nodes</Label>
                <NodeReferencePicker
                  nodes={nodes}
                  selectedIds={selectedNodeIds}
                  onChange={setSelectedNodeIds}
                  excludeIds={[nodeId]}
                />
                <p className="text-xs text-muted-foreground">
                  Reference other nodes as inputs to establish dependencies.
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleAddNodeRefs}
                  disabled={isSubmitting || selectedNodeIds.length === 0}
                >
                  {isSubmitting ? 'Adding...' : 'Add inputs'}
                </Button>
              </DialogFooter>
            </div>
          </TabsContent>

          {/* Link tab */}
          <TabsContent value="link" className="mt-4">
            <form
              onSubmit={linkForm.handleSubmit(handleAddLink)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="inputUrl">URL</Label>
                <Input
                  id="inputUrl"
                  type="url"
                  placeholder="https://..."
                  {...linkForm.register('url', { required: 'URL is required' })}
                />
                {linkForm.formState.errors.url && (
                  <p className="text-sm text-destructive">
                    {linkForm.formState.errors.url.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="inputLabel">Label (optional)</Label>
                <Input
                  id="inputLabel"
                  placeholder="Describe this input..."
                  {...linkForm.register('label')}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add link'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
