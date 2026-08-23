/**
 * Next.js Edge Middleware
 * 
 * Refreshes Supabase auth session tokens on every request and redirects
 * incoming OAuth authorization codes to `/auth/callback`.
 */
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  
  // Redirects OAuth authorization codes to dedicated callback route
  if (url.pathname === '/' && url.searchParams.has('code')) {
    const callbackUrl = new URL('/auth/callback', request.url);
    callbackUrl.search = url.search;
    return NextResponse.redirect(callbackUrl);
  }

  return createClient(request);
}

export const config = {
  matcher: [
    // Matches all routes except static assets, images, and public media
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
