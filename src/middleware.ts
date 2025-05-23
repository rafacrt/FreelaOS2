
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionFromToken } from '@/lib/auth-edge'; // Import from Edge-safe auth file
import { AUTH_COOKIE_NAME } from '@/lib/constants'; 

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicPaths = ['/login', '/register', '/health'];

  // Avoid processing for static assets and API routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') 
  ) {
    return NextResponse.next();
  }

  const tokenValue = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await getSessionFromToken(tokenValue); // Use Edge-safe getSessionFromToken

  if (publicPaths.includes(pathname)) {
    if (session && pathname !== '/health') {
      // If user is on a public path (login/register) and is logged in, redirect to dashboard
      // (unless it's /health which should always be accessible)
      console.log(`[Middleware] User authenticated (${session.username}), redirecting from ${pathname} to /dashboard`);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    // Otherwise, allow access to public path
    return NextResponse.next();
  }

  // For all other paths (protected routes)
  if (!session) {
    // If no session, redirect to login
    console.log(`[Middleware] No session, redirecting from ${pathname} to /login`);
    const loginUrl = new URL('/login', request.url);
    // Optional: redirect back after login
    // loginUrl.searchParams.set('from', pathname + request.nextUrl.search); 
    return NextResponse.redirect(loginUrl);
  }
  
  // Check if user is approved
  if (!session.isApproved) {
     console.log(`[Middleware] User ${session.username} is not approved. Redirecting to /login with status.`);
     const loginUrl = new URL('/login', request.url);
     loginUrl.searchParams.set('status', 'not_approved'); // Add status for user feedback
     // It's good practice to delete the invalid/unapproved session cookie
     const response = NextResponse.redirect(loginUrl);
     response.cookies.delete(AUTH_COOKIE_NAME); // Clear the cookie
     return response;
  }

  // If session exists and user is approved, allow access
  console.log(`[Middleware] Session found for approved user ${session.username}, allowing access to ${pathname}`);
  return NextResponse.next();
}

export const config = {
  // Matcher ensures middleware runs for relevant paths
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
