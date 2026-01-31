'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getLoginUrl, isDevMode } from '@/lib/auth/config';
import { Spinner } from '@/components/common/spinner';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (isDevMode()) {
      // In dev mode, redirect to dev login page
      router.replace('/auth/dev-login');
    } else {
      // In production, redirect to Cognito hosted UI
      const state = crypto.randomUUID();
      sessionStorage.setItem('oauth_state', state);
      window.location.href = getLoginUrl(state);
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-4 text-muted-foreground">Redirecting to login...</p>
      </div>
    </div>
  );
}
