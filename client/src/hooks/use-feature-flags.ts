/**
 * Feature Flags Hook
 * Fetches feature flag configuration from the server
 */

import { useQuery } from "@tanstack/react-query";

interface FeatureFlags {
  journeyRegistryV2: boolean;
  knowledgeGraph: boolean;
}

/**
 * Hook to access feature flags from the server
 * 
 * @returns Object containing all feature flags
 * @example
 * ```tsx
 * const { journeyRegistryV2, knowledgeGraph } = useFeatureFlags();
 * 
 * if (journeyRegistryV2) {
 *   // Show new feature
 * } else {
 *   // Show legacy behavior
 * }
 * 
 * if (knowledgeGraph) {
 *   // Show Knowledge Graph insights
 * }
 * ```
 */
export function useFeatureFlags() {
  const { data, isLoading } = useQuery<FeatureFlags>({
    queryKey: ['/api/strategic-consultant/config/features'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1, // Only retry once on failure
  });

  return {
    journeyRegistryV2: data?.journeyRegistryV2 ?? false,
    knowledgeGraph: data?.knowledgeGraph ?? false,
    isLoading,
  };
}
