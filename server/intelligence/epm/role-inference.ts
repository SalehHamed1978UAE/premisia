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
import type { Workstream, ResourcePlan, ResourceAllocation, DomainProfile, DomainCode } from '../types';

export interface InferredOwner {
  workstreamId: string;
  roleTitle: string;
  category: string;
  rationale: string;
  confidence: number;
}

export interface ValidationWarning {
  type: 'over_consolidation' | 'missing_function' | 'team_size' | 'mismatch';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  recommendation: string;
  workstreamId?: string;
}

export interface RoleInferenceResult {
  owners: InferredOwner[];
  notes?: string;
  warnings: ValidationWarning[];
  usedCache: boolean;
  usedFallback: boolean;
  validationRan: boolean;
}

interface BusinessContext {
  industry?: string;
  businessType?: string;
  geography?: string;
  initiativeType?: string;
  programName?: string;
  domainProfile?: DomainProfile;
}

// In-memory cache for role inference (persists for session)
const roleCache: Map<string, InferredOwner> = new Map();

// Baseline category-to-skills mapping (domain-neutral)
const CATEGORY_SKILLS: Record<string, string[]> = {
  construction: ['implementation planning', 'environment setup', 'vendor coordination'],
  design: ['solution design', 'service design', 'architecture review'],
  technology: ['systems architecture', 'integration design', 'platform reliability'],
  tech: ['systems architecture', 'integration design', 'platform reliability'],
  hr: ['recruitment', 'training', 'onboarding', 'staff management'],
  training: ['skills development', 'certification planning', 'enablement delivery'],
  marketing: ['go-to-market planning', 'campaign execution', 'brand positioning'],
  community: ['partner engagement', 'stakeholder communication', 'ecosystem development'],
  compliance: ['regulatory compliance', 'policy controls', 'audit readiness', 'licensing'],
  licensing: ['permits', 'regulatory approval', 'compliance documentation'],
  operations: ['operational setup', 'process design', 'service operations'],
  supply_chain: ['vendor management', 'capacity planning', 'logistics coordination'],
  finance: ['financial planning', 'budgeting', 'cost control'],
  culinary: ['service quality standards', 'operational playbooks', 'quality control'],
};

const DOMAIN_CATEGORY_SKILLS: Record<DomainCode, Partial<Record<string, string[]>>> = {
  banking_fintech: {
    technology: [
      'core banking integration (Temenos/Finastra)',
      'secure transaction processing',
      'audit logging',
      'data residency controls',
    ],
    tech: [
      'core banking integration (Temenos/Finastra)',
      'secure transaction processing',
      'audit logging',
      'data residency controls',
    ],
    compliance: [
      'kyc/aml controls',
      'cbuae/cbb compliance',
      'suspicious activity reporting workflows',
      'audit evidence management',
    ],
    operations: [
      'regulated operations readiness',
      'incident response governance',
      'service-level controls',
    ],
  },
  healthcare: {
    compliance: ['patient privacy controls', 'clinical compliance', 'audit readiness'],
    technology: ['health systems integration', 'data privacy controls', 'availability management'],
  },
  ports_logistics: {
    operations: [
      'port operations optimization',
      'fleet reliability controls',
      'terminal throughput governance',
      'cost-to-serve execution',
    ],
    supply_chain: [
      'cargo flow optimization',
      'vendor and subcontractor governance',
      'logistics performance management',
    ],
    compliance: [
      'maritime compliance',
      'operational risk controls',
      'audit evidence management',
    ],
    technology: [
      'operational systems integration',
      'control tower analytics',
      'data quality governance',
    ],
    tech: [
      'operational systems integration',
      'control tower analytics',
      'data quality governance',
    ],
  },
  retail_food: {
    compliance: ['food safety', 'health inspections', 'licensing'],
    technology: ['pos systems', 'inventory integration', 'store operations tooling'],
  },
  retail_general: {
    technology: ['pos systems', 'inventory integration', 'checkout reliability'],
    operations: ['store operations', 'inventory control', 'vendor logistics'],
  },
  saas_technology: {
    technology: ['api integration', 'cloud reliability', 'release engineering'],
    compliance: ['security controls', 'data protection', 'audit readiness'],
  },
  general: {},
};

