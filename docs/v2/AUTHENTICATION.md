# GlassBox V2 Frontend Authentication

This document covers the authentication system in the GlassBox frontend, including AWS Cognito integration, development mode, token management, and protected routes.

---

## Overview

The frontend supports two authentication modes:

| Mode | Use Case | Configuration |
|------|----------|---------------|
| **Production** | AWS Cognito OAuth/OIDC | Requires Cognito env vars |
| **Development** | Mock JWT tokens | No config needed |

---

## Authentication Flow

### Production Flow (Cognito)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cognito OAuth Flow                            │
│                                                                  │
│  1. User clicks "Login"                                         │
│     └─▶ Redirect to Cognito Hosted UI                           │
│         https://{domain}.auth.{region}.amazoncognito.com/login  │
│         ?client_id={clientId}                                   │
│         &response_type=code                                     │
│         &scope=openid+email+profile                             │
│         &redirect_uri={callbackUrl}                             │
│         &state={csrfToken}                                      │
│                                                                  │
│  2. User authenticates with Cognito                             │
│     └─▶ Redirects back to /auth/callback?code={code}&state=...  │
│                                                                  │
│  3. Frontend exchanges code for tokens                          │
│     └─▶ POST /api/auth/callback { code, redirectUri }           │
│         └─▶ Backend calls Cognito /oauth2/token                 │
│             Response: { access_token, id_token, refresh_token } │
│                                                                  │
│  4. Tokens stored in localStorage                               │
│     └─▶ glassbox_access_token                                   │
│         glassbox_id_token                                       │
│         glassbox_refresh_token                                  │
│         glassbox_expires_at                                     │
│                                                                  │
│  5. User redirected to dashboard or saved returnUrl             │
└─────────────────────────────────────────────────────────────────┘
```

### Development Flow (Mock JWT)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Development Login Flow                        │
│                                                                  │
│  1. User visits /auth/dev-login                                 │
│                                                                  │
│  2. Selects preset user or enters custom credentials:           │
│     ┌────────────────────────────────────────────────────────┐ │
│     │  Preset Users:                                          │ │
│     │  • admin@glassbox.dev (Owner)                          │ │
│     │  • member@glassbox.dev (Member)                        │ │
│     │  • viewer@glassbox.dev (Viewer)                        │ │
│     │                                                         │ │
│     │  Custom Login:                                          │ │
│     │  • Email: [________________]                            │ │
│     │  • Name:  [________________]                            │ │
│     └────────────────────────────────────────────────────────┘ │
│                                                                  │
│  3. Mock JWT created client-side                                │
│     └─▶ Base64-encoded payload (not cryptographically signed)  │
│         { sub, email, name, iat, exp }                          │
│                                                                  │
│  4. Token stored in localStorage                                │
│     └─▶ 24-hour expiration                                      │
│                                                                  │
│  5. Redirect to dashboard                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_COGNITO_REGION` | No | AWS region (default: `us-east-1`) |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | For prod | Cognito User Pool ID |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | For prod | Cognito App Client ID |
| `NEXT_PUBLIC_COGNITO_DOMAIN` | For prod | Cognito domain prefix |

### Configuration File

**Location:** `apps/web/src/lib/auth/config.ts`

```typescript
export const authConfig = {
  region: process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1',
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
  domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '',
  scopes: ['openid', 'email', 'profile'],
};

// Helper functions
export function isAuthConfigured(): boolean {
  return !!(authConfig.userPoolId && authConfig.clientId && authConfig.domain);
}

export function isDevMode(): boolean {
  return !isAuthConfigured();
}

export function getLoginUrl(returnTo?: string): string {
  // Returns Cognito hosted UI URL with proper params
}

export function getLogoutUrl(): string {
  // Returns Cognito logout URL
}

export function getTokenUrl(): string {
  // Returns Cognito token endpoint
}
```

---

## Token Management

### Storage

Tokens are stored in `localStorage` with the following keys:

| Key | Content |
|-----|---------|
| `glassbox_access_token` | JWT access token for API calls |
| `glassbox_id_token` | JWT with user identity claims |
| `glassbox_refresh_token` | Token for refreshing access token |
| `glassbox_expires_at` | Unix timestamp of expiration |

### Token Refresh

```
┌─────────────────────────────────────────────────────────────────┐
│                    Token Refresh Logic                           │
│                                                                  │
│  On every API call:                                             │
│                                                                  │
│  1. Check if access token expires within 5 minutes             │
│                                                                  │
│  2. If expiring soon:                                           │
│     └─▶ POST /api/auth/refresh { refreshToken }                 │
│         └─▶ Backend calls Cognito with refresh_token            │
│             Response: { access_token, id_token }                │
│                                                                  │
│  3. Update stored tokens                                        │
│                                                                  │
│  4. Continue with original request using new token              │
│                                                                  │
│  If refresh fails:                                               │
│  └─▶ Clear all tokens                                           │
│      Redirect to /auth/login                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Auth Context

**Location:** `apps/web/src/lib/auth/auth-context.tsx`

### State Interface

```typescript
interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  tokens: AuthTokens | null;
  error: string | null;
}

interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}
```

### Context Methods

```typescript
interface AuthContextValue extends AuthState {
  // Initiate login flow
  login: (returnTo?: string) => void;

  // Clear tokens and logout
  logout: () => void;

  // Refresh access token using refresh token
  refreshSession: () => Promise<void>;

  // Get current access token (refreshing if needed)
  getAccessToken: () => Promise<string | null>;

  // Get WebSocket auth token from backend
  getWsToken: () => Promise<string | null>;
}
```

### Usage

```tsx
import { useAuth } from '@/lib/auth';

function MyComponent() {
  const { isAuthenticated, user, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <button onClick={() => login()}>Login</button>;
  }

  return (
    <div>
      <p>Welcome, {user?.name}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

## Protected Routes

### ProtectedRoute Component

**Location:** `apps/web/src/components/auth/protected-route.tsx`

```tsx
interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Save current path to return after login
      const returnUrl = encodeURIComponent(pathname);
      router.push(`/auth/login?returnTo=${returnUrl}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return <>{children}</>;
}
```

### Usage in Pages

```tsx
// app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
```

### Protected Pages

| Route | Protection |
|-------|------------|
| `/dashboard` | ProtectedRoute |
| `/projects/[projectId]` | ProtectedRoute |
| `/` | Public |
| `/auth/*` | Public |
| `/showcase` | Public |

---

## API Routes

### POST /api/auth/callback

**Purpose:** Exchange authorization code for tokens

**Location:** `apps/web/src/app/api/auth/callback/route.ts`

```typescript
// Request
{
  "code": "authorization_code_from_cognito",
  "redirectUri": "http://localhost:3000/auth/callback"
}

// Response (success)
{
  "access_token": "eyJ...",
  "id_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600
}

// Response (error)
{
  "error": "invalid_grant",
  "error_description": "Invalid authorization code"
}
```

### POST /api/auth/refresh

**Purpose:** Refresh access token using refresh token

**Location:** `apps/web/src/app/api/auth/refresh/route.ts`

```typescript
// Request
{
  "refreshToken": "eyJ..."
}

// Response (success)
{
  "access_token": "eyJ...",
  "id_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### POST /api/auth/ws-token

**Purpose:** Get WebSocket authentication token from backend

**Location:** `apps/web/src/app/api/auth/ws-token/route.ts`

```typescript
// Request headers
Authorization: Bearer {accessToken}

// Response
{
  "token": "ws-token-from-backend",
  "expiresAt": "2024-01-20T12:00:00Z"
}
```

---

## Development Login

### Dev Login Page

**Location:** `apps/web/src/app/auth/dev-login/page.tsx`

The dev login page is only accessible when `isDevMode()` returns true (Cognito not configured).

### Preset Users

| Email | Name | Role |
|-------|------|------|
| `admin@glassbox.dev` | Admin User | owner |
| `member@glassbox.dev` | Team Member | member |
| `viewer@glassbox.dev` | Viewer | viewer |

### Mock Token Structure

```typescript
// Mock JWT payload (base64 encoded, not signed)
{
  sub: crypto.randomUUID(),
  email: 'admin@glassbox.dev',
  name: 'Admin User',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
}

// Token format: header.payload.signature
// In dev mode: btoa(JSON.stringify(payload))
```

---

## Security Considerations

### Token Storage

| Concern | Mitigation |
|---------|------------|
| XSS attacks could steal tokens | Tokens in localStorage are accessible to JS. Consider HttpOnly cookies for production. |
| Token interception | Use HTTPS in production |
| Token expiration | 5-minute refresh buffer prevents expired token usage |

### CSRF Protection

- State parameter in OAuth flow
- Validated on callback

### Current Limitations

1. **localStorage vulnerability** - Tokens accessible to any JS on the page
2. **No token encryption** - Stored as plain text
3. **Client-side JWT parsing** - No signature verification (trusted backend)

### Recommended Production Improvements

1. **HttpOnly cookies** - Store refresh token in HttpOnly cookie
2. **Short-lived access tokens** - 15-minute expiration
3. **Token rotation** - New refresh token on each refresh
4. **Secure flag** - Cookies only over HTTPS

---

## Backend Integration

### Required Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/auth/ws-token` | Generate WebSocket auth token |
| `POST /oauth2/token` (Cognito) | Token exchange |

### Token Validation

Backend should:
1. Verify JWT signature using Cognito public keys
2. Check token expiration
3. Validate audience (client ID)
4. Check token issuer (Cognito URL)

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid state parameter" | CSRF token mismatch. Clear localStorage and retry. |
| "Token refresh failed" | Refresh token expired. User must re-login. |
| "Not authenticated" loop | Clear localStorage, check network tab for errors. |
| Dev login not appearing | Check if Cognito env vars are set (should be empty for dev) |

### Debug Tips

```javascript
// Check stored tokens in browser console
localStorage.getItem('glassbox_access_token');
localStorage.getItem('glassbox_expires_at');

// Decode JWT payload (base64)
JSON.parse(atob(token.split('.')[1]));
```
