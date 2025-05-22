
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth'; // We'll use this to check session

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Paths that don't require authentication
  const publicPaths = ['/login', '/register', '/health'];

  // Avoid processing for static assets and API routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') // Assume files with extensions are static assets
  ) {
    return NextResponse.next();
  }

  const session = await getSession(); // Check for active session

  if (publicPaths.includes(pathname)) {
    // If user is on a public path (login/register)
    if (session && pathname !== '/health') {
      // And is already logged in, redirect to dashboard
      // (unless it's /health which should always be accessible)
      console.log(`[Middleware] User authenticated, redirecting from ${pathname} to /dashboard`);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    // Otherwise, allow access to public path
    return NextResponse.next();
  }

  // For all other paths (protected routes)
  if (!session) {
    // If no session, redirect to login
    console.log(`[Middleware] No session, redirecting from ${pathname} to /login`);
    let from = pathname;
    if (request.nextUrl.search) {
      from += request.nextUrl.search;
    }
    const loginUrl = new URL('/login', request.url);
    // loginUrl.searchParams.set('from', from); // Optional: redirect back after login
    return NextResponse.redirect(loginUrl);
  }

  // If session exists and path is not public, allow access
  console.log(`[Middleware] Session found for ${session.username}, allowing access to ${pathname}`);
  return NextResponse.next();
}

export const config = {
  // Matcher ensures middleware runs for relevant paths
  // Adjusted to exclude favicon.ico more reliably and include root for checks
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
