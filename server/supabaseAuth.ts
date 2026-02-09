// Supabase Auth integration
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { RequestHandler } from "express";
import { storage } from "./storage";
import { authReadiness } from "./auth-readiness";

// Supabase service role client (for backend verification)
let supabaseAdmin: SupabaseClient | null = null;

/**
 * Initialize Supabase Admin client with service role key
 * This client is used for backend JWT verification and user management
 */
export function initializeSupabaseAuth(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[Supabase Auth] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.warn('[Supabase Auth] Authentication will not work without these environment variables');

    // Create a dummy client that will fail gracefully
    supabaseAdmin = null as any;
    return supabaseAdmin;
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

/**
 * Get the current Supabase admin client
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  return supabaseAdmin;
}

/**
 * Upsert user in our database based on Supabase user data
 */
async function upsertUser(supabaseUser: any) {
  // Check if user exists by supabaseUid first
  let existingUser = await storage.getUserBySupabaseUid(supabaseUser.id);

  // If not found by supabaseUid, try to find by email (for migration)
  if (!existingUser && supabaseUser.email) {
    existingUser = await storage.getUserByEmail(supabaseUser.email);

    // If found by email, update with supabaseUid (migration path)
    if (existingUser) {
      await storage.updateUserSupabaseUid(existingUser.id, supabaseUser.id);
      console.log(`[Supabase Auth] Migrated existing user ${existingUser.email} to Supabase`);
      return existingUser;
    }
  }

  // If user exists, return it
  if (existingUser) {
    return existingUser;
  }

  // Create new user
  const newUser = await storage.upsertUser({
    id: undefined, // Let DB generate the ID
    supabaseUid: supabaseUser.id,
    email: supabaseUser.email,
    firstName: supabaseUser.user_metadata?.first_name || supabaseUser.user_metadata?.full_name?.split(' ')[0],
    lastName: supabaseUser.user_metadata?.last_name || supabaseUser.user_metadata?.full_name?.split(' ').slice(1).join(' '),
    profileImageUrl: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture,
  });

  console.log(`[Supabase Auth] Created new user ${newUser.email}`);
  return newUser;
}

/**
 * Express middleware to verify Supabase JWT and attach user to request
 */
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Development mode bypass (same as Replit auth)
  if (process.env.DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV === 'development') {
    const remoteAddress = req.socket.remoteAddress || '';
    const isLoopback = remoteAddress === '127.0.0.1' ||
                       remoteAddress === '::1' ||
                       remoteAddress === '::ffff:127.0.0.1' ||
                       remoteAddress.startsWith('172.') ||      // Docker bridge
                       remoteAddress.startsWith('192.168.65.'); // Docker Desktop for Mac

    if (isLoopback) {
      console.warn('⚠️  [Supabase Auth] DEV AUTH BYPASS ACTIVE - Synthetic user injected');

      // Create synthetic user for development
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

      // Attach to request in format compatible with existing code
      (req as any).user = {
        ...syntheticUser,
        claims: {
          sub: syntheticUser.id,
          email: syntheticUser.email,
          first_name: syntheticUser.firstName,
          last_name: syntheticUser.lastName,
        }
      };

      // Ensure dev user exists in DB
      try {
        await storage.upsertUser(syntheticUser);
      } catch (error) {
        console.error('[Supabase Auth] Failed to upsert dev user:', error);
      }

      return next();
    }
  }

  // Extract JWT from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "Unauthorized - No token provided" });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  // Verify token with Supabase
  if (!supabaseAdmin) {
    console.error('[Supabase Auth] Admin client not initialized');
    return res.status(503).json({ message: "Authentication service unavailable" });
  }

  try {
    // Get user from Supabase using the JWT
    const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !supabaseUser) {
      console.error('[Supabase Auth] Token verification failed:', error);
      return res.status(401).json({ message: "Unauthorized - Invalid token" });
    }

    // Upsert user in our database and get our internal user record
    const internalUser = await upsertUser(supabaseUser);

    // Attach user to request in format compatible with existing code
    // This maintains backward compatibility with code expecting req.user.claims.sub
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
  } catch (error) {
    console.error('[Supabase Auth] Authentication error:', error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

/**
 * Helper to get current user from request
 */
export function getCurrentUser(req: any) {
  return req.user;
}

// Role-based middleware (same as before)
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