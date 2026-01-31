'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authConfig, isDevMode } from '@/lib/auth/config';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Dev mode user presets
const DEV_USERS = [
  { id: 'dev-user-1', email: 'admin@glassbox.dev', name: 'Admin User', role: 'owner' },
  { id: 'dev-user-2', email: 'member@glassbox.dev', name: 'Team Member', role: 'member' },
  { id: 'dev-user-3', email: 'viewer@glassbox.dev', name: 'Viewer', role: 'viewer' },
];

export default function DevLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect to normal login if not in dev mode
  if (!isDevMode()) {
    if (typeof window !== 'undefined') {
      router.replace('/auth/login');
    }
    return null;
  }

  function createDevTokens(user: { id: string; email: string; name: string }) {
    // Create mock JWT payload
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      'cognito:username': user.email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 * 24, // 24 hours
    };

    // Create a simple base64 encoded token (not a real JWT, just for dev)
    const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const body = btoa(JSON.stringify(payload));
    const mockToken = `${header}.${body}.dev-signature`;

    return {
      accessToken: mockToken,
      idToken: mockToken,
      refreshToken: 'dev-refresh-token',
      expiresAt: Date.now() + 3600 * 24 * 1000, // 24 hours
    };
  }

  function handleQuickLogin(user: (typeof DEV_USERS)[0]) {
    setIsLoading(true);
    const tokens = createDevTokens({ id: user.id, email: user.email, name: user.name });

    // Store tokens
    localStorage.setItem(authConfig.storageKeys.accessToken, tokens.accessToken);
    localStorage.setItem(authConfig.storageKeys.idToken, tokens.idToken);
    localStorage.setItem(authConfig.storageKeys.refreshToken, tokens.refreshToken);
    localStorage.setItem(authConfig.storageKeys.expiresAt, tokens.expiresAt.toString());

    // Redirect to dashboard
    router.replace('/dashboard');
  }

  function handleCustomLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !name) return;

    setIsLoading(true);
    const tokens = createDevTokens({
      id: `dev-user-${Date.now()}`,
      email,
      name,
    });

    // Store tokens
    localStorage.setItem(authConfig.storageKeys.accessToken, tokens.accessToken);
    localStorage.setItem(authConfig.storageKeys.idToken, tokens.idToken);
    localStorage.setItem(authConfig.storageKeys.refreshToken, tokens.refreshToken);
    localStorage.setItem(authConfig.storageKeys.expiresAt, tokens.expiresAt.toString());

    // Redirect to dashboard
    router.replace('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card variant="glass" className="max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold">Dev Login</h1>
          <p className="text-muted-foreground mt-1">
            Development mode - no authentication required
          </p>
        </div>

        {/* Quick login buttons */}
        <div className="space-y-2 mb-6">
          <p className="text-sm font-medium text-muted-foreground">Quick Login</p>
          {DEV_USERS.map((user) => (
            <Button
              key={user.id}
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleQuickLogin(user)}
              disabled={isLoading}
            >
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mr-3">
                {user.name.charAt(0)}
              </div>
              <div className="text-left">
                <div className="font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
              <span className="ml-auto text-xs text-muted-foreground capitalize">
                {user.role}
              </span>
            </Button>
          ))}
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or custom user
            </span>
          </div>
        </div>

        {/* Custom login form */}
        <form onSubmit={handleCustomLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || !email || !name}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground mt-6">
          This page is only available in development mode.
          <br />
          In production, users are redirected to Cognito.
        </p>
      </Card>
    </div>
  );
}
