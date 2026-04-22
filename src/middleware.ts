import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret === 'fallback-secret-change-me') {
    throw new Error('AUTH_SECRET must be configured');
  }
  return new TextEncoder().encode(secret);
}

// Paths that don't require authentication
const publicPaths = ['/login', '/api/auth/login', '/quorum-display', '/vote-results'];

// Role-based path access
const roleAccess: Record<string, string[]> = {
  '/admin': ['SUPER_ADMIN'],
  '/setup': ['SUPER_ADMIN', 'SYSTEM_ADMIN'],
  '/registration': ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'REGISTRATION_STAFF'],
  '/tallying': ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TALLYING_STAFF'],
  '/chairman': ['SUPER_ADMIN', 'CHAIRMAN'],
  '/auditor': ['SUPER_ADMIN', 'AUDITOR'],
  '/dashboard': ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'REGISTRATION_STAFF', 'TALLYING_STAFF', 'CHAIRMAN', 'AUDITOR'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow API routes except protected ones
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/session')) {
    // API routes handle their own auth
    return NextResponse.next();
  }

  // Allow static files
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Check for token
  const token = request.cookies.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(token.value, getJwtSecret());
    const userRole = payload.role as string;

    // Check role-based access
    for (const [pathPrefix, allowedRoles] of Object.entries(roleAccess)) {
      if (pathname.startsWith(pathPrefix)) {
        if (!allowedRoles.includes(userRole)) {
          // Redirect to first allowed page for their role
          return NextResponse.redirect(new URL('/login', request.url));
        }
        break;
      }
    }

    return NextResponse.next();
  } catch {
    // Invalid token
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set('token', '', { maxAge: 0 });
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
