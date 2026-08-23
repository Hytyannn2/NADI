/**
 * Supabase Auth OAuth Callback Route
 * 
 * Exchanges temporary OAuth code for a persistent session cookie and redirects user.
 */
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/src/utils/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Redirects to homepage with error flag if code exchange fails
  return NextResponse.redirect(`${origin}/?error=auth_failed`);
}
