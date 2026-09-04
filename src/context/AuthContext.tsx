/**
 * Authentication Context
 * 
 * Provides Supabase session state, active user profile, and sign-out methods.
 */
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User, type AuthChangeEvent, type AuthError } from '@supabase/supabase-js';
import { createClient } from '@/src/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    // Safety timeout: ensures the loading screen clears within 1 second
    const safetyTimer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 1000);

    // Fetches active session on initial mount with stale token recovery
    supabase.auth.getSession()
      .then(async (res: { data: { session: Session | null }; error: AuthError | null }) => {
        const { data, error } = res;
        const session = data?.session ?? null;
        if (error) {
          const msg = error.message || '';
          if (
            msg.includes('Refresh Token') ||
            msg.includes('refresh_token_not_found') ||
            (error as any).status === 400
          ) {
            console.warn('[AuthContext] Stale or invalid refresh token detected. Purging corrupted session.');
            try {
              await supabase.auth.signOut({ scope: 'local' });
            } catch {}
            if (mounted) {
              setSession(null);
              setUser(null);
            }
          }
          return;
        }
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
        }
      })
      .catch(async (err: any) => {
        console.warn('[AuthContext] Session fetch warning:', err);
        const msg = err?.message || '';
        if (msg.includes('Refresh Token') || msg.includes('refresh_token_not_found') || err?.status === 400) {
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {}
          if (mounted) {
            setSession(null);
            setUser(null);
          }
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // Subscribes to Supabase auth state changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_OUT') {
        if (mounted) {
          setSession(null);
          setUser(null);
          setLoading(false);
        }
        return;
      }
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // If server sign out fails (e.g. token already dead), force local sign out
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {}
    } finally {
      setSession(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
