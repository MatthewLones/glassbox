'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authConfig, getLogoutUrl, isDevMode } from '@/lib/auth/config';
import { Spinner } from '@/components/common/spinner';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    // Clear all stored tokens
    localStorage.removeItem(authConfig.storageKeys.accessToken);
    localStorage.removeItem(authConfig.storageKeys.idToken);
    localStorage.removeItem(authConfig.storageKeys.refreshToken);
    localStorage.removeItem(authConfig.storageKeys.expiresAt);

    // Clear any session storage
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('auth_return_to');

    if (isDevMode()) {
      // In dev mode, just redirect to home
      router.replace('/');
    } else {
      // In production, redirect to Cognito logout
      window.location.href = getLogoutUrl();
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-4 text-muted-foreground">Signing out...</p>
      </div>
    </div>
  );
}
