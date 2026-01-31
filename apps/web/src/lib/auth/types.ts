import type { User } from '@glassbox/shared-types';

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  tokens: AuthTokens | null;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  login: (returnTo?: string) => void;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
  getAccessToken: () => Promise<string | null>;
  getWsToken: () => Promise<string | null>;
}

export interface TokenResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface CognitoIdTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  'cognito:username': string;
  'custom:orgId'?: string;
  iat: number;
  exp: number;
  aud: string;
  iss: string;
}

// Dev mode auth for local development without Cognito
export interface DevAuthPayload {
  userId: string;
  email: string;
  name?: string;
  orgId?: string;
}
