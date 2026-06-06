import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/auth';

const publicRoutes = ['/login'];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);

  const cookie = request.cookies.get('session')?.value;
  const session = await decrypt(cookie);

  if (!isPublicRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isPublicRoute && session?.userId) {
    // If logged in and trying to access login page, redirect to dashboard
    if (session.role === 'Admin') {
      return NextResponse.redirect(new URL('/admin', request.url));
    } else {
      return NextResponse.redirect(new URL('/surgeon', request.url));
    }
  }

  // Role-based protection
  if (path.startsWith('/admin') && session?.role !== 'Admin') {
    return NextResponse.redirect(new URL('/surgeon', request.url));
  }

  if (path.startsWith('/surgeon') && session?.role !== 'Surgeon') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
