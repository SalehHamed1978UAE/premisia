import express from "express";
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
    let capturedJsonResponse = undefined;
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
app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});
// Auth readiness health check endpoint
app.get('/health/auth', (_req, res) => {
    res.json({ ready: authReadiness.isReady() });
});
// Track if routes/static serving are ready
let appReady = false;
// Root endpoint handler for BOTH health checks AND SPA serving
app.get('/', (req, res, next) => {
    // Health check probes don't send Accept: text/html
    // Browsers always send Accept: text/html
    const acceptHeader = req.headers.accept || '';
    const isHealthCheck = !acceptHeader.includes('text/html');
    if (isHealthCheck) {
        // Health check probe - respond immediately
        return res.status(200).json({ status: 'ok' });
    }
    // Browser request - serve SPA
    if (appReady) {
        // Routes registered, pass to Vite/static serving
        next();
    }
    else {
        // Routes not ready yet, return minimal loading page
        res.status(200).send('<!DOCTYPE html><html><head><title>Loading...</title></head><body><p>Application starting, please refresh in a moment...</p></body></html>');
    }
});
(async () => {
    // Create HTTP server immediately WITHOUT registering routes
    // This allows us to start listening before expensive route registration
    const { createServer } = await import("http");
    const server = createServer(app);
    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    // START LISTENING IMMEDIATELY - This makes health checks pass right away
    // Routes will be registered in the background after server is listening
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
            (async () => {
                try {
                    log('[Server] Registering application routes...');
                    await registerRoutes(app);
                    log('[Server] Route registration complete');
                    // Setup error handler AFTER routes are registered
                    app.use((err, _req, res, _next) => {
                        const status = err.status || err.statusCode || 500;
                        const message = err.message || "Internal Server Error";
                        res.status(status).json({ message });
                        throw err;
                    });
                    // Setup Vite or static serving AFTER routes
                    if (app.get("env") === "development") {
                        await setupVite(app, server);
                    }
                    else {
                        serveStatic(app);
                    }
                    appReady = true;
                    log('[Server] Static file serving configured - app ready');
                }
                catch (error) {
                    console.error('[Server] FATAL: Route registration failed:', error.message);
                    console.error('[Server] Application will not be functional. Exiting...');
                    process.exit(1);
                }
            })();
            // Complete auth setup (OIDC config + strategy registration)
            (async () => {
                try {
                    log('[Server] Completing authentication setup...');
                    const { finishAuthSetup } = await import('./replitAuth');
                    await finishAuthSetup(app);
                    log('[Server] Authentication setup complete');
                }
                catch (error) {
                    console.error('[Server] FATAL: Auth setup failed:', error.message);
                    console.error('[Server] Application will not be functional. Exiting...');
                    process.exit(1);
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
                }
                catch (error) {
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
                    }
                    else {
                        console.warn('[Neo4j] WARNING: Connection failed. Knowledge Graph features may not work.');
                    }
                })
                    .catch((error) => {
                    console.warn('[Neo4j] WARNING: Connection check failed:', error.message);
                    console.warn('[Neo4j] Knowledge Graph features will not be available.');
                });
            }
            else {
                console.warn('[Neo4j] Not configured. Set NEO4J_URI and NEO4J_PASSWORD to enable Knowledge Graph features.');
            }
        });
    });
})().catch((error) => {
    console.error('[Server] Fatal error during startup:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map