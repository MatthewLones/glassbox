'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Plus, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrganizations } from '@/hooks/use-organizations';
import { useAppStore } from '@/stores/app-store';
import type { Organization } from '@glassbox/shared-types';

// Mock data for development/demo
const MOCK_ORGANIZATIONS: Organization[] = [
  {
    id: 'org-demo-123',
    name: 'Demo Organization',
    slug: 'demo-org',
    settings: {},
    eventSourcingLevel: 'audit',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

interface OrgSwitcherProps {
  onCreateClick?: () => void;
}

export function OrgSwitcher({ onCreateClick }: OrgSwitcherProps) {
  const { data, isLoading } = useOrganizations();
  const { currentOrgId, setCurrentOrgId } = useAppStore();

  // Use mock data if no real data
  const realOrgs = data?.data || [];
  const organizations = realOrgs.length > 0 ? realOrgs : MOCK_ORGANIZATIONS;
  const currentOrg = organizations.find((org) => org.id === currentOrgId);

  // Auto-select first org if none selected
  React.useEffect(() => {
    if (!currentOrgId && organizations.length > 0) {
      setCurrentOrgId(organizations[0].id);
    }
  }, [currentOrgId, organizations, setCurrentOrgId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-2 h-10"
          aria-label="Select organization"
        >
          <div className="flex items-center gap-2 truncate">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="truncate font-medium">
              {currentOrg?.name || 'Select organization'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => setCurrentOrgId(org.id)}
            className="flex items-center gap-2"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <span className="flex-1 truncate">{org.name}</span>
            {org.id === currentOrgId && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        {organizations.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No organizations yet
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreateClick} className="gap-2">
          <Plus className="h-4 w-4" />
          Create organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
