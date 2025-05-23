
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionFromToken } from '@/lib/auth-edge'; // Import from Edge-safe auth file
import { AUTH_COOKIE_NAME } from '@/lib/constants'; 

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log(`[Middleware] Processing request for path: ${pathname}`);

  const publicPaths = ['/login', '/register', '/health'];

  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') 
  ) {
    return NextResponse.next();
  }

  const tokenValue = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  console.log(`[Middleware] Token value from cookie '${AUTH_COOKIE_NAME}': ${tokenValue ? tokenValue.substring(0,10)+'...' : 'undefined'}`);
  const session = await getSessionFromToken(tokenValue);
  console.log(`[Middleware] Session from token:`, session);

  if (publicPaths.includes(pathname)) {
    if (session && pathname !== '/health') {
      console.log(`[Middleware] User authenticated (${session.username}), redirecting from public path ${pathname} to /dashboard`);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    console.log(`[Middleware] Allowing access to public path: ${pathname}`);
    return NextResponse.next();
  }

  if (!session) {
    console.log(`[Middleware] No session, redirecting from protected path ${pathname} to /login`);
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  
  if (!session.isApproved) {
     console.log(`[Middleware] User ${session.username} is not approved. Redirecting to /login with status.`);
     const loginUrl = new URL('/login', request.url);
     loginUrl.searchParams.set('status', 'not_approved');
     const response = NextResponse.redirect(loginUrl);
     response.cookies.delete(AUTH_COOKIE_NAME); 
     return response;
  }

  console.log(`[Middleware] Session found for approved user ${session.username}, allowing access to ${pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
