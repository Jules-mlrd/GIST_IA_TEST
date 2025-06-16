import { cookies } from 'next/headers';
const { SignJWT, jwtVerify } = require('jose');

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'supersecret');
const COOKIE_NAME = 'auth_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 8, // 8 hours
};

export async function setLoginSession(res: any, user: { username: string; role: string }) {
  const token = await new SignJWT({ username: user.username, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(JWT_SECRET);
  res.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS);
}

export async function getLoginSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

export function clearLoginSession(res: any) {
  res.cookies.set(COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 });
}
