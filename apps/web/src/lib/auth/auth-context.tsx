'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@glassbox/shared-types';
import { authConfig, getLoginUrl, getLogoutUrl, isAuthConfigured } from './config';
import type { AuthContextValue, AuthState, AuthTokens, CognitoIdTokenPayload } from './types';
import { api } from '@/lib/api';

const AuthContext = React.createContext<AuthContextValue | null>(null);

// Parse JWT token without verification (browser-side)
function parseJwt<T>(token: string): T | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Get tokens from localStorage
function getStoredTokens(): AuthTokens | null {
  if (typeof window === 'undefined') return null;

  const accessToken = localStorage.getItem(authConfig.storageKeys.accessToken);
  const idToken = localStorage.getItem(authConfig.storageKeys.idToken);
  const refreshToken = localStorage.getItem(authConfig.storageKeys.refreshToken);
  const expiresAt = localStorage.getItem(authConfig.storageKeys.expiresAt);

  if (!accessToken || !idToken || !refreshToken || !expiresAt) {
    return null;
  }

  return {
    accessToken,
    idToken,
    refreshToken,
    expiresAt: parseInt(expiresAt, 10),
  };
}

// Store tokens in localStorage
function storeTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(authConfig.storageKeys.accessToken, tokens.accessToken);
  localStorage.setItem(authConfig.storageKeys.idToken, tokens.idToken);
  localStorage.setItem(authConfig.storageKeys.refreshToken, tokens.refreshToken);
  localStorage.setItem(authConfig.storageKeys.expiresAt, tokens.expiresAt.toString());
}

// Clear tokens from localStorage
function clearTokens(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(authConfig.storageKeys.accessToken);
  localStorage.removeItem(authConfig.storageKeys.idToken);
  localStorage.removeItem(authConfig.storageKeys.refreshToken);
  localStorage.removeItem(authConfig.storageKeys.expiresAt);
}

// Check if tokens are expired (with 5 minute buffer)
function isTokenExpired(expiresAt: number): boolean {
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  return Date.now() >= expiresAt - bufferMs;
}

// Extract user info from ID token
function extractUserFromIdToken(idToken: string): Partial<User> | null {
  const payload = parseJwt<CognitoIdTokenPayload>(idToken);
  if (!payload) return null;

  return {
    id: payload.sub,
    cognitoSub: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
  };
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const [state, setState] = React.useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    tokens: null,
    error: null,
  });

  // Initialize auth state from stored tokens
  React.useEffect(() => {
    const initAuth = async () => {
      // Check for dev mode token first
      const devToken = localStorage.getItem('auth_token');
      if (devToken && !isAuthConfigured()) {
        // Dev mode - use the simple JWT token
        try {
          const response = await api.users.me();
          setState({
            isAuthenticated: true,
            isLoading: false,
            user: response,
            tokens: {
              accessToken: devToken,
              idToken: devToken,
              refreshToken: '',
              expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
            },
            error: null,
          });
          return;
        } catch {
          // Token invalid, clear it
          localStorage.removeItem('auth_token');
        }
      }

      // Production mode - check Cognito tokens
      const tokens = getStoredTokens();
      if (!tokens) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      // Check if tokens are expired
      if (isTokenExpired(tokens.expiresAt)) {
        // Try to refresh
        const refreshed = await refreshSession();
        if (!refreshed) {
          clearTokens();
          setState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            tokens: null,
            error: null,
          });
          return;
        }
      }

      // Extract user from ID token
      const userInfo = extractUserFromIdToken(tokens.idToken);
      if (!userInfo) {
        clearTokens();
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          tokens: null,
          error: 'Invalid token',
        });
        return;
      }

      // Fetch full user profile from API
      try {
        const fullUser = await api.users.me();
        setState({
          isAuthenticated: true,
          isLoading: false,
          user: fullUser,
          tokens,
          error: null,
        });
      } catch {
        // User may not exist in our DB yet, use token info
        setState({
          isAuthenticated: true,
          isLoading: false,
          user: userInfo as User,
          tokens,
          error: null,
        });
      }
    };

    initAuth();
  }, []);

  // Login - redirect to Cognito hosted UI
  const login = React.useCallback((returnTo?: string) => {
    if (!isAuthConfigured()) {
      // Dev mode - redirect to dev login page
      router.push(`/auth/dev-login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`);
      return;
    }

    // Store return URL for after auth
    if (returnTo) {
      sessionStorage.setItem('auth_return_to', returnTo);
    }

    // Redirect to Cognito hosted UI
    window.location.href = getLoginUrl();
  }, [router]);

  // Logout
  const logout = React.useCallback(() => {
    clearTokens();
    localStorage.removeItem('auth_token'); // Dev mode token

    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      tokens: null,
      error: null,
    });

    if (isAuthConfigured()) {
      // Redirect to Cognito logout
      window.location.href = getLogoutUrl();
    } else {
      // Dev mode - just redirect to home
      router.push('/');
    }
  }, [router]);

  // Refresh session using refresh token
  const refreshSession = React.useCallback(async (): Promise<boolean> => {
    const tokens = getStoredTokens();
    if (!tokens?.refreshToken) {
      return false;
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const newTokens: AuthTokens = {
        accessToken: data.access_token,
        idToken: data.id_token,
        refreshToken: data.refresh_token || tokens.refreshToken,
        expiresAt: Date.now() + data.expires_in * 1000,
      };

      storeTokens(newTokens);

      const userInfo = extractUserFromIdToken(newTokens.idToken);
      setState((prev) => ({
        ...prev,
        tokens: newTokens,
        user: userInfo as User || prev.user,
      }));

      return true;
    } catch {
      return false;
    }
  }, []);

  // Get current access token (refreshing if needed)
  const getAccessToken = React.useCallback(async (): Promise<string | null> => {
    // Dev mode
    const devToken = localStorage.getItem('auth_token');
    if (devToken && !isAuthConfigured()) {
      return devToken;
    }

    const tokens = getStoredTokens();
    if (!tokens) return null;

    if (isTokenExpired(tokens.expiresAt)) {
      const refreshed = await refreshSession();
      if (!refreshed) return null;
      return getStoredTokens()?.accessToken || null;
    }

    return tokens.accessToken;
  }, [refreshSession]);

  // Get WebSocket token from API
  const getWsToken = React.useCallback(async (): Promise<string | null> => {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;

    try {
      const response = await fetch('/api/auth/ws-token', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.token;
    } catch {
      return null;
    }
  }, [getAccessToken]);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    refreshSession,
    getAccessToken,
    getWsToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
