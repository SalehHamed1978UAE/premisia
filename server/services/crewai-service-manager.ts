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

let crewaiProcess: ChildProcess | null = null;
let healthCheckTimer: NodeJS.Timeout | null = null;
let isShuttingDown = false;

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
    
    // Auto-restart if not shutting down
    if (!isShuttingDown && code !== 0) {
      console.log('[CrewAI Manager] Auto-restarting in 5 seconds...');
      setTimeout(() => {
        if (!isShuttingDown) {
          startCrewAIService().catch(console.error);
        }
      }, 5000);
    }
  });
  
  proc.on('error', (err) => {
    console.error('[CrewAI Manager] Failed to start process:', err.message);
  });
  
  return proc;
}

/**
 * Start periodic health checks
 */
function startHealthChecks() {
  if (healthCheckTimer) return;
  
  healthCheckTimer = setInterval(async () => {
    if (isShuttingDown) return;
    
    const healthy = await isCrewAIHealthy();
    
    if (!healthy && crewaiProcess) {
      console.log('[CrewAI Manager] Health check failed, service may be down');
    }
  }, HEALTH_CHECK_INTERVAL);
}

/**
 * Start the CrewAI service
 */
export async function startCrewAIService(): Promise<boolean> {
  // Check if already running
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
    crewaiProcess.kill('SIGTERM');
    
    // Wait for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (crewaiProcess) {
      crewaiProcess.kill('SIGKILL');
    }
    
    crewaiProcess = null;
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

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  stopCrewAIService().catch(console.error);
});

process.on('SIGINT', () => {
  stopCrewAIService().catch(console.error);
});
