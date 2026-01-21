/**
 * CrewAI Service Manager
 * 
 * Automatically spawns and manages the CrewAI Python service
 * ensuring it's always available for multi-agent EPM generation.
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const CREWAI_PORT = 8001;
const CREWAI_URL = `http://localhost:${CREWAI_PORT}`;
const HEALTH_CHECK_INTERVAL = 10000; // 10 seconds
const MAX_STARTUP_RETRIES = 30;
const STARTUP_RETRY_INTERVAL = 2000; // 2 seconds
const RESTART_DELAY = 5000; // 5 seconds

let crewaiProcess: ChildProcess | null = null;
let healthCheckTimer: NodeJS.Timeout | null = null;
let isShuttingDown = false;
let isStarting = false; // Lock to prevent concurrent starts
let consecutiveHealthFailures = 0;
const MAX_HEALTH_FAILURES = 3;

/**
 * Check if CrewAI service is healthy
 */
export async function isCrewAIHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${CREWAI_URL}/health`, {
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.status === 'healthy' && data.agents === 7;
  } catch {
    return false;
  }
}

/**
 * Wait for CrewAI service to become healthy
 */
async function waitForHealthy(): Promise<boolean> {
  console.log('[CrewAI Manager] Waiting for service to be healthy...');
  
  for (let i = 0; i < MAX_STARTUP_RETRIES; i++) {
    if (await isCrewAIHealthy()) {
      console.log('[CrewAI Manager] ✅ Service is healthy with 7 agents!');
      return true;
    }
    
    console.log(`[CrewAI Manager] Attempt ${i + 1}/${MAX_STARTUP_RETRIES}: Not ready yet...`);
    await new Promise(resolve => setTimeout(resolve, STARTUP_RETRY_INTERVAL));
  }
  
  console.log('[CrewAI Manager] ⚠️ Service failed to become healthy');
  return false;
}

/**
 * Spawn the CrewAI Python service
 */
function spawnCrewAI(): ChildProcess {
  const servicePath = path.join(process.cwd(), 'services', 'agent-planner');
  
  console.log('[CrewAI Manager] Starting Python service...');
  console.log(`[CrewAI Manager] Working directory: ${servicePath}`);
  
  const proc = spawn('python3', [
    '-m', 'uvicorn',
    'main:app',
    '--host', '0.0.0.0',
    '--port', String(CREWAI_PORT)
  ], {
    cwd: servicePath,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
  });
  
  proc.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n').filter((l: string) => l.trim());
    lines.forEach((line: string) => {
      console.log(`[CrewAI] ${line}`);
    });
  });
  
  proc.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n').filter((l: string) => l.trim());
    lines.forEach((line: string) => {
      // Uvicorn logs to stderr by default
      if (line.includes('ERROR') || line.includes('Traceback')) {
        console.error(`[CrewAI ERROR] ${line}`);
      } else {
        console.log(`[CrewAI] ${line}`);
      }
    });
  });
  
  proc.on('exit', (code, signal) => {
    console.log(`[CrewAI Manager] Process exited with code ${code}, signal ${signal}`);
    crewaiProcess = null;
    
    // Auto-restart on ANY unexpected exit (not just non-zero) when not shutting down
    if (!isShuttingDown) {
      console.log(`[CrewAI Manager] Unexpected exit, auto-restarting in ${RESTART_DELAY / 1000} seconds...`);
      setTimeout(() => {
        if (!isShuttingDown && !isStarting) {
          startCrewAIService().catch(console.error);
        }
      }, RESTART_DELAY);
    }
  });
  
  proc.on('error', (err) => {
    console.error('[CrewAI Manager] Failed to start process:', err.message);
    crewaiProcess = null;
  });
  
  return proc;
}

/**
 * Start periodic health checks with auto-restart
 */
function startHealthChecks() {
  if (healthCheckTimer) return;
  
  consecutiveHealthFailures = 0;
  
  healthCheckTimer = setInterval(async () => {
    if (isShuttingDown || isStarting) return;
    
    const healthy = await isCrewAIHealthy();
    
    if (!healthy) {
      consecutiveHealthFailures++;
      console.log(`[CrewAI Manager] Health check failed (${consecutiveHealthFailures}/${MAX_HEALTH_FAILURES})`);
      
      // Auto-restart after consecutive failures
      if (consecutiveHealthFailures >= MAX_HEALTH_FAILURES) {
        console.log('[CrewAI Manager] Service appears down, attempting restart...');
        consecutiveHealthFailures = 0;
        
        // Kill process if it exists but isn't responding
        if (crewaiProcess) {
          crewaiProcess.kill('SIGTERM');
          crewaiProcess = null;
        }
        
        // Restart
        startCrewAIService().catch(console.error);
      }
    } else {
      consecutiveHealthFailures = 0;
    }
  }, HEALTH_CHECK_INTERVAL);
}

/**
 * Start the CrewAI service (with lock to prevent concurrent starts)
 */
export async function startCrewAIService(): Promise<boolean> {
  // Prevent concurrent starts
  if (isStarting) {
    console.log('[CrewAI Manager] Start already in progress, waiting...');
    // Wait for the current start to complete
    while (isStarting) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return isCrewAIHealthy();
  }
  
  isStarting = true;
  
  try {
    // Check if already running and healthy
    if (await isCrewAIHealthy()) {
      console.log('[CrewAI Manager] Service already running and healthy');
      startHealthChecks();
      return true;
    }
    
    // Kill any existing process
    if (crewaiProcess) {
      console.log('[CrewAI Manager] Killing existing process...');
      crewaiProcess.kill('SIGTERM');
      crewaiProcess = null;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Spawn new process
    crewaiProcess = spawnCrewAI();
    
    // Wait for it to be healthy
    const healthy = await waitForHealthy();
    
    if (healthy) {
      startHealthChecks();
    }
    
    return healthy;
  } finally {
    isStarting = false;
  }
}

/**
 * Stop the CrewAI service (synchronous cleanup for exit handlers)
 */
function stopCrewAIServiceSync(): void {
  isShuttingDown = true;
  
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  
  if (crewaiProcess) {
    console.log('[CrewAI Manager] Stopping service...');
    crewaiProcess.kill('SIGTERM');
    crewaiProcess = null;
  }
}

/**
 * Stop the CrewAI service
 */
export async function stopCrewAIService(): Promise<void> {
  isShuttingDown = true;
  
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  
  if (crewaiProcess) {
    console.log('[CrewAI Manager] Stopping service...');
    const proc = crewaiProcess;
    crewaiProcess = null;
    
    proc.kill('SIGTERM');
    
    // Wait for graceful shutdown
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
        resolve();
      }, 2000);
      
      proc.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    
    console.log('[CrewAI Manager] Service stopped');
  }
}

/**
 * Get service status
 */
export async function getCrewAIStatus(): Promise<{
  running: boolean;
  healthy: boolean;
  pid: number | null;
  url: string;
}> {
  const healthy = await isCrewAIHealthy();
  
  return {
    running: crewaiProcess !== null || healthy,
    healthy,
    pid: crewaiProcess?.pid || null,
    url: CREWAI_URL
  };
}

// Graceful shutdown handlers - use sync version for immediate handlers
process.on('SIGTERM', () => {
  stopCrewAIServiceSync();
});

process.on('SIGINT', () => {
  stopCrewAIServiceSync();
});

// Handle process exit - ensure cleanup
process.on('exit', () => {
  stopCrewAIServiceSync();
});

// Handle uncaught exceptions - cleanup before crash
process.on('uncaughtException', (err) => {
  console.error('[CrewAI Manager] Uncaught exception, cleaning up:', err.message);
  stopCrewAIServiceSync();
});

process.on('unhandledRejection', (reason) => {
  console.error('[CrewAI Manager] Unhandled rejection:', reason);
  // Don't stop service for unhandled rejections, just log
});
