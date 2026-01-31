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
import { FileText, Link as LinkIcon, Type, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface AddEvidenceFormProps {
  nodeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface LinkFormData {
  url: string;
  label: string;
}

interface TextFormData {
  label: string;
  content: string;
}

export function AddEvidenceForm({
  nodeId,
  open,
  onOpenChange,
  onSuccess,
}: AddEvidenceFormProps) {
  const [activeTab, setActiveTab] = React.useState('link');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const linkForm = useForm<LinkFormData>({
    defaultValues: { url: '', label: '' },
  });

  const textForm = useForm<TextFormData>({
    defaultValues: { label: '', content: '' },
  });

  async function handleAddLink(data: LinkFormData) {
    setIsSubmitting(true);
    try {
      // TODO: Call API to add link input
      console.log('Adding link:', data);
      toast.success('Link added');
      linkForm.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Failed to add link');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddText(data: TextFormData) {
    setIsSubmitting(true);
    try {
      // TODO: Call API to add text input
      console.log('Adding text:', data);
      toast.success('Note added');
      textForm.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Failed to add note');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    try {
      // TODO: Call API to upload file
      console.log('Uploading file:', file.name);
      toast.success('File uploaded');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Failed to upload file');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-modal max-w-md">
        <DialogHeader>
          <DialogTitle>Add evidence</DialogTitle>
          <DialogDescription>
            Add supporting evidence to this node.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="link" className="flex-1 gap-1">
              <LinkIcon className="h-4 w-4" />
              Link
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1 gap-1">
              <FileText className="h-4 w-4" />
              File
            </TabsTrigger>
            <TabsTrigger value="text" className="flex-1 gap-1">
              <Type className="h-4 w-4" />
              Note
            </TabsTrigger>
          </TabsList>

          {/* Link tab */}
          <TabsContent value="link" className="mt-4">
            <form onSubmit={linkForm.handleSubmit(handleAddLink)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
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
                <Label htmlFor="linkLabel">Label (optional)</Label>
                <Input
                  id="linkLabel"
                  placeholder="Describe this link..."
                  {...linkForm.register('label')}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add link'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* File tab */}
          <TabsContent value="file" className="mt-4">
            <div className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, DOCX, TXT, images up to 10MB
                </p>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
              </DialogFooter>
            </div>
          </TabsContent>

          {/* Text tab */}
          <TabsContent value="text" className="mt-4">
            <form onSubmit={textForm.handleSubmit(handleAddText)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="textLabel">Title</Label>
                <Input
                  id="textLabel"
                  placeholder="Note title..."
                  {...textForm.register('label', { required: 'Title is required' })}
                />
                {textForm.formState.errors.label && (
                  <p className="text-sm text-destructive">
                    {textForm.formState.errors.label.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <textarea
                  id="content"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Enter your note..."
                  {...textForm.register('content', { required: 'Content is required' })}
                />
                {textForm.formState.errors.content && (
                  <p className="text-sm text-destructive">
                    {textForm.formState.errors.content.message}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add note'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
