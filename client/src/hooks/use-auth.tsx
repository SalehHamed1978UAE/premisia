import { createContext, ReactNode, useContext, useEffect, useState, useCallback } from "react";
import { User as SelectUser } from "@shared/schema";
import { supabase, getAccessToken, isSupabaseConfigured, supabaseConfigError } from "../lib/supabase";
import { queryClient } from "../lib/queryClient";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  authConfigError: string | null;
};

export const AuthContext = createContext<AuthContextType | null>(null);

async function fetchInternalUser(retries = 2): Promise<SelectUser | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const res = await fetch('/api/auth/user', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      const { data: { session } } = await supabase.auth.refreshSession();
      if (session) {
        return fetchInternalUser(retries - 1);
      }
    }
    return null;
  }

  if (!res.ok) {
    const details = await res.text().catch(() => "");
    throw new Error(`Failed to fetch internal user: ${res.status} ${details}`);
  }

  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SelectUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const internalUser = await fetchInternalUser();
      if (internalUser) {
        setUser(internalUser);
        return true;
      }
      setUser((previous) => previous ?? null);
      return false;
    } catch (error) {
      console.error('[Auth] Failed to load internal user:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const waitForSession = async (attempts = 10, delayMs = 300) => {
      for (let i = 0; i < attempts; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) return session;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return null;
    };

    const bootstrap = async () => {
      try {
        setIsLoading(true);
        // Explicitly handle OAuth PKCE callback code. This avoids relying only on
        // implicit URL detection and fixes cases where users remain in login limbo.
        const query = new URLSearchParams(window.location.search);
        const oauthCode = query.get('code');
        if (oauthCode) {
          // Supabase auto-processing can be slightly delayed; wait briefly first.
          let callbackSession = await waitForSession(8, 250);
          try {
            if (!callbackSession) {
              const { data, error } = await supabase.auth.exchangeCodeForSession(oauthCode);
              if (error) throw error;
              callbackSession = data.session ?? null;
            }
          } catch (exchangeError) {
            const message = exchangeError instanceof Error ? exchangeError.message : String(exchangeError);
            // AbortError may happen during race with internal auto-handler; treat as transient.
            if (!/abort/i.test(message)) {
              console.error('[Auth] Failed to exchange OAuth code for session:', exchangeError);
            }
          } finally {
            // Final check after exchange path.
            if (!callbackSession) {
              await waitForSession(6, 250);
            }
            // Remove OAuth artifacts from URL after processing.
            const cleaned = new URL(window.location.href);
            cleaned.searchParams.delete('code');
            cleaned.searchParams.delete('state');
            window.history.replaceState({}, document.title, `${cleaned.pathname}${cleaned.search}${cleaned.hash}`);
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (session) {
          await loadUser();
        } else {
          setUser(null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;

      void (async () => {
        if (session) {
          setIsLoading(true);
          await loadUser();
          if (!cancelled) setIsLoading(false);
          return;
        }

        // Supabase can briefly emit a null session during refresh/handshake.
        // Re-check once before treating it as a real logout.
        setIsLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 400));
        const { data: { session: recheckedSession } } = await supabase.auth.getSession();

        if (recheckedSession) {
          await loadUser();
          if (!cancelled) setIsLoading(false);
          return;
        }

        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
      })();
    });

    bootstrap();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadUser]);

  const loginWithGoogle = async () => {
    if (!isSupabaseConfigured) {
      throw new Error(supabaseConfigError || "Supabase is not configured");
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
  };

  const loginWithEmail = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      throw new Error(supabaseConfigError || "Supabase is not configured");
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      throw new Error(supabaseConfigError || "Supabase is not configured");
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
  };

  const sendMagicLink = async (email: string) => {
    if (!isSupabaseConfigured) {
      throw new Error(supabaseConfigError || "Supabase is not configured");
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
  };

  const logout = async () => {
    if (!isSupabaseConfigured) {
      setUser(null);
      queryClient.clear();
      window.location.href = '/auth';
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
    queryClient.clear();
    window.location.href = '/auth';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        loginWithGoogle,
        loginWithEmail,
        signUpWithEmail,
        sendMagicLink,
        logout,
        authConfigError: supabaseConfigError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
