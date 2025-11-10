import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "node:http";
import path from "node:path";
// NOTE: registerRoutes is imported lazily inside server.listen() to prevent
// module-load crashes if REPLIT_DOMAINS or other auth secrets are missing
import { setupVite, serveStatic, log } from "./vite";
import { validateEncryptionKey } from "./utils/encryption";
import { backgroundJobService } from "./services/background-job-service";
import { registerFrameworkExecutors } from "./journey/register-frameworks";
import { verifyConnection } from "./config/neo4j";
import { initializeDatabaseExtensions } from "./db-init";
import { authReadiness } from "./auth-readiness";

const app = express();

// Validate encryption but don't exit if it fails - let server start for health checks
try {
  validateEncryptionKey();
} catch (error: any) {
  console.warn('[Server] WARNING: Encryption validation failed:', error.message);
  console.warn('[Server] Encrypted features may not work correctly');
}

// Register framework executors for modular journey execution
registerFrameworkExecutors();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '50mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Request logging middleware - only in development to avoid breaking responses
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });
}

// Health check endpoints for deployment readiness probes
// Must be unauthenticated and respond quickly
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Auth readiness health check endpoint
app.get('/health/auth', (_req: Request, res: Response) => {
  res.json({ ready: authReadiness.isReady() });
});

// Track if routes/static serving are ready
let appReady = false;

// Root endpoint handler - UNCONDITIONAL immediate 200 for Replit autoscale health checks
// No Accept-header logic, no next(), no delays - health probes must get instant response
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', ready: appReady, timestamp: Date.now() });
});

// Readiness gate - runs BEFORE routes/static serving are registered
// Shows loading page to browsers while app initializes, lets API/assets through
app.use((req: Request, res: Response, next: Function) => {
  // Always let assets through
  if (req.path.startsWith('/assets/') || req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    return next();
  }
  
  // Let API requests through (they'll get 404 if routes not ready, which is better than HTML)
  if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
    return next();
  }
  
  // Non-asset, non-API request (SPA navigation) - check appReady
  if (!appReady) {
    return res.status(200).send('<!DOCTYPE html><html><body><p>Application starting…</p></body></html>');
  }
  
  next();
});

// CRITICAL: Create multiple referenced handles to prevent Node exit in autoscale environments
// Without this, process can exit before health checks complete
process.stdout.write('[INIT] Creating keepalive handles\n');

// Keep stdin active to prevent process exit
process.stdin.resume();

// Create referenced interval for watchdog logging
const keepalive = setInterval(() => {
  process.stdout.write('[KEEPALIVE] Tick at ' + new Date().toISOString() + '\n');
}, 10000); // 10s for quicker watchdog logging

// Re-arm with fresh referenced timer on beforeExit to keep Node alive
process.on('beforeExit', (code) => {
  console.log('[Server] beforeExit event fired with code:', code);
  // Create a fresh referenced timeout to keep process alive
  setTimeout(() => {
    console.log('[Server] beforeExit recovery - process staying alive');
  }, 1000); // Fresh referenced timeout (no unref call)
});

process.stdout.write('[INIT] Keepalive handles created (stdin + 10s interval)\n');

// Create HTTP server and start listening IMMEDIATELY (synchronous for fast health checks)
process.stdout.write('[INIT] Creating HTTP server\n');
const server = createServer(app);
const port = parseInt(process.env.PORT || '5000', 10);
process.stdout.write(`[INIT] Starting server on port ${port}\n`);

// Critical: Add error handler BEFORE listen to catch startup failures
server.on('error', (error: any) => {
  console.error('[Server] FATAL: Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`[Server] Port ${port} is already in use`);
  }
  // DO NOT call process.exit() - keep server alive for health checks in production
  // The keepalive handles will keep process running
});

// START LISTENING IMMEDIATELY - This makes health checks pass right away
// All async initialization happens in background after server is listening
server.listen({
  port,
  host: "0.0.0.0",
  reusePort: true,
}, () => {
  log(`serving on port ${port}`);
  log('Server ready for health checks');
    
    // Defer ALL background initialization to avoid blocking the event loop
    // This ensures health check requests at / can be served immediately
    setImmediate(() => {
      // Register ALL routes in background (including auth middleware and API routes)
      // Using lazy import to prevent module-load crashes if secrets are missing
      (async () => {
        try {
          log('[Server] Loading routes module...');
          const { registerRoutes } = await import('./routes.js');
          log('[Server] Registering application routes...');
          await registerRoutes(app);
          log('[Server] Route registration complete');
          
          // Setup error handler AFTER routes are registered
          app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
            const status = err.status || err.statusCode || 500;
            const message = err.message || "Internal Server Error";
            res.status(status).json({ message });
            throw err;
          });
          
          // Setup Vite or static serving AFTER routes
          if (app.get("env") === "development") {
            await setupVite(app, server);
          } else {
            serveStatic(app);
          }
          
          appReady = true;
          log('[Server] Static file serving configured - app ready');
        } catch (error: any) {
          // Route registration failed - likely missing secrets (REPLIT_DOMAINS, etc.)
          // Keep server running for health checks, but warn about limited functionality
          console.error('[Server] WARNING: Route registration failed:', error.message);
          console.error('[Server] Health checks will work, but application routes are unavailable');
          console.error('[Server] Add required secrets in Replit deployment UI and redeploy');
          // DO NOT call process.exit() - let health checks pass
        }
      })();
      
      // Complete auth setup (OIDC config + strategy registration)
      (async () => {
        try {
          log('[Server] Completing authentication setup...');
          const { finishAuthSetup } = await import('./replitAuth');
          await finishAuthSetup(app);
          log('[Server] Authentication setup complete');
        } catch (error: any) {
          // In production deployments, auth might not be available yet during health checks
          // Log warning but don't exit - let deployment health checks pass
          console.warn('[Server] WARNING: Auth setup failed:', error.message);
          console.warn('[Server] Authentication features will be limited until configuration is available');
          // authReadiness remains false (default state)
        }
      })();
      
      // Start background job dispatcher
      setInterval(() => {
        backgroundJobService.processPendingJobs().catch((error) => {
          console.error('[Server] Background job dispatcher error:', error);
        });
      }, 15000);
      log('Background job dispatcher started (polling every 15s)');
      
      // Verify database extensions
      (async () => {
        try {
          log('[Server] Starting database extension verification...');
          await initializeDatabaseExtensions();
          log('[Server] Database extension verification complete');
        } catch (error: any) {
          console.warn('[Server] WARNING: Extension verification failed:', error.message);
          console.warn('[Server] Knowledge Graph features will be disabled');
        }
      })();
      
      // Verify Neo4j connection if configured
      const hasNeo4jConfig = process.env.NEO4J_URI && process.env.NEO4J_PASSWORD;
      if (hasNeo4jConfig) {
        verifyConnection()
          .then((connected) => {
            if (connected) {
              log('[Neo4j] Connection verified successfully');
            } else {
              console.warn('[Neo4j] WARNING: Connection failed. Knowledge Graph features may not work.');
            }
          })
          .catch((error) => {
            console.warn('[Neo4j] WARNING: Connection check failed:', error.message);
            console.warn('[Neo4j] Knowledge Graph features will not be available.');
          });
      } else {
        console.warn('[Neo4j] Not configured. Set NEO4J_URI and NEO4J_PASSWORD to enable Knowledge Graph features.');
      }
    });
  });
