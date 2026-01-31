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

// Mock data for development/demo
const MOCK_ORG_ID = 'org-demo-123';
const MOCK_PROJECTS: Project[] = [
  {
    id: 'project-1',
    orgId: MOCK_ORG_ID,
    name: 'Q4 Strategic Planning',
    description: 'Comprehensive planning for Q4 2024 initiatives including market expansion and product launches.',
    workflowStates: ['draft', 'in_progress', 'review', 'complete'],
    settings: {},
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
  },
  {
    id: 'project-2',
    orgId: MOCK_ORG_ID,
    name: 'Product Roadmap 2024',
    description: 'Technical roadmap and feature planning for the upcoming year.',
    workflowStates: ['draft', 'in_progress', 'review', 'complete'],
    settings: {},
    createdAt: '2024-01-05T09:00:00Z',
    updatedAt: '2024-01-18T11:00:00Z',
  },
  {
    id: 'project-3',
    orgId: MOCK_ORG_ID,
    name: 'Competitive Analysis',
    description: 'Deep dive into competitor landscape and market positioning.',
    workflowStates: ['draft', 'in_progress', 'review', 'complete'],
    settings: {},
    createdAt: '2024-01-12T15:00:00Z',
    updatedAt: '2024-01-19T16:30:00Z',
  },
];

function DashboardContent() {
  const { currentOrgId, setCurrentOrgId } = useAppStore();
  const { data, isLoading } = useProjects(currentOrgId || MOCK_ORG_ID);

  // Use mock data if no real data
  const realProjects = data?.data || [];
  const projects = realProjects.length > 0 ? realProjects : MOCK_PROJECTS;

  // Use mock org ID if none set
  const effectiveOrgId = currentOrgId || MOCK_ORG_ID;

  // Auto-set mock org for demo
  React.useEffect(() => {
    if (!currentOrgId) {
      setCurrentOrgId(MOCK_ORG_ID);
    }
  }, [currentOrgId, setCurrentOrgId]);

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
          <Button onClick={() => setShowCreateProject(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        }
      />

      <div className="p-6">
        {/* Projects section */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Projects</h2>
          <ProjectList
            projects={projects}
            isLoading={isLoading && realProjects.length === 0}
            onCreateClick={() => setShowCreateProject(true)}
            onSettingsClick={(project) => setSelectedProject(project)}
            onDeleteClick={(project) => setProjectToDelete(project)}
          />
        </div>
      </div>

      {/* Dialogs */}
      <CreateProjectDialog
        orgId={effectiveOrgId}
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
      />

      <CreateOrgDialog
        open={showCreateOrg}
        onOpenChange={setShowCreateOrg}
      />

      <OrgSettingsDialog
        orgId={effectiveOrgId}
        open={showOrgSettings}
        onOpenChange={setShowOrgSettings}
      />

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
