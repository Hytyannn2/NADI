/**
 * Middleware helper for updating Supabase auth cookies on incoming requests.
 */
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function createClient(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  );

  // Refreshes the session token so authenticated requests stay valid
  try {
    const { error } = await supabase.auth.getUser();
    if (error && (
      error.message?.includes('Refresh Token') ||
      error.message?.includes('refresh_token_not_found') ||
      (error as any).code === 'refresh_token_not_found'
    )) {
      // Purge stale auth cookies if the refresh token is missing or invalid
      request.cookies.getAll().forEach((cookie) => {
        if (cookie.name.includes('auth-token') || cookie.name.startsWith('sb-')) {
          supabaseResponse.cookies.delete(cookie.name);
        }
      });
    }
  } catch {
    // Middleware should never throw unhandled errors on expired or stale tokens
  }

  return supabaseResponse;
}

