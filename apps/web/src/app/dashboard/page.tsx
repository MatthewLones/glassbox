'use client';

import * as React from 'react';
import { Plus, Settings } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { ProjectList } from '@/components/project/project-list';
import { CreateProjectDialog } from '@/components/project/create-project-dialog';
import { ProjectSettingsDialog } from '@/components/project/project-settings-dialog';
import { CreateOrgDialog } from '@/components/organization/create-org-dialog';
import { OrgSettingsDialog } from '@/components/organization/org-settings-dialog';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { useProjects, useDeleteProject } from '@/hooks/use-projects';
import { useAppStore } from '@/stores/app-store';
import { toast } from 'sonner';
import type { Project } from '@glassbox/shared-types';

function DashboardContent() {
  const { currentOrgId } = useAppStore();
  const { data, isLoading } = useProjects(currentOrgId);
  const projects = data?.data || [];

  // Dialog states
  const [showCreateProject, setShowCreateProject] = React.useState(false);
  const [showCreateOrg, setShowCreateOrg] = React.useState(false);
  const [showOrgSettings, setShowOrgSettings] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = React.useState<Project | null>(null);

  // Delete mutation
  const deleteProject = useDeleteProject(projectToDelete?.id || '');

  async function handleDeleteProject() {
    if (!projectToDelete) return;
    try {
      await deleteProject.mutateAsync();
      toast.success('Project deleted');
      setProjectToDelete(null);
    } catch (error) {
      toast.error('Failed to delete project');
      console.error(error);
    }
  }

  return (
    <AppShell
      onCreateOrgClick={() => setShowCreateOrg(true)}
      onOrgSettingsClick={() => setShowOrgSettings(true)}
    >
      <Header
        title="Dashboard"
        actions={
          <Button onClick={() => setShowCreateProject(true)} disabled={!currentOrgId}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        }
      />

      <div className="p-6">
        {!currentOrgId ? (
          <div className="text-center py-12">
            <h2 className="text-lg font-semibold mb-2">No organization selected</h2>
            <p className="text-muted-foreground mb-4">
              Create or select an organization to view projects.
            </p>
            <Button onClick={() => setShowCreateOrg(true)}>
              Create organization
            </Button>
          </div>
        ) : (
          <>
            {/* Projects section */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-4">Projects</h2>
              <ProjectList
                projects={projects}
                isLoading={isLoading}
                onCreateClick={() => setShowCreateProject(true)}
                onSettingsClick={(project) => setSelectedProject(project)}
                onDeleteClick={(project) => setProjectToDelete(project)}
              />
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      {currentOrgId && (
        <CreateProjectDialog
          orgId={currentOrgId}
          open={showCreateProject}
          onOpenChange={setShowCreateProject}
        />
      )}

      <CreateOrgDialog
        open={showCreateOrg}
        onOpenChange={setShowCreateOrg}
      />

      {currentOrgId && (
        <OrgSettingsDialog
          orgId={currentOrgId}
          open={showOrgSettings}
          onOpenChange={setShowOrgSettings}
        />
      )}

      {selectedProject && (
        <ProjectSettingsDialog
          projectId={selectedProject.id}
          open={!!selectedProject}
          onOpenChange={(open) => !open && setSelectedProject(null)}
        />
      )}

      <ConfirmDialog
        open={!!projectToDelete}
        onOpenChange={(open) => !open && setProjectToDelete(null)}
        title="Delete project?"
        description={`This will permanently delete "${projectToDelete?.name}" and all its nodes and files. This action cannot be undone.`}
        confirmLabel="Delete project"
        variant="destructive"
        onConfirm={handleDeleteProject}
      />
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
