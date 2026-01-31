'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen, MoreHorizontal, Settings, Trash2, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Project } from '@glassbox/shared-types';

interface ProjectCardProps {
  project: Project;
  onSettingsClick?: (project: Project) => void;
  onDeleteClick?: (project: Project) => void;
}

export function ProjectCard({ project, onSettingsClick, onDeleteClick }: ProjectCardProps) {
  const router = useRouter();

  function handleClick() {
    router.push(`/projects/${project.id}`);
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <Card
      variant="glass"
      className="group relative p-4 cursor-pointer hover:shadow-glass transition-all duration-200"
      onClick={handleClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground line-clamp-1">
              {project.name}
            </h3>
            {project.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {project.description}
              </p>
            )}
          </div>
        </div>

        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onSettingsClick?.(project)}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDeleteClick?.(project)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>Updated {formatDate(project.updatedAt)}</span>
        </div>
        {project.workflowStates && project.workflowStates.length > 0 && (
          <div className="flex items-center gap-1">
            <span>{project.workflowStates.length} states</span>
          </div>
        )}
      </div>
    </Card>
  );
}
