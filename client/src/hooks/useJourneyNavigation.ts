/**
 * useJourneyNavigation - Hook for dynamic journey navigation
 *
 * Provides functions to navigate to the next/previous page in a journey
 * based on the journey's pageSequence configuration.
 */

import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/queryClient';

interface JourneySession {
  id: string;
  understandingId: string;
  journeyType: string;
  currentFrameworkIndex: number;
  completedFrameworks: string[];
  pageSequence: string[];
  frameworks: string[];
}

interface NavigationResult {
  nextUrl: string | null;
  prevUrl: string | null;
  nextLabel: string;
  isLoading: boolean;
  error: Error | null;
  journeyType: string | null;
}

// Map framework names to display labels for button text
const FRAMEWORK_LABELS: Record<string, string> = {
  pestle: "PESTLE Analysis",
  porters: "Porter's Five Forces",
  swot: "SWOT Analysis",
  bmc: "Business Model Canvas",
  ansoff: "Ansoff Matrix",
  five_whys: "Five Whys Analysis",
  blue_ocean: "Blue Ocean Strategy",
  strategic_decisions: "Strategic Decisions",
  prioritization: "Prioritization",
  decisions: "Strategic Decisions",
};

// Map page paths to framework names for matching
const PAGE_TO_FRAMEWORK: Record<string, string> = {
  'pestle-results': 'pestle',
  'porters-results': 'porters',
  'swot-results': 'swot',
  'research': 'bmc',  // Research page is for BMC
  'framework-insight': 'ansoff',  // Framework insight can be ansoff or other
  'whys-tree': 'five_whys',
  'decisions': 'strategic_decisions',
  'prioritization': 'prioritization',
};

/**
 * Get the framework label for a page path
 */
function getFrameworkFromPath(path: string): string {
  // Extract the page name from the path pattern
  // e.g., '/strategic-consultant/porters-results/:sessionId/:versionNumber' -> 'porters-results'
  const parts = path.split('/').filter(Boolean);
  const pageName = parts.find(p => !p.startsWith(':') && p !== 'strategic-consultant' && p !== 'strategy-workspace');

  if (pageName) {
    return PAGE_TO_FRAMEWORK[pageName] || pageName;
  }
  return 'next step';
}

/**
 * Match a page sequence pattern to the current page
 * Pattern: /strategic-consultant/pestle-results/:sessionId/:versionNumber
 * Current: /strategic-consultant/pestle-results
 */
function matchPagePattern(pattern: string, currentPageType: string): boolean {
  // Extract base path without parameters
  const patternBase = pattern.split('/:')[0];
  const patternParts = patternBase.split('/').filter(Boolean);
  const patternPageType = patternParts[patternParts.length - 1];

  return patternPageType === currentPageType;
}

/**
 * Replace URL parameters with actual values
 */
function buildUrl(pattern: string, sessionId: string, versionNumber: string | number): string {
  return pattern
    .replace(':sessionId', sessionId)
    .replace(':versionNumber', String(versionNumber))
    .replace(':understandingId', sessionId); // understandingId is sometimes used as sessionId
}

/**
 * Hook to get journey navigation URLs
 *
 * @param sessionId - The session/understanding ID
 * @param currentPageType - The current page type (e.g., 'pestle-results', 'porters-results')
 * @param versionNumber - The current version number
 */
export function useJourneyNavigation(
  sessionId: string | undefined,
  currentPageType: string,
  versionNumber: string | number = 1
): NavigationResult {
  const { data: journeySession, isLoading, error } = useQuery<JourneySession>({
    queryKey: ['journey-session', sessionId],
    queryFn: async () => {
      if (!sessionId) throw new Error('No session ID');
      const res = await authFetch(`/api/strategic-consultant/journey-sessions/by-session/${sessionId}`);
      if (!res.ok) {
        if (res.status === 404) {
          // No journey session found - return default navigation
          throw new Error('Journey session not found');
        }
        throw new Error('Failed to fetch journey session');
      }
      return res.json();
    },
    enabled: !!sessionId,
    retry: false,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Find current position in page sequence
  let nextUrl: string | null = null;
  let prevUrl: string | null = null;
  let nextLabel = 'Continue';
  let journeyType = journeySession?.journeyType || null;

  if (journeySession?.pageSequence) {
    const sequence = journeySession.pageSequence;

    // Find current page index
    const currentIndex = sequence.findIndex(pattern =>
      matchPagePattern(pattern, currentPageType)
    );

    if (currentIndex !== -1) {
      // Get next page
      if (currentIndex < sequence.length - 1) {
        const nextPattern = sequence[currentIndex + 1];
        nextUrl = buildUrl(nextPattern, sessionId!, versionNumber);

        // Generate label based on next framework
        const nextFramework = getFrameworkFromPath(nextPattern);
        nextLabel = `Continue to ${FRAMEWORK_LABELS[nextFramework] || nextFramework}`;
      }

      // Get previous page
      if (currentIndex > 0) {
        const prevPattern = sequence[currentIndex - 1];
        prevUrl = buildUrl(prevPattern, sessionId!, versionNumber);
      }
    }
  }

  return {
    nextUrl,
    prevUrl,
    nextLabel,
    isLoading,
    error: error as Error | null,
    journeyType,
  };
}

/**
 * Get the next page URL synchronously from a journey session object
 * Useful when you already have the journey session data
 */
export function getNextPageUrl(
  journeySession: JourneySession | null | undefined,
  currentPageType: string,
  sessionId: string,
  versionNumber: string | number = 1
): { nextUrl: string | null; nextLabel: string } {
  if (!journeySession?.pageSequence) {
    return { nextUrl: null, nextLabel: 'Continue' };
  }

  const sequence = journeySession.pageSequence;
  const currentIndex = sequence.findIndex(pattern =>
    matchPagePattern(pattern, currentPageType)
  );

  if (currentIndex === -1 || currentIndex >= sequence.length - 1) {
    return { nextUrl: null, nextLabel: 'Continue' };
  }

  const nextPattern = sequence[currentIndex + 1];
  const nextUrl = buildUrl(nextPattern, sessionId, versionNumber);
  const nextFramework = getFrameworkFromPath(nextPattern);
  const nextLabel = `Continue to ${FRAMEWORK_LABELS[nextFramework] || nextFramework}`;

  return { nextUrl, nextLabel };
}
