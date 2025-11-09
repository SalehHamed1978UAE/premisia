import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { validateEncryptionKey } from "./utils/encryption";
import { backgroundJobService } from "./services/background-job-service";
import { registerFrameworkExecutors } from "./journey/register-frameworks";
import { verifyConnection } from "./config/neo4j";
import { initializeDatabaseExtensions } from "./db-init";
import { authReadiness } from "./auth-readiness";

const app = express();

validateEncryptionKey();

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

// Health check endpoints for deployment readiness probes
// Must be unauthenticated and respond quickly
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Auth readiness health check endpoint
app.get('/health/auth', (_req: Request, res: Response) => {
  res.json({ ready: authReadiness.isReady() });
});

// Root endpoint handler for deployment health checks
// Health checks hit / by default and can't be configured in autoscale deployments  
// This responds to health probes but allows SPA to load for browsers
app.get('/', (req: Request, res: Response, next: Function) => {
  // If request accepts HTML (browser), let it through to serve the SPA
  const acceptHeader = req.headers.accept || '';
  const acceptsHtml = acceptHeader.includes('text/html');
  
  if (acceptsHtml) {
    // Browser request - continue to static file serving
    next();
  } else {
    // Health check probe - respond immediately
    res.status(200).json({ status: 'ok' });
  }
});

(async () => {
  // Register routes (includes synchronous auth middleware setup)
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Complete auth setup (OIDC config + strategy registration) in background
    // This happens AFTER server is listening to avoid delaying health check readiness
    // There is a ~1s window where /api/login returns 500 if accessed before this completes
    (async () => {
      try {
        log('[Server] Completing authentication setup...');
        const { finishAuthSetup } = await import('./replitAuth');
        await finishAuthSetup(app);
        log('[Server] Authentication setup complete');
      } catch (error: any) {
        console.error('[Server] FATAL: Auth setup failed:', error.message);
        console.error('[Server] Application will not be functional. Exiting...');
        process.exit(1);
      }
    })();
    
    // Start background job dispatcher (polls every 15 seconds)
    setInterval(() => {
      backgroundJobService.processPendingJobs().catch((error) => {
        console.error('[Server] Background job dispatcher error:', error);
      });
    }, 15000);
    
    log('Background job dispatcher started (polling every 15s)');
    
    // Verify database extensions in background (non-blocking)
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
    
    // Verify Neo4j connection if configured (non-blocking)
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
})().catch((error) => {
  console.error('[Server] Fatal error during startup:', error);
  process.exit(1);
});
