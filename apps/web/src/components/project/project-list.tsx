'use client';

import * as React from 'react';
import { ProjectCard } from './project-card';
import { EmptyState } from '@/components/common/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderOpen } from 'lucide-react';
import type { Project } from '@glassbox/shared-types';

interface ProjectListProps {
  projects: Project[];
  isLoading?: boolean;
  onCreateClick?: () => void;
  onSettingsClick?: (project: Project) => void;
  onDeleteClick?: (project: Project) => void;
}

export function ProjectList({
  projects,
  isLoading,
  onCreateClick,
  onSettingsClick,
  onDeleteClick,
}: ProjectListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-xl border bg-card">
            <div className="flex items-start gap-3 mb-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No projects yet"
        description="Create your first project to get started with GlassBox."
        action={onCreateClick ? { label: 'Create project', onClick: onCreateClick } : undefined}
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onSettingsClick={onSettingsClick}
          onDeleteClick={onDeleteClick}
        />
      ))}
    </div>
  );
}
