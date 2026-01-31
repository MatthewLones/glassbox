// Cognito Configuration
// These values come from the deployed Auth stack in AWS

export const authConfig = {
  region: process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1',
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',

  // OAuth endpoints (constructed from user pool)
  get domain() {
    // For hosted UI, Cognito provides a domain like:
    // https://<domain-prefix>.auth.<region>.amazoncognito.com
    // Or you can use a custom domain
    return process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '';
  },

  // Redirect URLs
  redirectUri: typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : 'http://localhost:3000/auth/callback',

  logoutUri: typeof window !== 'undefined'
    ? `${window.location.origin}/auth/logout`
    : 'http://localhost:3000/auth/logout',

  // OAuth scopes
  scopes: ['openid', 'email', 'profile'],

  // Token storage keys
  storageKeys: {
    accessToken: 'glassbox_access_token',
    idToken: 'glassbox_id_token',
    refreshToken: 'glassbox_refresh_token',
    expiresAt: 'glassbox_expires_at',
  },
} as const;

// Build the Cognito hosted UI URLs
export function getLoginUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: authConfig.clientId,
    response_type: 'code',
    scope: authConfig.scopes.join(' '),
    redirect_uri: authConfig.redirectUri,
  });

  if (state) {
    params.set('state', state);
  }

  return `${authConfig.domain}/login?${params.toString()}`;
}

export function getLogoutUrl(): string {
  const params = new URLSearchParams({
    client_id: authConfig.clientId,
    logout_uri: authConfig.logoutUri,
  });

  return `${authConfig.domain}/logout?${params.toString()}`;
}

export function getTokenUrl(): string {
  return `${authConfig.domain}/oauth2/token`;
}

// Check if auth is configured (for development mode fallback)
export function isAuthConfigured(): boolean {
  return !!(authConfig.userPoolId && authConfig.clientId && authConfig.domain);
}

// Check if we're in development mode (no Cognito configured)
export function isDevMode(): boolean {
  return !isAuthConfigured();
}
