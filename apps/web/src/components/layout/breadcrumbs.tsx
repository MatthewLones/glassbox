'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app-store';

interface BreadcrumbItem {
  label: string;
  href: string;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const currentOrg = useAppStore((state) => state.currentOrg);
  const currentProject = useAppStore((state) => state.currentProject);

  const breadcrumbs = React.useMemo(() => {
    const items: BreadcrumbItem[] = [];
    const segments = pathname.split('/').filter(Boolean);

    // Build breadcrumbs based on path segments
    segments.forEach((segment, index) => {
      const href = '/' + segments.slice(0, index + 1).join('/');

      // Map segments to readable labels
      switch (segment) {
        case 'dashboard':
          items.push({ label: 'Dashboard', href });
          break;
        case 'projects':
          if (index === segments.length - 1) {
            items.push({ label: 'Projects', href });
          }
          break;
        case 'settings':
          items.push({ label: 'Settings', href });
          break;
        case 'search':
          items.push({ label: 'Search', href });
          break;
        default:
          // Check if this is a project ID
          if (segments[index - 1] === 'projects' && currentProject) {
            items.push({ label: currentProject.name, href });
          }
          break;
      }
    });

    return items;
  }, [pathname, currentProject]);

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      <Link
        href="/dashboard"
        className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>

      {breadcrumbs.map((item, index) => (
        <React.Fragment key={item.href}>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          {index === breadcrumbs.length - 1 ? (
            <span className="font-medium text-foreground">{item.label}</span>
          ) : (
            <Link
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
