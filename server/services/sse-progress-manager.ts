import { Response } from 'express';

interface ProgressStream {
  res: Response;
  lastEventId: number;
  createdAt: Date;
}

interface SSEEvent {
  type: string;
  data: unknown;
  timestamp?: string;
}

class SSEProgressManager {
  private streams: Map<string, ProgressStream> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 30 * 60 * 1000;
      
      const entries = Array.from(this.streams.entries());
      for (let i = 0; i < entries.length; i++) {
        const [id, stream] = entries[i];
        if (now - stream.createdAt.getTime() > staleThreshold) {
          console.log(`[SSEProgressManager] Cleaning up stale stream: ${id}`);
          this.unregister(id);
        }
      }
    }, 5 * 60 * 1000);
  }

  register(progressId: string, res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    this.streams.set(progressId, {
      res,
      lastEventId: 0,
      createdAt: new Date(),
    });

    res.on('close', () => {
      this.streams.delete(progressId);
    });

    console.log(`[SSEProgressManager] Registered stream: ${progressId}`);
  }

  unregister(progressId: string): void {
    const stream = this.streams.get(progressId);
    if (stream) {
      try {
        stream.res.end();
      } catch {
      }
      this.streams.delete(progressId);
    }
  }

  send(progressId: string, event: SSEEvent): boolean {
    const stream = this.streams.get(progressId);
    if (!stream) {
      return false;
    }

    try {
      stream.lastEventId++;
      const eventData = JSON.stringify({
        ...event,
        timestamp: event.timestamp || new Date().toISOString(),
      });
      
      stream.res.write(`id: ${stream.lastEventId}\n`);
      stream.res.write(`event: ${event.type}\n`);
      stream.res.write(`data: ${eventData}\n\n`);
      
      return true;
    } catch (error) {
      console.error(`[SSEProgressManager] Error sending event to ${progressId}:`, error);
      this.unregister(progressId);
      return false;
    }
  }

  sendProgress(progressId: string, step: string, progress: number, message?: string): boolean {
    return this.send(progressId, {
      type: 'progress',
      data: { step, progress, message },
    });
  }

  sendStepStart(progressId: string, step: string, description?: string): boolean {
    return this.send(progressId, {
      type: 'step-start',
      data: { step, description },
    });
  }

  sendStepComplete(progressId: string, step: string, result?: unknown): boolean {
    return this.send(progressId, {
      type: 'step-complete',
      data: { step, result },
    });
  }

  sendError(progressId: string, error: string, details?: unknown): boolean {
    return this.send(progressId, {
      type: 'error',
      data: { error, details },
    });
  }

  sendComplete(progressId: string, result?: unknown): boolean {
    const sent = this.send(progressId, {
      type: 'complete',
      data: { result },
    });
    
    setTimeout(() => {
      this.unregister(progressId);
    }, 1000);
    
    return sent;
  }

  hasStream(progressId: string): boolean {
    return this.streams.has(progressId);
  }

  getActiveStreams(): string[] {
    return Array.from(this.streams.keys());
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    const keys = Array.from(this.streams.keys());
    for (let i = 0; i < keys.length; i++) {
      this.unregister(keys[i]);
    }
  }
}

export const sseProgressManager = new SSEProgressManager();
export type { SSEEvent, ProgressStream };
