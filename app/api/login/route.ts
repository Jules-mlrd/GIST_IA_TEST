// Secure login API route for authenticating users from S3 CSVs
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromS3 } from '@/lib/auth';
import { setLoginSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }
    const user = await getUserFromS3(username, password);
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const res = NextResponse.json({ success: true, user: { username: user.username, role: user.role } });
    await setLoginSession(res, user);
    return res;
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error', details: err?.message || err?.toString() }, { status: 500 });
  }
}
