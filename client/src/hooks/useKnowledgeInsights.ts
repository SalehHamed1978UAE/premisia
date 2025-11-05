/**
 * React Query hook for fetching combined Knowledge Graph insights
 * 
 * Provides access to both similar strategies and applicable incentives in a single request
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export interface SimilarStrategy {
  sessionId: string;
  journeyType: string;
  similarity: number;
  matchedFactors: string[];
  location?: string;
  industry?: string;
  rootCause?: string;
  completedAt?: string;
  outcome?: string;
}

export interface Incentive {
  incentiveId: string;
  name: string;
  type: 'grant' | 'tax_credit' | 'subsidy' | 'loan' | 'other';
  provider: string;
  jurisdiction: string;
  industry?: string;
  eligibilitySummary: string;
  amount?: string;
  expiryDate?: string;
  link?: string;
  matchScore: number;
}

export interface KnowledgeInsightsResponse {
  success: boolean;
  similarStrategies: SimilarStrategy[];
  incentives: Incentive[];
  message?: string;
  hasConsent?: boolean;
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
          similarStrategies: [],
          incentives: [],
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
