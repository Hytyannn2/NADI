/**
 * Browser-side Supabase client for client components.
 * Configured with isSingleton: true so all client components share the same
 * cached browser client instance and token refresh state.
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      isSingleton: true,
    }
  );
}

