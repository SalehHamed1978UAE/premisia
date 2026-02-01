/**
 * RoleInferenceService - LLM-driven workstream owner assignment
 *
 * ARCHITECTURE: Replaces hardcoded keyword matching with dynamic AI inference.
 * Makes ONE batch call for all workstreams to minimize latency.
 *
 * Key features:
 * - Batch inference (all workstreams in one LLM call)
 * - In-memory caching by workstream name
 * - Role normalization and deduplication
 * - Team size constraints (maxRoles)
 * - Fallback to template-based assignment on failure
 */

import { getLLMProvider } from '../../lib/llm-provider';
import type { Workstream, ResourcePlan, ResourceAllocation } from '../types';

export interface InferredOwner {
  workstreamId: string;
  roleTitle: string;
  category: string;
  rationale: string;
  confidence: number;
}

export interface RoleInferenceResult {
  owners: InferredOwner[];
  notes?: string;
  usedCache: boolean;
  usedFallback: boolean;
}

interface BusinessContext {
  industry?: string;
  businessType?: string;
  geography?: string;
  initiativeType?: string;
  programName?: string;
}

// In-memory cache for role inference (persists for session)
const roleCache: Map<string, InferredOwner> = new Map();

// Category to skills mapping for resource plan integration
const CATEGORY_SKILLS: Record<string, string[]> = {
  construction: ['fit-out', 'build-out', 'interior design', 'renovation'],
  design: ['interior design', 'space planning', 'architecture'],
  technology: ['POS systems', 'IT infrastructure', 'digital integration'],
  tech: ['POS systems', 'IT infrastructure', 'software implementation'],
  hr: ['recruitment', 'training', 'onboarding', 'staff management'],
  training: ['staff training', 'skills development', 'certification'],
  marketing: ['launch campaigns', 'social media', 'brand building', 'PR'],
  community: ['community engagement', 'local partnerships', 'events'],
  compliance: ['regulatory compliance', 'food safety', 'licensing', 'permits'],
  licensing: ['permits', 'regulatory approval', 'health inspection'],
  operations: ['operational setup', 'process design', 'supply chain'],
  supply_chain: ['vendor management', 'inventory', 'logistics'],
  finance: ['financial planning', 'budgeting', 'cost control'],
  culinary: ['menu development', 'food quality', 'recipe standardization'],
};

/**
 * Normalize role title for consistent matching
 * - Trim whitespace
 * - Title case
 * - Collapse multiple spaces
 */
