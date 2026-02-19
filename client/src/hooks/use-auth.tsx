import { createContext, ReactNode, useContext, useEffect, useState, useCallback, useRef } from "react";
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

  try {
    const res = await fetch('/api/auth/user', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401 && retries > 0) {
      await new Promise(r => setTimeout(r, 1000));
      const { data: { session } } = await supabase.auth.refreshSession();
      if (session) {
        return fetchInternalUser(retries - 1);
      }
      return null;
    }

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SelectUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initializedRef = useRef(false);

  const loadUser = useCallback(async () => {
    try {
      const internalUser = await fetchInternalUser();
      setUser(internalUser);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      try {
        setIsLoading(true);
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
        if (!cancelled) {
          initializedRef.current = true;
          setIsLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled || !initializedRef.current) return;
      if (session) {
        setIsLoading(true);
        await loadUser();
        if (!cancelled) {
          setIsLoading(false);
        }
      } else if (!cancelled) {
        setUser(null);
        setIsLoading(false);
      }
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
