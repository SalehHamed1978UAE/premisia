import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "./use-auth";

/**
 * Client-side guard hook for admin-only pages.
 * Redirects non-admin users to home page with unauthorized message.
 */
export function useRequireAdmin() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'Admin')) {
      // Non-admin user trying to access admin page - redirect
      setLocation('/');
    }
  }, [user, isLoading, setLocation]);

  return {
    isAdmin: user?.role === 'Admin',
    isLoading,
  };
}