export function normalizeRole(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate cache key from business type + workstream name
 */
function getCacheKey(businessType: string, workstreamName: string): string {
  return `${businessType}::${workstreamName}`.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Infer skills from category
 */
export function inferSkillsFromCategory(category: string): string[] {
  const normalized = category.toLowerCase().replace(/[^a-z_]/g, '');
  return CATEGORY_SKILLS[normalized] || ['general management'];
}

export class RoleInferenceService {
  private llm = getLLMProvider();

  /**
   * Infer owners for all workstreams in a single batch call
   * Returns role assignments with confidence scores and rationale
   */
  async inferOwners(
    businessContext: BusinessContext,
    workstreams: Workstream[],
    maxRoles: number = 6
  ): Promise<RoleInferenceResult> {
    const effectiveMaxRoles = Math.min(workstreams.length, maxRoles);
    const businessTypeKey = businessContext.businessType || businessContext.industry || 'general';

    console.log(`[RoleInference] Starting batch inference for ${workstreams.length} workstreams`);
    console.log(`[RoleInference] Business context: ${businessTypeKey}, max roles: ${effectiveMaxRoles}`);

    // Check cache first
    const cachedOwners: InferredOwner[] = [];
    const uncachedWorkstreams: Workstream[] = [];

    for (const ws of workstreams) {
      const cacheKey = getCacheKey(businessTypeKey, ws.name);
      const cached = roleCache.get(cacheKey);

      if (cached) {
        cachedOwners.push({
          ...cached,
          workstreamId: ws.id, // Update ID in case of reuse
        });
        console.log(`[RoleInference] Cache hit: "${ws.name}" → ${cached.roleTitle}`);
      } else {
        uncachedWorkstreams.push(ws);
      }
    }

    // If all cached, return immediately
    if (uncachedWorkstreams.length === 0) {
      console.log(`[RoleInference] All ${workstreams.length} workstreams found in cache`);
      return {
        owners: cachedOwners,
        usedCache: true,
        usedFallback: false,
      };
    }

    console.log(`[RoleInference] Cache: ${cachedOwners.length} hits, ${uncachedWorkstreams.length} misses`);

    try {
      // Build the prompt for uncached workstreams
      const workstreamList = uncachedWorkstreams.map((ws, i) => {
        const topDeliverables = (ws.deliverables || [])
          .slice(0, 3)
          .map(d => typeof d === 'string' ? d : d.name || 'Deliverable')
          .join(', ');

        return `${i + 1}. ID: ${ws.id}
   Name: ${ws.name}
   Description: ${ws.description || 'N/A'}
   Sample tasks: ${topDeliverables || 'N/A'}`;
      }).join('\n\n');

      const prompt = `You are a COO staffing expert designing a launch team.

PROGRAM CONTEXT:
- Industry: ${businessContext.industry || 'Not specified'}
- Business type: ${businessContext.businessType || 'Not specified'}
- Geography: ${businessContext.geography || 'Not specified'}
- Initiative: ${businessContext.initiativeType || 'market_entry'}
- Program: ${businessContext.programName || 'Strategic Program'}
- Team size target: At most ${effectiveMaxRoles} unique roles

WORKSTREAMS TO STAFF:
${workstreamList}

Return ONLY valid JSON (no markdown, no explanation):
{
  "owners": [
    {
      "workstream_id": "WS001",
      "role_title": "Cafe Design & Build Lead",
      "category": "construction",
      "rationale": "Reason referencing context",
      "confidence": 0.9
    }
  ],
  "notes": "Optional consolidation notes"
}

RULES:
1. CRITICAL: Each workstream should have a DISTINCT specialist owner. Do NOT default everything to "Operations Manager" or "Program Manager"
2. Use precise, professional titles appropriate for the business type:
   - Construction/Build-out workstream → "Construction & Design Lead" or "Cafe Build-out Manager"
   - Technology/Digital/POS workstream → "Digital Systems Lead" or "Technology Manager"
   - HR/Hiring/Training workstream → "HR & Training Coordinator" or "Talent Manager"
   - Marketing/Community/Engagement workstream → "Marketing & Community Manager"
   - Compliance/Licensing/Regulatory workstream → "Compliance Specialist"
   - Operations/Workflow workstream → "Operations Manager"
   - Supply Chain/Inventory workstream → "Supply Chain Manager"
3. Category must be ONE of: construction, design, technology, hr, training, marketing, community, compliance, licensing, operations, supply_chain, finance, culinary
4. Only consolidate roles if workstreams are genuinely similar (e.g., two marketing workstreams can share one Marketing Manager)
5. Match role titles to the actual business type - a cafe should NOT have "Catering Operations Manager"
6. Return an owner for EVERY workstream ID listed above
7. AIM FOR DIVERSITY: If you have 6 workstreams, you should have 4-6 different role titles, not 2-3`;

      const response = await this.llm.generateStructuredResponse(prompt, { owners: [] });

      if (!response?.owners || !Array.isArray(response.owners)) {
        console.warn('[RoleInference] LLM returned invalid structure, using fallback');
        return this.fallbackInference(workstreams, businessContext);
      }

      // Process and cache results
      const inferredOwners: InferredOwner[] = response.owners.map((o: any) => ({
        workstreamId: o.workstream_id,
        roleTitle: normalizeRole(o.role_title || 'Program Manager'),
        category: o.category || 'operations',
        rationale: o.rationale || 'AI-assigned based on workstream content',
        confidence: o.confidence || 0.7,
      }));

      // Cache the results
      for (const owner of inferredOwners) {
        const ws = uncachedWorkstreams.find(w => w.id === owner.workstreamId);
        if (ws) {
          const cacheKey = getCacheKey(businessTypeKey, ws.name);
          roleCache.set(cacheKey, owner);
        }
      }

      // Log inference results
      console.log(`[RoleInference] AI inferred ${inferredOwners.length} owners:`);
      for (const owner of inferredOwners) {
        const ws = uncachedWorkstreams.find(w => w.id === owner.workstreamId);
        console.log(`  - ${ws?.name || owner.workstreamId} → ${owner.roleTitle} (${owner.category}, conf: ${owner.confidence})`);
      }

      // Combine cached and newly inferred
      let allOwners = [...cachedOwners, ...inferredOwners];

      // Check for role count and validate balance
      const uniqueRoles = new Set(allOwners.map(o => o.roleTitle));
      console.log(`[RoleInference] Initial unique roles: ${uniqueRoles.size} (target: ${effectiveMaxRoles})`);

      // VALIDATION PASS: If too few unique roles, ask LLM to review and rebalance
      if (uniqueRoles.size < Math.min(4, workstreams.length) && workstreams.length >= 4) {
        console.log(`[RoleInference] 🔄 Too few unique roles (${uniqueRoles.size}), running validation pass...`);
        const validated = await this.validateAndRebalance(allOwners, workstreams, businessContext);
        if (validated) {
          allOwners = validated;
          const newUniqueRoles = new Set(allOwners.map(o => o.roleTitle));
          console.log(`[RoleInference] ✓ Validation rebalanced to ${newUniqueRoles.size} unique roles`);
        }
      }

      return {
        owners: allOwners,
        notes: response.notes,
        usedCache: cachedOwners.length > 0,
        usedFallback: false,
      };

    } catch (error) {
      console.error('[RoleInference] LLM call failed, using fallback:', error);
      return this.fallbackInference(workstreams, businessContext);
    }
  }

  /**
   * Fallback inference using simple heuristics (no LLM)
   * Used when LLM call fails
   */
  private fallbackInference(
    workstreams: Workstream[],
    businessContext: BusinessContext
  ): RoleInferenceResult {
    console.log('[RoleInference] Using fallback heuristic assignment');

    const owners: InferredOwner[] = workstreams.map(ws => {
      const name = ws.name.toLowerCase();
      const desc = (ws.description || '').toLowerCase();
      const combined = `${name} ${desc}`;

      let roleTitle = 'Program Manager';
      let category = 'operations';

      // Simple keyword matching as fallback
      if (combined.includes('construction') || combined.includes('build') || combined.includes('design') || combined.includes('fit-out')) {
        roleTitle = 'Construction & Design Lead';
        category = 'construction';
      } else if (combined.includes('compliance') || combined.includes('licensing') || combined.includes('permit') || combined.includes('regulatory')) {
        roleTitle = 'Compliance & Licensing Specialist';
        category = 'compliance';
      } else if (combined.includes('technology') || combined.includes('pos') || combined.includes('system') || combined.includes('digital')) {
        roleTitle = 'Technology & Systems Lead';
        category = 'technology';
      } else if (combined.includes('talent') || combined.includes('training') || combined.includes('recruitment') || combined.includes('staff') || combined.includes('hr')) {
        roleTitle = 'HR & Training Coordinator';
        category = 'hr';
      } else if (combined.includes('marketing') || combined.includes('brand') || combined.includes('community') || combined.includes('social')) {
        roleTitle = 'Marketing & Community Manager';
        category = 'marketing';
      } else if (combined.includes('supply') || combined.includes('inventory') || combined.includes('vendor') || combined.includes('procurement')) {
        roleTitle = 'Supply Chain Manager';
        category = 'supply_chain';
      } else if (combined.includes('financial') || combined.includes('budget') || combined.includes('cost')) {
        roleTitle = 'Financial Controller';
        category = 'finance';
      } else if (combined.includes('menu') || combined.includes('culinary') || combined.includes('food') || combined.includes('recipe')) {
        roleTitle = 'Culinary Director';
        category = 'culinary';
      }

      return {
        workstreamId: ws.id,
        roleTitle: normalizeRole(roleTitle),
        category,
        rationale: 'Fallback assignment based on workstream keywords',
        confidence: 0.5,
      };
    });

    return {
      owners,
      notes: 'Fallback assignment used due to LLM failure',
      usedCache: false,
      usedFallback: true,
    };
  }

  /**
   * Validation pass: Review assignments and rebalance if too many share the same role
   * This is a second LLM call that critiques and improves the initial assignments
   */
  private async validateAndRebalance(
    currentOwners: InferredOwner[],
    workstreams: Workstream[],
    businessContext: BusinessContext
  ): Promise<InferredOwner[] | null> {
    try {
      // Build current assignment summary for review
      const assignmentSummary = currentOwners.map(o => {
        const ws = workstreams.find(w => w.id === o.workstreamId);
        return `- "${ws?.name || o.workstreamId}" → ${o.roleTitle}`;
      }).join('\n');

      // Count role distribution
      const roleCounts: Record<string, number> = {};
      currentOwners.forEach(o => {
        roleCounts[o.roleTitle] = (roleCounts[o.roleTitle] || 0) + 1;
      });
      const distribution = Object.entries(roleCounts)
        .map(([role, count]) => `${role}: ${count} workstreams`)
        .join(', ');

      const prompt = `You are reviewing workstream-to-owner assignments for quality and balance.

BUSINESS CONTEXT:
- Industry: ${businessContext.industry || 'Not specified'}
- Business type: ${businessContext.businessType || 'Not specified'}
- Total workstreams: ${workstreams.length}

CURRENT ASSIGNMENTS:
${assignmentSummary}

CURRENT DISTRIBUTION: ${distribution}

PROBLEM: Too many workstreams are assigned to the same role. This isn't realistic - different workstreams need different specialists.

REVIEW AND FIX:
1. Identify workstreams that should have a DIFFERENT specialist owner
2. For each misassigned workstream, provide the CORRECT role title
3. Use these specialist roles as guidance:
   - Construction/Build-out → "Construction & Design Lead"
   - Technology/Digital/POS → "Digital Systems Lead" or "Technology Manager"
   - HR/Hiring/Training → "HR & Training Coordinator"
   - Marketing/Community → "Marketing & Community Manager"
   - Compliance/Licensing → "Compliance Specialist"
   - Operations/Workflow → "Operations Manager"

Return ONLY valid JSON with corrections:
{
  "corrections": [
    {
      "workstream_id": "WS001",
      "old_role": "Operations Manager",
      "new_role": "Digital Systems Lead",
      "category": "technology",
      "reason": "This workstream is about POS and digital systems, not general operations"
    }
  ],
  "validation_notes": "Brief summary of what was fixed"
}

If no corrections needed, return: {"corrections": [], "validation_notes": "Assignments are balanced"}`;

      const response = await this.llm.generateStructuredResponse(prompt, { corrections: [] });

      if (!response?.corrections || !Array.isArray(response.corrections) || response.corrections.length === 0) {
        console.log('[RoleInference] Validation found no corrections needed');
        return null;
      }

      console.log(`[RoleInference] Validation suggested ${response.corrections.length} corrections:`);

      // Apply corrections
      const correctedOwners = currentOwners.map(owner => {
        const correction = response.corrections.find((c: any) => c.workstream_id === owner.workstreamId);
        if (correction) {
          console.log(`  - ${owner.workstreamId}: "${owner.roleTitle}" → "${correction.new_role}" (${correction.reason})`);
          return {
            ...owner,
            roleTitle: normalizeRole(correction.new_role),
            category: correction.category || owner.category,
            rationale: `Rebalanced: ${correction.reason}`,
            confidence: 0.85,
          };
        }
        return owner;
      });

      if (response.validation_notes) {
        console.log(`[RoleInference] Validation notes: ${response.validation_notes}`);
      }

      return correctedOwners;

    } catch (error) {
      console.error('[RoleInference] Validation pass failed:', error);
      return null; // Keep original assignments on failure
    }
  }

  /**
   * Clear the role cache (useful for testing)
   */
  clearCache(): void {
    roleCache.clear();
    console.log('[RoleInference] Cache cleared');
  }
}

/**
 * Ensure a role exists in the resource plan
 * If not found, adds it with appropriate skills
 */
export function ensureResourceExists(
  roleTitle: string,
  resourcePlan: ResourcePlan,
  category: string
): void {
  const normalizedRole = normalizeRole(roleTitle);

  // Check if role already exists (case-insensitive)
  const exists = resourcePlan.internalTeam.some(
    r => normalizeRole(r.role) === normalizedRole
  );

  if (!exists) {
    console.log(`[RoleInference] Adding new role to resource plan: ${normalizedRole}`);
    resourcePlan.internalTeam.push({
      role: normalizedRole,
      allocation: 1.0, // 100% allocation
      months: 6, // Default 6 months duration
      skills: inferSkillsFromCategory(category),
      justification: `Added by LLM role inference for ${category} workstreams`,
    });
  }
}

export default RoleInferenceService;
