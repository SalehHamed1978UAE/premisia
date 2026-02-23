import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { RequestHandler } from "express";
import { storage } from "./storage";
import { authReadiness } from "./auth-readiness";

let supabaseAdmin: SupabaseClient | null = null;

export function initializeSupabaseAuth(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[Supabase Auth] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.warn('[Supabase Auth] Authentication will not work without these environment variables');
    supabaseAdmin = null;
    return null;
  }

  supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  console.log('[Supabase Auth] Initialized admin client');
  authReadiness.setReady();
  return supabaseAdmin;
}

export function getSupabaseAdmin(): SupabaseClient | null {
  return supabaseAdmin;
}

async function upsertUser(supabaseUser: any) {
  let existingUser = await storage.getUserBySupabaseUid(supabaseUser.id);

  if (!existingUser && supabaseUser.email) {
    existingUser = await storage.getUserByEmail(supabaseUser.email);
    if (existingUser) {
      await storage.updateUserSupabaseUid(existingUser.id, supabaseUser.id);
      console.log(`[Supabase Auth] Migrated existing user ${existingUser.email} to Supabase`);
      return existingUser;
    }
  }

  if (existingUser) {
    return existingUser;
  }

  const newUser = await storage.upsertUser({
    supabaseUid: supabaseUser.id,
    email: supabaseUser.email,
    firstName: supabaseUser.user_metadata?.first_name || supabaseUser.user_metadata?.full_name?.split(' ')[0],
    lastName: supabaseUser.user_metadata?.last_name || supabaseUser.user_metadata?.full_name?.split(' ').slice(1).join(' '),
    profileImageUrl: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture,
  });

  console.log(`[Supabase Auth] Created new user ${newUser.email}`);
  return newUser;
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (process.env.DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV === 'development') {
    const remoteAddress = req.socket.remoteAddress || '';
    const isLoopback = remoteAddress === '127.0.0.1' ||
                       remoteAddress === '::1' ||
                       remoteAddress === '::ffff:127.0.0.1' ||
                       remoteAddress.startsWith('172.') ||
                       remoteAddress.startsWith('192.168.65.');

    if (isLoopback) {
      console.warn('⚠️  [Supabase Auth] DEV AUTH BYPASS ACTIVE - Synthetic user injected');

      const syntheticUser = {
        id: 'dev-user-123',
        email: 'dev@example.com',
        firstName: 'Dev',
        lastName: 'User',
        role: 'Admin' as const,
        profileImageUrl: null,
        supabaseUid: 'dev-supabase-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (req as any).user = {
        ...syntheticUser,
        claims: {
          sub: syntheticUser.id,
          email: syntheticUser.email,
          first_name: syntheticUser.firstName,
          last_name: syntheticUser.lastName,
        }
      };

      try {
        await storage.upsertUser(syntheticUser);
      } catch (error) {
        console.error('[Supabase Auth] Failed to upsert dev user:', error);
      }

      return next();
    }
  }

  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;
  if (!authHeader?.startsWith('Bearer ') && !queryToken) {
    console.log(`[Supabase Auth] No token for ${req.method} ${req.path}`);
    return res.status(401).json({ message: "Unauthorized - No token provided" });
  }

  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : queryToken!;

  if (!supabaseAdmin) {
    console.error('[Supabase Auth] Admin client not initialized');
    return res.status(503).json({ message: "Authentication service unavailable" });
  }

  try {
    const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !supabaseUser) {
      console.error('[Supabase Auth] Token verification failed:', error?.message || 'No user returned');
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }

    const internalUser = await upsertUser(supabaseUser);
    console.log(`[Supabase Auth] ✓ ${supabaseUser.email} → ${req.method} ${req.path}`);

    (req as any).user = {
      ...internalUser,
      claims: {
        sub: internalUser.id,
        email: internalUser.email,
        first_name: internalUser.firstName,
        last_name: internalUser.lastName,
      }
    };

    return next();
  } catch (error: any) {
    console.error('[Supabase Auth] Authentication error:', error?.message || error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export function getCurrentUser(req: any) {
  return req.user;
}

/**
 * No-op for Supabase auth — client handles token refresh automatically.
 * Kept for backward compatibility with routes that call it before long-running ops.
 */
export async function refreshTokenProactively(_req: any, _thresholdSeconds: number = 300): Promise<boolean> {
  return true;
}

export const isAdmin: RequestHandler = (req, res, next) => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'Admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export const isEditor: RequestHandler = (req, res, next) => {
  const user = getCurrentUser(req);
  if (!user || !['Admin', 'Editor'].includes(user.role)) {
    return res.status(403).json({ error: 'Editor access required' });
  }
  next();
};
