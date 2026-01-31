// Replit Auth integration using OpenID Connect
import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { authReadiness } from "./auth-readiness";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  // Only replace refresh_token if a new one was provided (refresh grants may not include new refresh token)
  if (tokens.refresh_token) {
    user.refresh_token = tokens.refresh_token;
  }
  user.expires_at = user.claims?.exp;
}

/**
 * Proactively refresh the user's OIDC token if it will expire soon.
 * Call this at the start of long-running operations to prevent auth failures mid-operation.
 * 
 * @param req - Express request with authenticated user
 * @param thresholdSeconds - Refresh if token expires within this many seconds (default: 5 minutes)
 * @returns true if token is valid or was refreshed, false if refresh failed
 */
export async function refreshTokenProactively(
  req: any,
  thresholdSeconds: number = 300
): Promise<boolean> {
  const user = req.user as any;
  
  if (!req.isAuthenticated() || !user?.expires_at) {
    console.log('[ProactiveRefresh] User not authenticated or no expiry info');
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = user.expires_at - now;
  
  // Token still has plenty of time
  if (expiresIn > thresholdSeconds) {
    console.log(`[ProactiveRefresh] Token valid for ${expiresIn}s, no refresh needed`);
    return true;
  }

  // Token will expire soon or already expired - try to refresh
  console.log(`[ProactiveRefresh] Token expires in ${expiresIn}s, refreshing proactively...`);
  
  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    console.error('[ProactiveRefresh] No refresh token available');
    return false;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    
    // Persist the updated session to the store
    await new Promise<void>((resolve, reject) => {
      req.session.save((err: any) => {
        if (err) {
          console.error('[ProactiveRefresh] Failed to save session:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
    const newExpiresIn = user.expires_at - Math.floor(Date.now() / 1000);
    console.log(`[ProactiveRefresh] ✓ Token refreshed and session saved, valid for ${newExpiresIn}s`);
    return true;
  } catch (error) {
    console.error('[ProactiveRefresh] ✗ Token refresh failed:', error);
    return false;
  }
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

// Setup session and passport middleware synchronously (MUST happen before routes)
export function setupAuthMiddleware(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  
  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));
}

// Complete auth setup with OIDC config fetch and strategy registration
// Can be deferred to after server.listen() to avoid blocking startup
export async function finishAuthSetup(app: Express) {
  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user: any = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  const getStrategyName = (hostname: string) => {
    const domains = process.env.REPLIT_DOMAINS!.split(",");
    // Check if hostname matches any registered domain
    const matchedDomain = domains.find(d => d === hostname);
    // Use matched domain or fallback to first domain
    return `replitauth:${matchedDomain || domains[0]}`;
  };

  app.get("/api/login", (req, res, next) => {
    if (!authReadiness.isReady()) {
      return res.status(503).header('Retry-After', '2').json({
        message: 'Authentication system initializing, please retry in 2 seconds'
      });
    }
    passport.authenticate(getStrategyName(req.hostname), {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    if (!authReadiness.isReady()) {
      return res.status(503).header('Retry-After', '2').json({
        message: 'Authentication system initializing, please retry in 2 seconds'
      });
    }
    passport.authenticate(getStrategyName(req.hostname), {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });

  // Mark auth system as ready
  authReadiness.setReady();
}

// Legacy setupAuth function for backwards compatibility
export async function setupAuth(app: Express) {
  setupAuthMiddleware(app);
  await finishAuthSetup(app);
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  // Development mode bypass: inject synthetic user when Replit Auth is unavailable
  if (!req.isAuthenticated() || !user?.expires_at) {
    // SECURITY: Development bypass requires EXPLICIT opt-in via DEV_AUTH_BYPASS=true
    // This prevents accidental auth bypass in production environments
    const isExplicitDevMode = process.env.DEV_AUTH_BYPASS === 'true' && 
                              process.env.NODE_ENV === 'development';
    
    // SECURITY: Use actual socket address, NOT hostname headers (which can be spoofed)
    // Only allow bypass from true loopback connections (or Docker bridge in dev)
    const remoteAddress = req.socket.remoteAddress || '';
    const isLoopback = remoteAddress === '127.0.0.1' || 
                       remoteAddress === '::1' ||
                       remoteAddress === '::ffff:127.0.0.1' ||
                       remoteAddress.startsWith('172.') ||      // Docker bridge
                       remoteAddress.startsWith('192.168.65.'); // Docker Desktop for Mac
    
    // Only bypass if BOTH conditions are met: explicit flag AND loopback connection
    const shouldBypass = isExplicitDevMode && isLoopback;
    
    if (shouldBypass) {
      console.warn('⚠️  [Auth] DEV AUTH BYPASS ACTIVE - Synthetic user injected');
      console.warn('⚠️  [Auth] Remote address:', remoteAddress, '| DEV_AUTH_BYPASS:', process.env.DEV_AUTH_BYPASS);
      
      // Create a synthetic user for development
      const syntheticUser = {
        claims: {
          sub: 'dev-user-123',
          email: 'dev@example.com',
          first_name: 'Dev',
          last_name: 'User',
          exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
        },
        access_token: 'dev-token',
        refresh_token: 'dev-refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 86400,
      };
      
      // Attach synthetic user to request
      (req as any).user = syntheticUser;
      
      // Upsert dev user to database
      try {
        await upsertUser(syntheticUser.claims);
      } catch (error) {
        console.error('[Auth] Failed to upsert dev user:', error);
      }
      
      return next();
    }
    
    // Security alert: if DEV_AUTH_BYPASS is set but connection is NOT from loopback
    if (isExplicitDevMode && !isLoopback) {
      console.error('🚨 [Auth] SECURITY ALERT: DEV_AUTH_BYPASS=true but request from:', remoteAddress);
      console.error('🚨 [Auth] Auth bypass BLOCKED - Only loopback connections allowed!');
      console.error('🚨 [Auth] Set DEV_AUTH_BYPASS=false in production deployments!');
    }
    
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    
    // Persist the updated session to the store
    req.session.save((err: any) => {
      if (err) {
        console.error('[Auth] Failed to save refreshed session:', err);
      }
    });
    
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

export const isAdmin: RequestHandler = (req, res, next) => {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export const isEditor: RequestHandler = (req, res, next) => {
  if (!req.user || !['Admin', 'Editor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Editor access required' });
  }
  next();
};
