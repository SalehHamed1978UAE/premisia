import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { validateEncryptionKey } from "./utils/encryption";
import { backgroundJobService } from "./services/background-job-service";
import { registerFrameworkExecutors } from "./journey/register-frameworks";
import { verifyConnection } from "./config/neo4j";
import { initializeDatabaseExtensions } from "./db-init";

const app = express();

validateEncryptionKey();

// Verify database extensions (required for knowledge graph features)
// This must complete before accepting requests to ensure isKnowledgeGraphEnabled() works correctly
try {
  await initializeDatabaseExtensions();
} catch (error: any) {
  console.error('[Server] Extension verification failed:', error.message);
  console.error('[Server] Knowledge Graph features will be disabled');
}

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

(async () => {
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
    
    // Start background job dispatcher (polls every 15 seconds)
    setInterval(() => {
      backgroundJobService.processPendingJobs().catch((error) => {
        console.error('[Server] Background job dispatcher error:', error);
      });
    }, 15000);
    
    log('Background job dispatcher started (polling every 15s)');
  });
})();
