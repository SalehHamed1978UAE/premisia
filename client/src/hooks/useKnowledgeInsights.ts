/**
 * React Query hook for fetching combined Knowledge Graph insights
 * 
 * Provides access to both similar strategies and applicable incentives in a single request
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';

// ============================================================================
// Types (PostgreSQL-based API response format)
// ============================================================================

export interface SimilarStrategy {
  strategyId: string;
  sessionId: string;
  versionNumber: number;
  title: string;
  score: number;
  summary: string;
  completedAt: string;
  consent: 'private' | 'aggregate_only' | 'share_with_peers';
}

export interface Incentive {
  id: string;
  name: string;
  jurisdiction: string;
  deadline: string;
  rationale: string;
  score: number;
}

export interface Evidence {
  referenceId: string;
  title: string;
  url: string;
  topic: string;
  confidence: number;
}

export interface KnowledgeInsightsResponse {
  success: boolean;
  hasConsent: boolean;
  similarStrategies: SimilarStrategy[];
  incentives: Incentive[];
  evidence: Evidence[];
  dataClassification: 'user-scoped' | 'aggregate' | 'shared';
  message?: string;
  metadata?: {
    sessionId: string;
    queryTime: number;
  };
}

// ============================================================================
// Query Keys
// ============================================================================

const knowledgeInsightsKeys = {
  all: ['knowledge-insights'] as const,
  bySession: (sessionId: string | null) => ['knowledge-insights', sessionId] as const,
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Fetch combined Knowledge Graph insights for a given session
 * 
 * Returns both similar strategies and applicable incentives
 * Returns empty arrays if Knowledge Graph is not configured or user hasn't consented
 * 
 * @param sessionId - The journey session ID to find insights for
 * @param options - Additional query options
 * @returns Query result with combined insights data
 */
export function useKnowledgeInsights(
  sessionId: string | null,
  options?: {
    enabled?: boolean;
  }
): UseQueryResult<KnowledgeInsightsResponse> {
  return useQuery({
    queryKey: knowledgeInsightsKeys.bySession(sessionId),
    queryFn: async () => {
      if (!sessionId) {
        return {
          success: false,
          hasConsent: false,
          similarStrategies: [],
          incentives: [],
          evidence: [],
          dataClassification: 'user-scoped' as const,
          message: 'No session ID provided',
        };
      }

      const response = await fetch(`/api/knowledge/insights/${sessionId}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch insights');
      }
      
      return await response.json();
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!sessionId,
    staleTime: 60_000, // 1 minute - insights should be relatively fresh
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
  });
}

/**
 * Export query keys for manual cache invalidation
 */
export { knowledgeInsightsKeys };
