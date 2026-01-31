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
import { FileText, Type, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import type { Node } from '@glassbox/shared-types';

interface AddOutputFormProps {
  nodeId: string;
  nodes: Node[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface TextOutputFormData {
  label: string;
  content: string;
}

export function AddOutputForm({
  nodeId,
  nodes,
  open,
  onOpenChange,
  onSuccess,
}: AddOutputFormProps) {
  const [activeTab, setActiveTab] = React.useState('node');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = React.useState<string[]>([]);

  const textForm = useForm<TextOutputFormData>({
    defaultValues: { label: '', content: '' },
  });

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setSelectedNodeIds([]);
      textForm.reset();
      setActiveTab('node');
    }
  }, [open, textForm]);

  async function handleAddNodeRefs() {
    if (selectedNodeIds.length === 0) {
      toast.error('Please select at least one node');
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Call API to add node references as outputs
      console.log('Adding node outputs:', selectedNodeIds);
      toast.success(`Added ${selectedNodeIds.length} node reference(s)`);
      setSelectedNodeIds([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Failed to add outputs');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddText(data: TextOutputFormData) {
    setIsSubmitting(true);
    try {
      // TODO: Call API to add text output
      console.log('Adding text output:', data);
      toast.success('Output added');
      textForm.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Failed to add output');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-modal max-w-md">
        <DialogHeader>
          <DialogTitle>Add output</DialogTitle>
          <DialogDescription>
            Add outputs produced by this node.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="node" className="flex-1 gap-1">
              <GitBranch className="h-4 w-4" />
              Node
            </TabsTrigger>
            <TabsTrigger value="text" className="flex-1 gap-1">
              <Type className="h-4 w-4" />
              Text
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
                  Reference nodes that depend on this node&apos;s output.
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
                  {isSubmitting ? 'Adding...' : 'Add outputs'}
                </Button>
              </DialogFooter>
            </div>
          </TabsContent>

          {/* Text output tab */}
          <TabsContent value="text" className="mt-4">
            <form
              onSubmit={textForm.handleSubmit(handleAddText)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="outputLabel">Label</Label>
                <Input
                  id="outputLabel"
                  placeholder="Output name..."
                  {...textForm.register('label', {
                    required: 'Label is required',
                  })}
                />
                {textForm.formState.errors.label && (
                  <p className="text-sm text-destructive">
                    {textForm.formState.errors.label.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="outputContent">Content</Label>
                <textarea
                  id="outputContent"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Output content..."
                  {...textForm.register('content', {
                    required: 'Content is required',
                  })}
                />
                {textForm.formState.errors.content && (
                  <p className="text-sm text-destructive">
                    {textForm.formState.errors.content.message}
                  </p>
                )}
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
                  {isSubmitting ? 'Adding...' : 'Add output'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
