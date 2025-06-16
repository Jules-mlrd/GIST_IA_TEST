import { NextRequest, NextResponse } from 'next/server';

const { jwtVerify } = require('jose');

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'supersecret');
const COOKIE_NAME = 'auth_token';

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const isLoginPage = req.nextUrl.pathname.startsWith('/login');
  if (!token) {
    if (!isLoginPage) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return NextResponse.next();
  }
  try {
    await jwtVerify(token, JWT_SECRET);
    if (isLoginPage) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  } catch {
    if (!isLoginPage) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next|api|public|favicon.ico).*)'],
};
