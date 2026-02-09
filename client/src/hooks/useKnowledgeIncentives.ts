/**
 * React Query hook for fetching applicable incentives from the Knowledge Graph
 * 
 * Provides access to government incentives, grants, and programs based on jurisdiction and industry
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export interface Incentive {
  incentiveId: string;
  name: string;
  type: 'grant' | 'tax_credit' | 'subsidy' | 'loan' | 'other';
  jurisdiction: string;
  industry?: string;
  eligibilitySummary: string;
  amount?: string;
  deadline?: string;
  link?: string;
  matchScore: number;
}

export interface IncentivesResponse {
  success: boolean;
  incentives: Incentive[];
  message?: string;
  metadata?: {
    sessionId: string;
    queryTime: number;
    filters: {
      jurisdictionId?: string;
      industryId?: string;
      locationId?: string;
    };
  };
}

// ============================================================================
// Query Keys
// ============================================================================

const incentivesKeys = {
  all: ['knowledge', 'incentives'] as const,
  bySession: (sessionId: string) => ['knowledge', 'incentives', sessionId] as const,
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Fetch applicable incentives for a given journey session
 * 
 * Returns up to 10 applicable incentives based on jurisdiction and industry
 * Returns empty array if Knowledge Graph is not configured
 * 
 * @param sessionId - The journey session ID to find incentives for
 * @param options - Additional query options
 * @returns Query result with incentives data
 */
export function useKnowledgeIncentives(
  sessionId: string,
  options?: {
    enabled?: boolean;
  }
): UseQueryResult<IncentivesResponse> {
  return useQuery({
    queryKey: incentivesKeys.bySession(sessionId),
    queryFn: async () => {
      const response = await fetch(`/api/knowledge/incentives?sessionId=${sessionId}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch incentives');
      }
      
      return await response.json();
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!sessionId,
    staleTime: 10 * 60 * 1000, // 10 minutes - incentives don't change frequently
    gcTime: 30 * 60 * 1000, // 30 minutes cache time
  });
}

/**
 * Export query keys for manual cache invalidation
 */
export { incentivesKeys };
