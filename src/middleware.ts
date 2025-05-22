
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Avoid processing for static assets and API routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') // Assume files with extensions are static assets
   ) {
    // console.log(`[Middleware] Ignoring static/API asset: ${pathname}`);
    return NextResponse.next();
  }

  const session = await getSession(); // Check for active session

  // Redirect from "/" to "/dashboard"
  if (pathname === '/') {
    console.log('[Middleware] Redirecting from / to /dashboard');
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // For any other path, allow it to proceed.
  // This is important for /dashboard, /os/[id], etc.
  console.log(`[Middleware] Allowing request to proceed for path: ${pathname}`);
  return NextResponse.next();
}

export const config = {
  // Matcher ensures middleware runs for relevant paths
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
