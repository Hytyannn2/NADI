/**
 * Supabase Auth Callback Route
 * 
 * Handles both OAuth code exchange (Google login) and email verification
 * token_hash flows (signup confirmation, password recovery).
 */
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';

function getSafeOrigin(request: NextRequest): string {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;
  const proto = request.headers.get('x-forwarded-proto') || (url.protocol ? url.protocol.replace(':', '') : 'http');

  // If host or origin is 0.0.0.0 (or ::), convert to localhost for valid browser navigation
  let cleanHost = host.replace(/^(0\.0\.0\.0|::|\[::\])/, 'localhost');

  let cleanOrigin = `${proto}://${cleanHost}`;
  if (cleanOrigin.includes('0.0.0.0')) {
    cleanOrigin = cleanOrigin.replace('0.0.0.0', 'localhost');
  }

  // Fallback to url.origin if cleanHost was empty
  if (!cleanHost && url.origin) {
    cleanOrigin = url.origin.replace('0.0.0.0', 'localhost');
  }

  return cleanOrigin;
}

function getSafeRedirectPath(next: string | null): string {
  if (!next) return '/';

  // Only allow relative paths starting with /
  if (!next.startsWith('/')) return '/';

  // Block protocol-based URLs or Windows backslash bypasses (e.g. //evil.com, /\evil.com, /https:)
  if (next.includes(':') || next.includes('\\')) return '/';

  // Block double slashes that browsers interpret as protocol-relative URLs (e.g. //evil.com)
  if (next.startsWith('//')) return '/';

  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const safeOrigin = getSafeOrigin(request);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = getSafeRedirectPath(searchParams.get('next'));

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Flow 1: OAuth / PKCE code exchange (Google login, etc.)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${safeOrigin}${next}`);
    }
    return NextResponse.redirect(`${safeOrigin}/?error=auth_code_exchange_failed`);
  }

  // Flow 2: Email verification / Magic link / Password recovery via token_hash
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      // Password recovery: redirect to reset page so user can set new password
      if (type === 'recovery') {
        return NextResponse.redirect(`${safeOrigin}/auth/reset`);
      }
      // Email verification: redirect to homepage with success flag
      return NextResponse.redirect(`${safeOrigin}/?verified=true`);
    }
    return NextResponse.redirect(`${safeOrigin}/?error=verification_expired`);
  }

  // Fallback: no valid params
  return NextResponse.redirect(`${safeOrigin}/?error=auth_failed`);
}
