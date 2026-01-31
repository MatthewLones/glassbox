'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';
import { useAppStore } from '@/stores/app-store';
import { SearchCommand, SearchProvider } from '@/components/search';

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
  onCreateOrgClick?: () => void;
  onOrgSettingsClick?: () => void;
}

export function AppShell({
  children,
  className,
  onCreateOrgClick,
  onOrgSettingsClick,
}: AppShellProps) {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);

  return (
    <SearchProvider>
      <div className="min-h-screen bg-background">
        {/* Global search command (Cmd+K) */}
        <SearchCommand />

        {/* Sidebar */}
        <Sidebar
          onCreateOrgClick={onCreateOrgClick}
          onOrgSettingsClick={onOrgSettingsClick}
        />

        {/* Main content area */}
        <div
          className={cn(
            'flex flex-col min-h-screen transition-all duration-300',
            sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
          )}
        >
          {/* Main content */}
          <main className={cn('flex-1', className)}>{children}</main>
        </div>
      </div>
    </SearchProvider>
  );
}
