/**
 * React Query hook for fetching similar strategic journeys from the Knowledge Graph
 * 
 * Provides access to similar journeys based on location, industry, and root cause analysis
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { authFetch } from '@/lib/queryClient';

// ============================================================================
// Types
// ============================================================================

export interface SimilarJourney {
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

export interface SimilarStrategiesResponse {
  success: boolean;
  similarJourneys: SimilarJourney[];
  message?: string;
  metadata?: {
    sessionId: string;
    queryTime: number;
    filters: {
      locationId?: string;
      industryId?: string;
      rootCause?: string;
    };
  };
}

// ============================================================================
// Query Keys
// ============================================================================

const similarStrategiesKeys = {
  all: ['knowledge', 'similar-strategies'] as const,
  bySession: (sessionId: string) => ['knowledge', 'similar-strategies', sessionId] as const,
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Fetch similar strategic journeys for a given session
 * 
 * Returns top 3 similar journeys based on contextual similarity
 * Returns empty array if Knowledge Graph is not configured
 * 
 * @param sessionId - The journey session ID to find similar strategies for
 * @param options - Additional query options
 * @returns Query result with similar journeys data
 */
export function useKnowledgeSimilarStrategies(
  sessionId: string,
  options?: {
    enabled?: boolean;
  }
): UseQueryResult<SimilarStrategiesResponse> {
  return useQuery({
    queryKey: similarStrategiesKeys.bySession(sessionId),
    queryFn: async () => {
      const response = await authFetch(`/api/knowledge/similar-strategies?sessionId=${sessionId}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch similar strategies');
      }
      
      return await response.json();
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!sessionId,
    staleTime: 5 * 60 * 1000, // 5 minutes - similar journeys don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes cache time
  });
}

/**
 * Export query keys for manual cache invalidation
 */
export { similarStrategiesKeys };
