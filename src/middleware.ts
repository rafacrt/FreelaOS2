
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionFromToken } from '@/lib/auth-edge'; 
import { AUTH_COOKIE_NAME } from '@/lib/constants'; 
import type { SessionPayload } from '@/lib/types';

// Explicitly set the runtime to Edge
export const config = {
  runtime: 'edge',
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log(`[Middleware] Processing request for path: ${pathname}`);

  const publicPaths = ['/login', '/register', '/health', '/partner-login'];

  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') 
  ) {
    return NextResponse.next();
  }

  const tokenValue = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session: SessionPayload | null = await getSessionFromToken(tokenValue);
  // console.log(`[Middleware] Session from token:`, session);

  // Handle public paths
  if (publicPaths.includes(pathname)) {
    if (session) {
      if (session.sessionType === 'admin' && pathname !== '/health') {
        console.log(`[Middleware] Admin session active, redirecting from public path ${pathname} to /dashboard`);
        return NextResponse.redirect(new URL('/dashboard', request.url));
      } else if (session.sessionType === 'partner' && pathname !== '/health' && pathname !== '/partner-login') {
        // If partner is on /login or /register, redirect them to their dashboard
        console.log(`[Middleware] Partner session active, redirecting from public path ${pathname} to /partner/dashboard`);
        return NextResponse.redirect(new URL('/partner/dashboard', request.url));
      }
    }
    return NextResponse.next(); // Allow access to public paths if no conflicting session
  }

  // Handle protected admin routes (e.g., /dashboard, /entities, /reports)
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/entities') || pathname.startsWith('/reports') || pathname.startsWith('/calendar') || pathname.startsWith('/os/')) {
    if (!session || session.sessionType !== 'admin') {
      console.log(`[Middleware] No admin session or wrong session type for admin path ${pathname}. Redirecting to /login.`);
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    if (!session.isApproved) { // Admin users must be approved (though usually they are by default)
      console.log(`[Middleware] Admin user ${session.username} is not approved. Redirecting to /login.`);
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('status', 'not_approved');
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }
    console.log(`[Middleware] Admin session validated for ${session.username}, allowing access to ${pathname}`);
    return NextResponse.next();
  }

  // Handle protected partner routes (e.g., /partner/**)
  if (pathname.startsWith('/partner')) {
    if (!session || session.sessionType !== 'partner') {
      console.log(`[Middleware] No partner session or wrong session type for partner path ${pathname}. Redirecting to /partner-login.`);
      // If an admin is trying to access /partner, redirect them to their own dashboard
      if (session && session.sessionType === 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
      const partnerLoginUrl = new URL('/partner-login', request.url);
      return NextResponse.redirect(partnerLoginUrl);
    }
    if (!session.isApproved) {
      console.log(`[Middleware] Partner user ${session.username} is not approved. Redirecting to /partner-login.`);
      const partnerLoginUrl = new URL('/partner-login', request.url);
      partnerLoginUrl.searchParams.set('status', 'not_approved');
      const response = NextResponse.redirect(partnerLoginUrl);
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }
    console.log(`[Middleware] Partner session validated for ${session.username}, allowing access to ${pathname}`);
    return NextResponse.next();
  }
  
  // Fallback for any other routes - if not public and no session, redirect to admin login.
  // This also handles the root path ('/') if not covered by other conditions.
  if (!session) {
    console.log(`[Middleware] No session for uncategorized path ${pathname}. Redirecting to /login.`);
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
    return NextResponse.redirect(new URL('/partner/dashboard', request.url));
  }

  console.log(`[Middleware] Path ${pathname} did not match specific rules, allowing by default for session type ${session?.sessionType}.`);
  return NextResponse.next();
}
