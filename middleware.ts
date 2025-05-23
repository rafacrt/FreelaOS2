
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionFromToken } from '@/lib/auth-edge'; // Import from Edge-safe auth file
import { AUTH_COOKIE_NAME } from '@/lib/constants'; 

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log(`[Middleware] Processing request for path: ${pathname}`);
  
  const allCookies = request.cookies.getAll();
  console.log('[Middleware] All cookies received:', allCookies.map(c => ({name: c.name, value: c.value.substring(0,10)+'...'})));


  const publicPaths = ['/login', '/register', '/health'];

  // Avoid processing for static assets and API routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') // Heuristic for files like favicon.ico, image.png
  ) {
    // console.log(`[Middleware] Allowing request to proceed for path: ${pathname}`);
    return NextResponse.next();
  }

  const tokenValue = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  console.log(`[Middleware] Token value from cookie '${AUTH_COOKIE_NAME}': ${tokenValue ? tokenValue.substring(0,20)+'...' : 'undefined'}`);
  
  const session = await getSessionFromToken(tokenValue);
  console.log(`[Middleware] Session from token:`, session);

  if (publicPaths.includes(pathname)) {
    if (session && pathname !== '/health') {
      // If user is on a public path (login/register) and is logged in, redirect to dashboard
      // (unless it's /health which should always be accessible)
      console.log(`[Middleware] User authenticated (${session.username}), redirecting from public path ${pathname} to /dashboard`);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    // console.log(`[Middleware] Allowing access to public path: ${pathname}`);
    return NextResponse.next();
  }

  // For all other paths (protected routes)
  if (!session) {
    // If no session, redirect to login
    console.log(`[Middleware] No session, redirecting from protected path ${pathname} to /login`);
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  
  // Check if user is approved
  if (!session.isApproved) {
     console.log(`[Middleware] User ${session.username} is not approved. Redirecting to /login with status.`);
     const loginUrl = new URL('/login', request.url);
     loginUrl.searchParams.set('status', 'not_approved'); // Add status for user feedback
     const response = NextResponse.redirect(loginUrl);
     response.cookies.delete(AUTH_COOKIE_NAME); // Clear the cookie
     return response;
  }

  // If session exists and user is approved, allow access
  console.log(`[Middleware] Session found for approved user ${session.username}, allowing access to ${pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