const DOMAIN_FORBIDDEN_TERMS: Record<DomainCode, string[]> = {
  banking_fintech: ['food safety', 'pos systems', 'restaurant', 'menu', 'haccp'],
  healthcare: ['pos systems', 'restaurant', 'menu', 'kyc', 'aml'],
  ports_logistics: ['saas', 'site reliability engineering', 'api integration', 'devops', 'product roadmap'],
  retail_food: ['kyc', 'aml', 'cbuae', 'cbb'],
  retail_general: ['kyc', 'aml', 'cbuae', 'cbb', 'hipaa'],
  saas_technology: ['food safety', 'restaurant', 'menu', 'haccp'],
  general: [],
};

function normalizeDomainCode(domainProfile?: DomainProfile | string): DomainCode {
  if (!domainProfile) return 'general';
  const code = typeof domainProfile === 'string' ? domainProfile : domainProfile.code;
  const known: DomainCode[] = [
    'banking_fintech',
    'healthcare',
    'ports_logistics',
    'retail_food',
    'retail_general',
    'saas_technology',
    'general',
  ];
  return known.includes(code as DomainCode) ? (code as DomainCode) : 'general';
}

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
export function inferSkillsFromCategory(category: string, domainProfile?: DomainProfile | string): string[] {
  const normalized = category.toLowerCase().replace(/[^a-z_]/g, '');
  const domainCode = normalizeDomainCode(domainProfile);
  const domainOverrides = DOMAIN_CATEGORY_SKILLS[domainCode] || {};
  const baseSkills = domainOverrides[normalized] || CATEGORY_SKILLS[normalized] || ['general management'];
  const forbiddenTerms = DOMAIN_FORBIDDEN_TERMS[domainCode] || [];

  return baseSkills.filter((skill) =>
    !forbiddenTerms.some((term) => skill.toLowerCase().includes(term.toLowerCase()))
  );
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

    // If all cached, return immediately (but still run validation for quality)
    if (uncachedWorkstreams.length === 0) {
      console.log(`[RoleInference] All ${workstreams.length} workstreams found in cache`);

      // Still run validation on cached results
      let warnings: ValidationWarning[] = [];
      let finalOwners = cachedOwners;
      let validationRan = false;

      if (workstreams.length >= 3) {
        const validationResult = await this.comprehensiveValidation(
          cachedOwners,
          workstreams,
          businessContext,
          effectiveMaxRoles
        );
        if (validationResult) {
          validationRan = true;
          warnings = validationResult.warnings;
          if (validationResult.correctedOwners) {
            finalOwners = validationResult.correctedOwners;
          }
        }
      }

      return {
        owners: finalOwners,
        warnings,
        usedCache: true,
        usedFallback: false,
        validationRan,
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
- Domain profile: ${businessContext.domainProfile?.industryLabel || 'general'}
- Preferred lexicon: ${(businessContext.domainProfile?.preferredLexicon || []).slice(0, 6).join(', ') || 'none'}
- Forbidden lexicon: ${(businessContext.domainProfile?.forbiddenLexicon || []).slice(0, 6).join(', ') || 'none'}

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

      // Check for role count
      const uniqueRoles = new Set(allOwners.map(o => o.roleTitle));
      console.log(`[RoleInference] Initial unique roles: ${uniqueRoles.size} (target: ${effectiveMaxRoles})`);

      // COMPREHENSIVE VALIDATION PASS - Always run for 3+ workstreams
      let warnings: ValidationWarning[] = [];
      let validationRan = false;

      if (workstreams.length >= 3) {
        console.log(`[RoleInference] 🔍 Running comprehensive validation...`);
        const validationResult = await this.comprehensiveValidation(
          allOwners,
          workstreams,
          businessContext,
          effectiveMaxRoles
        );

        if (validationResult) {
          validationRan = true;
          warnings = validationResult.warnings;

          // Apply corrections if any
          if (validationResult.correctedOwners) {
            allOwners = validationResult.correctedOwners;
            const newUniqueRoles = new Set(allOwners.map(o => o.roleTitle));
            console.log(`[RoleInference] ✓ Validation corrected to ${newUniqueRoles.size} unique roles`);
          }

          // Log warnings
          if (warnings.length > 0) {
            console.log(`[RoleInference] ⚠️ Validation warnings (${warnings.length}):`);
            warnings.forEach(w => console.log(`  - [${w.severity}] ${w.message}`));
          } else {
            console.log(`[RoleInference] ✓ Validation passed with no warnings`);
          }
        }
      }

      return {
        owners: allOwners,
        notes: response.notes,
        warnings,
        usedCache: cachedOwners.length > 0,
        usedFallback: false,
        validationRan,
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
      warnings: [{
        type: 'mismatch',
        severity: 'warning',
        message: 'LLM inference failed, using fallback heuristics',
        recommendation: 'Review owner assignments manually for accuracy',
      }],
      usedCache: false,
      usedFallback: true,
      validationRan: false,
    };
  }

  /**
   * Comprehensive validation pass - checks multiple quality dimensions
   * 1. Are workstreams properly matched to roles?
   * 2. Is the team size realistic for business scale?
   * 3. Are any roles over-consolidated (too many workstreams)?
   * 4. Are any key functions missing (marketing, compliance, HR)?
   */
  private async comprehensiveValidation(
    currentOwners: InferredOwner[],
    workstreams: Workstream[],
    businessContext: BusinessContext,
    targetMaxRoles: number
  ): Promise<{ correctedOwners: InferredOwner[] | null; warnings: ValidationWarning[] } | null> {
    try {
      // Build current assignment summary for review
      const assignmentSummary = currentOwners.map(o => {
        const ws = workstreams.find(w => w.id === o.workstreamId);
        return `- "${ws?.name || o.workstreamId}" → ${o.roleTitle} (category: ${o.category})`;
      }).join('\n');

      // Count role distribution
      const roleCounts: Record<string, number> = {};
      currentOwners.forEach(o => {
        roleCounts[o.roleTitle] = (roleCounts[o.roleTitle] || 0) + 1;
      });
      const distribution = Object.entries(roleCounts)
        .map(([role, count]) => `${role}: ${count} workstreams`)
        .join(', ');

      // Get unique categories covered
      const categoriesCovered = [...new Set(currentOwners.map(o => o.category))];

      const prompt = `You are a COO reviewing staffing assignments for a new ${businessContext.businessType || 'business'} launch.

BUSINESS CONTEXT:
- Industry: ${businessContext.industry || 'Not specified'}
- Business type: ${businessContext.businessType || 'Not specified'}
- Geography: ${businessContext.geography || 'Not specified'}
- Initiative: ${businessContext.initiativeType || 'market_entry'}
- Total workstreams: ${workstreams.length}
- Target team size: ${targetMaxRoles} roles max
- Domain profile: ${businessContext.domainProfile?.industryLabel || 'general'}
- Forbidden lexicon: ${(businessContext.domainProfile?.forbiddenLexicon || []).slice(0, 8).join(', ') || 'none'}

CURRENT ASSIGNMENTS:
${assignmentSummary}

ROLE DISTRIBUTION: ${distribution}
CATEGORIES COVERED: ${categoriesCovered.join(', ')}

REVIEW THESE QUALITY DIMENSIONS:

1. ROLE-WORKSTREAM MATCH: Does each workstream have the right specialist?
   - Technology/Digital/POS workstream should have Technology Lead, NOT Operations Manager
   - HR/Training workstream should have HR Coordinator, NOT Operations Manager
   - Marketing/Community workstream should have Marketing Manager, NOT Operations Manager

2. TEAM SIZE REALISM: Is ${Object.keys(roleCounts).length} unique roles realistic for a ${businessContext.businessType || 'small business'}?
   - Small cafe/restaurant: 4-6 roles is typical
   - Tech startup: 5-8 roles is typical
   - Enterprise: 8-12 roles is typical

3. OVER-CONSOLIDATION: Is any single role assigned to 3+ very different workstreams?
   - OK: Operations Manager owns 2 operational workstreams
   - NOT OK: Operations Manager owns Construction, Marketing, AND Technology workstreams

4. MISSING FUNCTIONS: For this business type, are any critical functions missing?
   - Cafe/Restaurant typically needs: Operations, Construction/Design, Compliance, Marketing, HR/Training
   - Tech typically needs: Engineering, Product, Marketing, Operations, Compliance

Return ONLY valid JSON:
{
  "assessment": {
    "role_match_score": 0.8,
    "team_size_appropriate": true,
    "over_consolidation_detected": false,
    "missing_functions": []
  },
  "corrections": [
    {
      "workstream_id": "WS001",
      "old_role": "Operations Manager",
      "new_role": "Digital Systems Lead",
      "category": "technology",
      "reason": "POS integration is technology work, not general operations"
    }
  ],
  "warnings": [
    {
      "type": "over_consolidation",
      "severity": "warning",
      "message": "Operations Manager is assigned to 4 different workstreams",
      "recommendation": "Consider splitting into specialized roles",
      "workstream_id": null
    }
  ],
  "notes": "Summary of validation findings"
}`;

      const response = await this.llm.generateStructuredResponse(prompt, {
        assessment: {},
        corrections: [],
        warnings: [],
      });

      if (!response) {
        console.log('[RoleInference] Validation returned empty response');
        return null;
      }

      // Process warnings
      const warnings: ValidationWarning[] = (response.warnings || []).map((w: any) => ({
        type: w.type || 'mismatch',
        severity: w.severity || 'warning',
        message: w.message || 'Validation issue detected',
        recommendation: w.recommendation || 'Review assignments',
        workstreamId: w.workstream_id || undefined,
      }));

      // Add assessment-based warnings
      if (response.assessment?.missing_functions?.length > 0) {
        warnings.push({
          type: 'missing_function',
          severity: 'warning',
          message: `Missing key functions: ${response.assessment.missing_functions.join(', ')}`,
          recommendation: 'Consider adding roles for these functions',
        });
      }

      if (response.assessment?.over_consolidation_detected) {
        warnings.push({
          type: 'over_consolidation',
          severity: 'warning',
          message: 'Some roles are overloaded with too many different workstreams',
          recommendation: 'Review the corrections below to rebalance',
        });
      }

      if (response.assessment?.team_size_appropriate === false) {
        warnings.push({
          type: 'team_size',
          severity: 'info',
          message: `Team size may not be optimal for ${businessContext.businessType || 'this business type'}`,
          recommendation: 'Consider adjusting team structure based on business scale',
        });
      }

      // Apply corrections if any
      let correctedOwners: InferredOwner[] | null = null;

      if (response.corrections && Array.isArray(response.corrections) && response.corrections.length > 0) {
        console.log(`[RoleInference] Validation suggested ${response.corrections.length} corrections:`);

        correctedOwners = currentOwners.map(owner => {
          const correction = response.corrections.find((c: any) => c.workstream_id === owner.workstreamId);
          if (correction) {
            console.log(`  - ${owner.workstreamId}: "${owner.roleTitle}" → "${correction.new_role}" (${correction.reason})`);
            return {
              ...owner,
              roleTitle: normalizeRole(correction.new_role),
              category: correction.category || owner.category,
              rationale: `Validated: ${correction.reason}`,
              confidence: 0.9,
            };
          }
          return owner;
        });
      }

      if (response.notes) {
        console.log(`[RoleInference] Validation notes: ${response.notes}`);
      }

      return { correctedOwners, warnings };

    } catch (error) {
      console.error('[RoleInference] Comprehensive validation failed:', error);
      return null;
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
  category: string,
  domainProfile?: DomainProfile
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
      skills: inferSkillsFromCategory(category, domainProfile),
      justification: `Added by LLM role inference for ${category} workstreams`,
    });
  }
}

export default RoleInferenceService;
