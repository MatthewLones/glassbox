'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { LoadingOverlay } from '@/components/common/loading-overlay';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Store the current path to redirect back after login
      sessionStorage.setItem('auth_return_to', pathname);
      router.replace('/auth/login');
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  if (isLoading) {
    return fallback || <LoadingOverlay message="Loading..." />;
  }

  if (!isAuthenticated) {
    return fallback || <LoadingOverlay message="Redirecting to login..." />;
  }

  return <>{children}</>;
}
