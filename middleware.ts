
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionFromToken } from '@/lib/auth-edge'; // Import from Edge-safe auth file
import { AUTH_COOKIE_NAME } from '@/lib/constants'; 

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicPaths = ['/login', '/register', '/health'];

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
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
