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

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/';

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Flow 1: OAuth / PKCE code exchange (Google login, etc.)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(`${origin}/?error=auth_code_exchange_failed`);
  }

  // Flow 2: Email verification / Magic link / Password recovery via token_hash
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      // Password recovery: redirect to reset page so user can set new password
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset`);
      }
      // Email verification: redirect to homepage with success flag
      return NextResponse.redirect(`${origin}/?verified=true`);
    }
    return NextResponse.redirect(`${origin}/?error=verification_expired`);
  }

  // Fallback: no valid params
  return NextResponse.redirect(`${origin}/?error=auth_failed`);
}
