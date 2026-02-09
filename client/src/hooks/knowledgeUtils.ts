/**
 * Knowledge Graph Utilities
 * 
 * Provides helper functions and types for working with knowledge graph insights.
 * 
 * CRITICAL RULE: The knowledge insights API expects an understandingId (the root strategic
 * understanding UUID), NOT a journey session ID. Always pass the understanding ID.
 */

/**
 * Derives the correct understanding ID for knowledge insights from various entity types.
 * 
 * @param entity - The entity to extract understanding ID from
 * @returns The understanding ID or null if not available
 * 
 * @example
 * // From strategy detail with sessions
 * const id = deriveKnowledgeInsightId({ understanding: { id: '...' } });
 * 
 * @example
 * // From strategy list item
 * const id = deriveKnowledgeInsightId({ id: '...' });
 */
export function deriveKnowledgeInsightId(entity: 
  | { understanding: { id: string } }  // StrategyDetail shape
  | { id: string }                      // Strategy list item shape
  | null 
  | undefined
): string | null {
  if (!entity) return null;
  
  // StrategyDetail shape: extract from understanding
  if ('understanding' in entity && entity.understanding?.id) {
    return entity.understanding.id;
  }
  
  // Strategy list item shape: id IS the understanding ID
  if ('id' in entity && entity.id) {
    return entity.id;
  }
  
  return null;
}

/**
 * Type guard to validate that an ID is a UUID and not accidentally a session ID
 * This is a development helper to catch bugs early.
 */
export function isValidUnderstandingId(id: string | null | undefined): id is string {
  if (!id) return false;
  // UUID format validation (loose check)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(id);
}
