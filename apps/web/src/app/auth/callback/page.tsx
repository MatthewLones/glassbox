'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authConfig } from '@/lib/auth/config';
import { Spinner } from '@/components/common/spinner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Handle OAuth errors
      if (errorParam) {
        setError(errorDescription || errorParam);
        return;
      }

      // Validate authorization code
      if (!code) {
        setError('No authorization code received');
        return;
      }

      // Validate state to prevent CSRF
      const savedState = sessionStorage.getItem('oauth_state');
      if (state && savedState && state !== savedState) {
        setError('Invalid state parameter');
        return;
      }
      sessionStorage.removeItem('oauth_state');

      try {
        // Exchange code for tokens via our API route
        const response = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            redirectUri: authConfig.redirectUri,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to exchange authorization code');
        }

        const tokens = await response.json();

        // Store tokens
        const expiresAt = Date.now() + tokens.expires_in * 1000;
        localStorage.setItem(authConfig.storageKeys.accessToken, tokens.access_token);
        localStorage.setItem(authConfig.storageKeys.idToken, tokens.id_token);
        localStorage.setItem(authConfig.storageKeys.refreshToken, tokens.refresh_token);
        localStorage.setItem(authConfig.storageKeys.expiresAt, expiresAt.toString());

        // Redirect to dashboard
        const returnTo = sessionStorage.getItem('auth_return_to') || '/dashboard';
        sessionStorage.removeItem('auth_return_to');
        router.replace(returnTo);
      } catch (err) {
        console.error('Callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    }

    handleCallback();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card variant="glass" className="max-w-md w-full p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-2">Authentication Failed</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push('/auth/login')} className="w-full">
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-4 text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <Spinner size="lg" />
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
