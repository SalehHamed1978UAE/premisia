/**
 * SSE Progress Manager - Single source of truth for all progress events
 *
 * This manager holds active SSE connections and broadcasts progress to them.
 * All generators (multi-agent, legacy, etc.) use this to send progress.
 */

import { Response } from 'express';

interface ProgressEvent {
  type: 'progress' | 'step_start' | 'step_complete' | 'error' | 'complete';
  percent: number;
  step: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

interface SSEConnection {
  res: Response;
  sessionId: string;
  connectedAt: Date;
  keepAliveInterval?: NodeJS.Timeout;
}

class SSEProgressManager {
  private connections: Map<string, SSEConnection> = new Map();

  /**
   * Register a new SSE connection for a session
   */
  registerConnection(sessionId: string, res: Response): void {
    // Close existing connection for this session if any
    const existing = this.connections.get(sessionId);
    if (existing) {
      try {
        if (existing.keepAliveInterval) {
          clearInterval(existing.keepAliveInterval);
        }
        existing.res.end();
      } catch (e) {
        // Ignore - connection may already be closed
      }
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',  // Disable nginx buffering
    });

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ sessionId, timestamp: new Date().toISOString() })}\n\n`);

    // Keep-alive ping every 15 seconds
    const keepAliveInterval = setInterval(() => {
      if (this.connections.has(sessionId)) {
        try {
          res.write(`: keepalive\n\n`);
        } catch (e) {
          clearInterval(keepAliveInterval);
          this.connections.delete(sessionId);
        }
      } else {
        clearInterval(keepAliveInterval);
      }
    }, 15000);

    // Store connection
    this.connections.set(sessionId, {
      res,
      sessionId,
      connectedAt: new Date(),
      keepAliveInterval,
    });

    console.log(`[SSE] Connection registered for session ${sessionId}`);

    // Handle client disconnect
    res.on('close', () => {
      const conn = this.connections.get(sessionId);
      if (conn?.keepAliveInterval) {
        clearInterval(conn.keepAliveInterval);
      }
      this.connections.delete(sessionId);
      console.log(`[SSE] Connection closed for session ${sessionId}`);
    });
  }

  /**
   * Send progress event to a specific session
   */
  sendProgress(sessionId: string, event: Omit<ProgressEvent, 'timestamp'>): void {
    const connection = this.connections.get(sessionId);

    const fullEvent: ProgressEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    // Always log for debugging
    console.log(`[SSE] Progress for ${sessionId}: ${event.percent}% - ${event.step} - ${event.message}`);

    if (!connection) {
      console.warn(`[SSE] No connection found for session ${sessionId} - event dropped`);
      return;
    }

    try {
      const data = JSON.stringify(fullEvent);
      connection.res.write(`event: progress\ndata: ${data}\n\n`);
    } catch (error) {
      console.error(`[SSE] Failed to send event to ${sessionId}:`, error);
      if (connection.keepAliveInterval) {
        clearInterval(connection.keepAliveInterval);
      }
      this.connections.delete(sessionId);
    }
  }

  /**
   * Send completion event and close connection
   */
  sendComplete(sessionId: string, result: any): void {
    const connection = this.connections.get(sessionId);

    console.log(`[SSE] Sending completion for ${sessionId}`);

    if (connection) {
      try {
        const data = JSON.stringify({
          type: 'complete',
          percent: 100,
          step: 'Complete',
          message: 'EPM generation complete',
          result,
          timestamp: new Date().toISOString(),
        });
        connection.res.write(`event: complete\ndata: ${data}\n\n`);
        connection.res.end();
      } catch (error) {
        console.error(`[SSE] Failed to send completion to ${sessionId}:`, error);
      }
      if (connection.keepAliveInterval) {
        clearInterval(connection.keepAliveInterval);
      }
      this.connections.delete(sessionId);
    }
  }

  /**
   * Send error event and close connection
   */
  sendError(sessionId: string, error: string): void {
    const connection = this.connections.get(sessionId);

    console.log(`[SSE] Sending error for ${sessionId}: ${error}`);

    if (connection) {
      try {
        const data = JSON.stringify({
          type: 'error',
          percent: -1,
          step: 'Error',
          message: error,
          timestamp: new Date().toISOString(),
        });
        connection.res.write(`event: error\ndata: ${data}\n\n`);
        connection.res.end();
      } catch (e) {
        console.error(`[SSE] Failed to send error to ${sessionId}:`, e);
      }
      if (connection.keepAliveInterval) {
        clearInterval(connection.keepAliveInterval);
      }
      this.connections.delete(sessionId);
    }
  }

  /**
   * Check if a session has an active connection
   */
  hasConnection(sessionId: string): boolean {
    return this.connections.has(sessionId);
  }

  /**
   * Get count of active connections (for debugging)
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
}

// Singleton instance
export const sseProgressManager = new SSEProgressManager();
