/**
 * Context Foundry Integration for EPM Generator
 * 
 * Phase 1: Stub mode - logs emissions for debugging
 * Phase 2: Live mode - sends to Context Foundry API
 */

import type { KnowledgeEmission, KnowledgeLedger } from './types';

export interface CFIntegrationConfig {
  enabled: boolean;
  mode: 'stub' | 'live';
  apiUrl: string;
  apiKey?: string;
}

export interface CFIntegrationHook {
  onKnowledgeEmission(emission: KnowledgeEmission): Promise<void>;
  onLedgerComplete(ledger: KnowledgeLedger): Promise<void>;
}

/**
 * Stub implementation - logs but doesn't send to CF
 */
class StubCFIntegration implements CFIntegrationHook {
  async onKnowledgeEmission(emission: KnowledgeEmission): Promise<void> {
    console.log(`[CF-Stub] Knowledge emission: ${emission.type} - ${emission.summary.substring(0, 100)}...`);
  }

  async onLedgerComplete(ledger: KnowledgeLedger): Promise<void> {
    console.log(`[CF-Stub] Ledger complete: ${ledger.stats.emitted} emissions, ${ledger.stats.contested} contested`);
  }
}

/**
 * Live implementation - sends to Context Foundry API
 */
class LiveCFIntegration implements CFIntegrationHook {
  private apiUrl: string;
  private apiKey: string;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  async onKnowledgeEmission(emission: KnowledgeEmission): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/api/v1/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CF-API-Key': this.apiKey,
        },
        body: JSON.stringify({
          type: 'knowledge_emission',
          data: emission,
        }),
      });

      if (!response.ok) {
        console.error(`[CF-Live] Failed to send emission: ${response.status}`);
      }
    } catch (error) {
      console.error('[CF-Live] Error sending emission:', error);
    }
  }

  async onLedgerComplete(ledger: KnowledgeLedger): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/api/v1/ledger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CF-API-Key': this.apiKey,
        },
        body: JSON.stringify({
          type: 'knowledge_ledger',
          data: ledger,
        }),
      });

      if (!response.ok) {
        console.error(`[CF-Live] Failed to send ledger: ${response.status}`);
      } else {
        console.log(`[CF-Live] Ledger sent: ${ledger.stats.emitted} emissions`);
      }
    } catch (error) {
      console.error('[CF-Live] Error sending ledger:', error);
    }
  }
}

/**
 * Factory function to create appropriate CF integration
 */
export function createCFIntegration(): CFIntegrationHook {
  const enabled = process.env.CF_INTEGRATION_ENABLED === 'true';
  const mode = process.env.CF_INTEGRATION_MODE || 'stub';
  const apiUrl = process.env.CF_API_URL;
  const apiKey = process.env.CONTEXT_FOUNDRY_API_KEY || '';

  if (!enabled) {
    console.log('[CFIntegration] Disabled - using no-op hook');
    return {
      onKnowledgeEmission: async () => {},
      onLedgerComplete: async () => {},
    };
  }

  if (mode === 'live' && apiKey && apiUrl) {
    console.log('[CFIntegration] Live mode - will send to Context Foundry');
    return new LiveCFIntegration(apiUrl, apiKey);
  }

  console.log('[CFIntegration] Stub mode - logging only');
  return new StubCFIntegration();
}

export { StubCFIntegration, LiveCFIntegration };
