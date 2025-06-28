
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionFromToken } from '@/lib/auth-edge'; // Import from Edge-safe auth file
import { AUTH_COOKIE_NAME } from '@/lib/constants';
import type { SessionPayload } from '@/lib/types';

// Explicitly set the runtime to experimental-edge
export const config = {
  runtime: 'experimental-edge', // Alterado de 'edge' para 'experimental-edge'
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicPaths = ['/login', '/register', '/health', '/partner-login'];
  const sharedProtectedPaths = ['/settings'];

  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const tokenValue = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session: SessionPayload | null = await getSessionFromToken(tokenValue);

  // Handle public paths
  if (publicPaths.includes(pathname)) {
    if (session) {
      if (session.sessionType === 'admin' && pathname !== '/health') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      } else if (session.sessionType === 'partner' && pathname !== '/health' && pathname !== '/partner-login') {
        // If partner is on /login or /register, redirect them to their dashboard
        return NextResponse.redirect(new URL('/partner/dashboard', request.url));
      }
    }
    return NextResponse.next(); // Allow access to public paths if no conflicting session
  }

  // Handle shared protected routes that both admins and partners can access
  if (sharedProtectedPaths.some(p => pathname.startsWith(p))) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (!session.isApproved) {
      const loginUrl = new URL(session.sessionType === 'admin' ? '/login' : '/partner-login', request.url);
      loginUrl.searchParams.set('status', 'not_approved');
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }
    return NextResponse.next();
  }


  // Handle protected admin routes (e.g., /dashboard, /entities, /reports)
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/entities') || pathname.startsWith('/reports') || pathname.startsWith('/calendar') || pathname.startsWith('/os/')) {
    if (!session || session.sessionType !== 'admin') {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    if (!session.isApproved) { // Admin users must be approved (though usually they are by default)
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('status', 'not_approved');
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }
    return NextResponse.next();
  }

  // Handle protected partner routes (e.g., /partner/**)
  if (pathname.startsWith('/partner')) {
    if (!session || session.sessionType !== 'partner') {
      // If an admin is trying to access /partner, redirect them to their own dashboard
      if (session && session.sessionType === 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      const partnerLoginUrl = new URL('/partner-login', request.url);
      return NextResponse.redirect(partnerLoginUrl);
    }
    if (!session.isApproved) {
      const partnerLoginUrl = new URL('/partner-login', request.url);
      partnerLoginUrl.searchParams.set('status', 'not_approved');
      const response = NextResponse.redirect(partnerLoginUrl);
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }
    return NextResponse.next();
  }

  // Fallback for any other routes - if not public and no session, redirect to admin login.
  // This also handles the root path ('/') if not covered by other conditions.
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If a session exists but doesn't match any specific route protection rules above,
  // decide where to send them based on session type.
  if (session.sessionType === 'admin') {
    if (pathname === '/') { // If admin lands on root, send to admin dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  } else if (session.sessionType === 'partner') {
     if (pathname === '/') { // If partner lands on root, send to partner dashboard
        return NextResponse.redirect(new URL('/partner/dashboard', request.url));
    }
  }

  return NextResponse.next();
}
