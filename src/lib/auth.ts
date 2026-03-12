import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { UserRole } from '@/types';

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'fallback-secret-change-me'
);

export interface AuthUser {
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
  companyId?: string;
}

/**
 * Verify JWT token and return user info.
 * Use in API routes to protect endpoints.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token');
    if (!token) return null;

    const { payload } = await jwtVerify(token.value, JWT_SECRET);
    return {
      userId: payload.userId as string,
      username: payload.username as string,
      displayName: payload.displayName as string,
      role: payload.role as UserRole,
      companyId: payload.companyId as string | undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication, returning 401 if not authenticated.
 * Optionally restrict to specific roles.
 */
export async function requireAuth(
  allowedRoles?: UserRole[]
): Promise<AuthUser> {
  const user = await getAuthUser();
  
  if (!user) {
    throw new AuthError('Unauthorized', 401);
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new AuthError('Forbidden', 403);
  }

  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Wrapper for API route handlers with auth + error handling
 */
export function withAuth(
  handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>,
  allowedRoles?: UserRole[]
) {
  return async (req: NextRequest) => {
    try {
      const user = await requireAuth(allowedRoles);
      return await handler(req, user);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status }
        );
      }
      console.error('API Error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
