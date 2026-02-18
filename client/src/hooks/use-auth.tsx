import { createContext, ReactNode, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User as SelectUser } from "@shared/schema";
import { supabase, getAccessToken } from "../lib/supabase";
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

  const loadUser = useCallback(async (setLoadingFlag = false) => {
    if (setLoadingFlag) {
      setIsLoading(true);
    }
    try {
      const internalUser = await fetchInternalUser();
      setUser(internalUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!initializedRef.current) {
        initializedRef.current = true;
        if (session) {
          loadUser();
        } else {
          setUser(null);
          setIsLoading(false);
        }
      } else {
        if (session) {
          loadUser(true);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    });

    const timer = setTimeout(() => {
      if (!initializedRef.current) {
        initializedRef.current = true;
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            loadUser();
          } else {
            setIsLoading(false);
          }
        });
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [loadUser]);

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
  };

  const loginWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUpWithEmail = async (email: string, password: string) => {
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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
  };

  const logout = async () => {
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
