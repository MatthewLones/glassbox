'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  FolderKanban,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
  Box,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { OrgSwitcher } from '@/components/organization/org-switcher';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

const mainNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: Home },
  { title: 'Search', href: '/dashboard/search', icon: Search },
];

const bottomNavItems: NavItem[] = [
  { title: 'Settings', href: '/dashboard/settings', icon: Settings },
];

interface SidebarProps {
  onCreateOrgClick?: () => void;
  onOrgSettingsClick?: () => void;
}

export function Sidebar({ onCreateOrgClick, onOrgSettingsClick }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen glass-card border-r transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo section */}
          <div className="flex h-16 items-center justify-between border-b px-4">
            {sidebarOpen ? (
              <Link href="/dashboard" className="flex items-center gap-2">
                <Box className="h-6 w-6 text-primary" />
                <span className="text-lg font-semibold">GlassBox</span>
              </Link>
            ) : (
              <Link href="/dashboard" className="mx-auto">
                <Box className="h-6 w-6 text-primary" />
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={cn('h-8 w-8', !sidebarOpen && 'hidden')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Organization Switcher */}
          {sidebarOpen && (
            <div className="p-2 border-b">
              <OrgSwitcher onCreateClick={onCreateOrgClick} />
            </div>
          )}

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="flex flex-col gap-1 px-2">
              {mainNavItems.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  isActive={pathname === item.href}
                  collapsed={!sidebarOpen}
                />
              ))}
            </nav>
          </ScrollArea>

          {/* Bottom navigation */}
          <div className="border-t py-4">
            <nav className="flex flex-col gap-1 px-2">
              {bottomNavItems.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  isActive={pathname === item.href}
                  collapsed={!sidebarOpen}
                />
              ))}
              {!sidebarOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(true)}
                  className="mx-auto h-10 w-10"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </nav>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}

interface NavLinkProps {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}

function NavLink({ item, isActive, collapsed }: NavLinkProps) {
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        collapsed && 'justify-center px-2'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{item.title}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {item.title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
