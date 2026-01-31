import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = [
  '/',
  '/auth/login',
  '/auth/callback',
  '/auth/logout',
  '/auth/dev-login',
  '/showcase',
];

// Routes that start with these prefixes are public
const publicPrefixes = [
  '/api/auth/',
  '/_next/',
  '/favicon.ico',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if route is public
  const isPublicRoute = publicRoutes.includes(pathname);
  const isPublicPrefix = publicPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (isPublicRoute || isPublicPrefix) {
    return NextResponse.next();
  }

  // For protected routes, we need to check auth
  // Since we use localStorage for tokens (client-side), we can't directly check here
  // Instead, the AuthProvider on the client will redirect unauthenticated users

  // For server-side protection with cookies (optional future enhancement),
  // you would check for an auth cookie here:
  // const authToken = request.cookies.get('auth_token');
  // if (!authToken) {
  //   const loginUrl = new URL('/auth/login', request.url);
  //   loginUrl.searchParams.set('returnTo', pathname);
  //   return NextResponse.redirect(loginUrl);
  // }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
