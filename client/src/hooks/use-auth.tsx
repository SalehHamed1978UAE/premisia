import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { User as SelectUser } from "@shared/schema";
import { supabase, getAccessToken } from "@/lib/supabase";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const queryClient = useQueryClient();

  // Listen to Supabase auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseSession(session);
      setIsSessionLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseSession(session);
      setIsSessionLoading(false);

      // Invalidate user query when auth state changes
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  // Fetch our internal user from the backend when authenticated
  const { data: user, isLoading: isUserLoading } = useQuery<SelectUser | null, Error>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      if (!supabaseSession) return null;

      const token = await getAccessToken();
      if (!token) return null;

      const response = await fetch("/api/auth/user", {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          return null;
        }
        throw new Error(`Failed to fetch user: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!supabaseSession && !isSessionLoading,
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Auth functions
  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      }
    });
    if (error) throw error;
  };

  const loginWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      }
    });
    if (error) throw error;
  };

  const sendMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      }
    });
    if (error) throw error;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Also call backend logout for any cleanup
    await fetch('/api/auth/logout', { method: 'POST' });

    // Redirect to auth page
    window.location.href = '/auth';
  };

  const isLoading = isSessionLoading || isUserLoading;
  const isAuthenticated = !!user && !!supabaseSession;

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        isAuthenticated,
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