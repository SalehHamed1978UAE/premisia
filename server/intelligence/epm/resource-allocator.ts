/**
 * ResourceAllocator - Handles resource planning and team generation
 * 
 * Uses LLM for context-aware role generation with fallback templates.
 */

import type { StrategyInsights, StrategyInsight, Workstream, ResourcePlan, ResourceAllocation, ExternalResource, StrategyContext, BusinessCategory } from '../types';
import type { UserContext } from '../types';
import { aiClients } from '../../ai-clients';
import { normalizeResourceFTEs } from '../normalizers/fte-normalizer';
import { ROLE_TEMPLATES, selectRoles, inferSubcategory } from './role-templates';

export class ResourceAllocator {
  /**
   * Generate resource plan with internal team and external resources
   *
   * SPRINT 6B - CONSTRAINT-FIRST ARCHITECTURE:
   * This allocator NO LONGER computes maxAffordableFTEs internally.
   * It receives estimatedFTEs from the upstream CapacityEnvelope.
   *
   * CONTEXT-AWARE ROLE SELECTION:
   * 1. If strategyContext is provided, use ROLE_TEMPLATES (cafe → cafe roles, restaurant → restaurant roles)
   * 2. Fallback to LLM generation if no context
   * 3. Final fallback to initiative-type templates
   */
  async allocate(
    insights: StrategyInsights,
    workstreams: Workstream[],
    userContext?: UserContext,
    initiativeType?: string,
    strategyContext?: StrategyContext
  ): Promise<ResourcePlan> {
    const resourceInsights = insights.insights.filter(i => i.type === 'resource');

    // SPRINT 6B: Use capacityEnvelope's maxAffordableFTEs (computed upstream)
    const uncappedFTEs = Math.max(4, Math.min(workstreams.length * 2, 20));
    const capacityEnvelope = (userContext as any)?.capacityEnvelope;

    let estimatedFTEs: number;
    if (capacityEnvelope) {
      // Use pre-computed capacity from envelope
      estimatedFTEs = capacityEnvelope.maxAffordableFTEs;
      console.log(`[ResourceAllocator] SPRINT 6B - Using CapacityEnvelope:`);
      console.log(`  Uncapped FTEs: ${uncappedFTEs}`);
      console.log(`  Max affordable FTEs: ${estimatedFTEs} (from envelope)`);
      console.log(`  Budget-constrained: ${capacityEnvelope.budgetConstrained ? 'YES' : 'NO'}`);
    } else {
      // Fallback to uncapped FTEs if no envelope (shouldn't happen in Sprint 6B)
      estimatedFTEs = uncappedFTEs;
      console.warn(`[ResourceAllocator] ⚠️ No CapacityEnvelope provided - using uncapped FTEs: ${estimatedFTEs}`);
    }

    const finalInitiativeType = initiativeType || 'other';
    console.log('[ResourceAllocator] 🎯 Resource allocation context:');
    console.log(`  Initiative type: ${finalInitiativeType}`);
    console.log(`  Strategy context: ${strategyContext ? `${strategyContext.businessType.category}/${strategyContext.businessType.subcategory || 'default'}` : 'NOT PROVIDED'}`);

    let internalTeam: ResourceAllocation[];

    // PRIORITY 1: Use context-aware ROLE_TEMPLATES if StrategyContext is available
    if (strategyContext) {
      console.log('[ResourceAllocator] ✅ Using context-aware ROLE_TEMPLATES');
      internalTeam = this.getRolesFromContext(strategyContext, workstreams);
    } else {
      // PRIORITY 2: Fall back to LLM/template generation
      console.log('[ResourceAllocator] ⚠️ No StrategyContext, falling back to LLM/templates');
      internalTeam = await this.generateInternalTeam(
        estimatedFTEs,
        workstreams,
        resourceInsights,
        finalInitiativeType,
        insights
      );
    }

    // SPRINT 6B FIX #1: Use envelope's externalResources if available (math consistency)
    const externalResources = capacityEnvelope?.externalResources || this.generateExternalResources(insights, userContext);
    const criticalSkills = Array.from(new Set(internalTeam.flatMap(r => r.skills)));

    // Calculate actual FTEs from generated roles (not formula estimate)
    let actualFTEs = internalTeam.reduce((sum, r) => sum + (r.allocation || 1), 0);
    let totalFTEs = Math.ceil(actualFTEs);

    // SPRINT 6B FIX #2: ENFORCE capacity envelope (not just warn)
    if (capacityEnvelope && totalFTEs > capacityEnvelope.maxAffordableFTEs) {
      console.error(
        `[ResourceAllocator] ❌ ENVELOPE VIOLATION: Generated ${totalFTEs} FTEs but envelope allows ${capacityEnvelope.maxAffordableFTEs}. ` +
        `Scaling allocations to fit budget constraint.`
      );

      // Scale allocations proportionally to fit within envelope
      internalTeam = this.enforceEnvelopeByScalingAllocations(
        internalTeam,
        capacityEnvelope.maxAffordableFTEs,
        totalFTEs
      );

      // Recompute after scaling
      actualFTEs = internalTeam.reduce((sum, r) => sum + (r.allocation || 1), 0);
      totalFTEs = Math.ceil(actualFTEs);

      console.log(`[ResourceAllocator] ✅ After scaling: ${totalFTEs} FTEs (target: ${capacityEnvelope.maxAffordableFTEs})`);
    }

    // ASSERT: totalFTEs MUST be <= envelope (fail-fast in dev/CI)
    if (capacityEnvelope && totalFTEs > capacityEnvelope.maxAffordableFTEs) {
      throw new Error(
        `[ResourceAllocator] INVARIANT VIOLATED: totalFTEs=${totalFTEs} > maxAffordableFTEs=${capacityEnvelope.maxAffordableFTEs}. ` +
        `Scaling logic failed to enforce envelope.`
      );
    }

    // SPRINT 6B: Budget constraint gap warning (using envelope data)
    let budgetConstrained: ResourcePlan['budgetConstrained'];
    if (capacityEnvelope?.budgetConstrained) {
      budgetConstrained = {
        optimalFTEs: uncappedFTEs,
        budgetFTEs: estimatedFTEs,
        gap: uncappedFTEs - estimatedFTEs,
        warning: `Team sized to ${estimatedFTEs} FTEs to fit $${(capacityEnvelope.maxBudget / 1e6).toFixed(1)}M budget. Optimal staffing is ${uncappedFTEs} FTEs. Consider increasing budget or reducing scope.`,
      };
      console.log(`[ResourceAllocator] ⚠️ Budget constrained (from envelope): ${JSON.stringify(budgetConstrained)}`);
    }

    return {
      internalTeam,
      externalResources,
      criticalSkills,
      totalFTEs,
      confidence: strategyContext ? 0.85 : (resourceInsights.length > 0 ? 0.70 : 0.60),
      budgetConstrained,
    };
  }

  /**
   * Initiative-aware internal team generation
   */
  private async generateInternalTeam(
    estimatedFTEs: number, 
    workstreams: Workstream[], 
    resourceInsights: StrategyInsight[],
    initiativeType: string,
    insights: StrategyInsights
  ): Promise<ResourceAllocation[]> {
    console.log(`[ResourceAllocator] 🎯 Generating team for initiative type: ${initiativeType}`);
    
    try {
      const llmRoles = await this.generateRolesWithLLM(
        initiativeType,
        estimatedFTEs,
        workstreams,
        insights
      );
      
      if (llmRoles && llmRoles.length > 0) {
        console.log(`[ResourceAllocator] ✅ LLM generated ${llmRoles.length} initiative-appropriate roles`);
        return llmRoles;
      }
      
      console.warn('[ResourceAllocator] ⚠️ LLM returned empty roles, falling back to templates');
    } catch (error) {
      console.error('[ResourceAllocator] ⚠️ LLM generation failed, using fallback templates:', error);
      console.error('[ResourceAllocator] Error details:', error instanceof Error ? error.message : String(error));
    }
    
    console.log(`[ResourceAllocator] 📋 Using fallback template for ${initiativeType}`);
    console.log('[ResourceAllocator] ⚠️ NOTE: Fallback roles are generic - LLM should be fixed to provide context-appropriate roles');
    return this.getFallbackRoles(initiativeType, estimatedFTEs, workstreams);
  }
  
  /**
   * Generate roles using LLM for context-aware team composition
   */
  private async generateRolesWithLLM(
    initiativeType: string,
    estimatedFTEs: number,
    workstreams: Workstream[],
    insights: StrategyInsights
  ): Promise<ResourceAllocation[]> {
    const workstreamSummary = workstreams.map(w => `- ${w.name} (${w.deliverables.length} deliverables)`).join('\n');
    const timeline = workstreams[0]?.endMonth || 12;
    
    const businessDescription = insights.insights
      .find(i => i.type === 'other' || i.content.includes('business') || i.content.includes('initiative'))
      ?.content.substring(0, 200)?.trim() || 'a new business initiative';
    
    console.log(`[ResourceAllocator] Business context: "${businessDescription.substring(0, 100)}..."`);
    console.log(`[ResourceAllocator] Initiative type: ${initiativeType}`);
    
    const prompt = `Generate an internal team structure for this initiative.

BUSINESS DESCRIPTION: ${businessDescription}
INITIATIVE TYPE: ${initiativeType}
WORKSTREAMS (${workstreams.length}):
${workstreamSummary}

PROJECT TIMELINE: ${timeline} months
ESTIMATED TEAM SIZE: ${estimatedFTEs} FTEs

Generate ${Math.min(6, estimatedFTEs)} key roles that are APPROPRIATE for this specific business and initiative type.

CRITICAL: Match roles to the ACTUAL BUSINESS described above, not generic templates:
- For physical retail/food businesses: Store Manager, Barista, Server, Chef, Sales Associate, etc.
- For educational/training facilities: Director of Education, Lead Instructor, Curriculum Developer, Student Advisor, etc.
- For software development: Software Engineer, DevOps Engineer, QA Engineer, Product Manager, UX Designer, etc.
- For digital transformation: Digital Strategy Lead, Change Manager, Integration Specialist, Training Coordinator, etc.
- For market expansion: Market Research Analyst, Regional Manager, Business Development, Localization Specialist, etc.
- For product launch: Product Manager, Marketing Manager, Supply Chain Coordinator, Sales Enablement, etc.
- For service launch: Service Designer, Operations Manager, Training Specialist, Customer Success Manager, etc.

For each role, provide:
- role: Job title (MUST match the actual business - e.g., "Lead AI Tutor" for tutoring center, NOT "Barista")
- allocation: % time (50-100)
- months: Duration on project (1-${timeline})
- skills: Array of 3-5 relevant skills
- justification: Why this role is needed

Return ONLY valid JSON array of role objects. NO markdown, NO code blocks, ONLY the JSON array.`;

    const response = await aiClients.callWithFallback({
      systemPrompt: 'You are an HR and resource planning expert. Generate ONLY valid JSON matching the requested format. NO markdown code blocks. The roles MUST match the specific business being described.',
      userMessage: prompt,
      maxTokens: 2000,
    });
    
    const content = response.content;
    
    try {
      const roles = JSON.parse(content);
      if (Array.isArray(roles) && roles.length > 0) {
        console.log(`[ResourceAllocator] ✅ Successfully generated ${roles.length} context-appropriate roles`);
        
        // Normalize FTE allocation values from percentages (50-100) to decimals (0.5-1.0)
        const mappedForNormalization = roles.map((r: any) => ({
          role: r.role,
          fteAllocation: r.allocation,
          ...r
        }));
        const { normalized, fixes } = normalizeResourceFTEs(mappedForNormalization);
        if (fixes.length > 0) {
          console.log('[ResourceAllocator] FTE normalization fixes:', fixes);
        }

        // FILTER: Remove domain-contaminated skills based on initiative type
        const filteredRoles = normalized.map((r: any) => ({
          ...r,
          skills: this.filterDomainContamination(r.skills, initiativeType)
        }));

        // Map back to original structure with normalized allocation and filtered skills
        const normalizedRoles = filteredRoles.map((r: any) => ({
          role: r.role,
          allocation: r.fteAllocation,
          months: r.months,
          skills: r.skills,
          justification: r.justification
        }));

        return normalizedRoles;
      }
    } catch (parseError) {
      console.error('[ResourceAllocator] Failed to parse LLM response:', parseError);
      console.error('[ResourceAllocator] Raw response:', content);
    }
    
    return [];
  }
  
  /**
   * Get roles from context-aware ROLE_TEMPLATES when StrategyContext is available
   * This is the PREFERRED method as it provides business-appropriate roles
   */
  getRolesFromContext(
    context: StrategyContext,
    workstreams: Workstream[]
  ): ResourceAllocation[] {
    const timeline = workstreams[0]?.endMonth || 12;
    const justification = `Required for ${workstreams.length} workstreams across ${timeline} months`;

    // Ensure subcategory is populated
    if (!context.businessType.subcategory) {
      context.businessType.subcategory = inferSubcategory(context);
    }

    const roleTemplates = selectRoles(context);
    console.log(`[ResourceAllocator] Using ROLE_TEMPLATES for ${context.businessType.category}/${context.businessType.subcategory || 'default'}`);

    return roleTemplates.map(template => ({
      role: template.role,
      allocation: template.fte,
      months: Math.ceil(timeline * template.fte), // Scale months by FTE
      skills: template.skills,
      justification: template.responsibilities?.join('; ') || justification,
    }));
  }

  /**
   * Fallback role templates for each initiative type
   * Used when StrategyContext is not available
   */
  private getFallbackRoles(
    initiativeType: string,
    estimatedFTEs: number,
    workstreams: Workstream[]
  ): ResourceAllocation[] {
    const timeline = workstreams[0]?.endMonth || 12;
    const justification = `Required for ${workstreams.length} workstreams across ${timeline} months`;

    // Try to map initiative type to business category for better fallback
    const initiativeToCategoryMap: Record<string, BusinessCategory> = {
      'physical_business_launch': 'retail_general',
      'retail_launch': 'retail_specialty',
      'cafe_launch': 'food_beverage',
      'restaurant_launch': 'food_beverage',
      'software_development': 'saas_platform',
      'digital_transformation': 'saas_platform',
      'market_expansion': 'retail_general',
      'ecommerce': 'ecommerce',
      'professional_services': 'professional_services',
    };

    const category = initiativeToCategoryMap[initiativeType];
    if (category && ROLE_TEMPLATES[category]?.default) {
      console.log(`[ResourceAllocator] Using ROLE_TEMPLATES fallback for category: ${category}`);
      const templates = ROLE_TEMPLATES[category].default;
      return templates.map(t => ({
        role: t.role,
        allocation: t.fte,
        months: Math.ceil(timeline * t.fte),
        skills: t.skills,
        justification,
      }));
    }
    
    const templates: Record<string, ResourceAllocation[]> = {
      physical_business_launch: [
        { role: 'Operations Manager', allocation: 1.0, months: timeline, skills: ['Business operations', 'Team leadership', 'Resource management'], justification },
        { role: 'Program Manager', allocation: 1.0, months: timeline, skills: ['Program planning', 'Stakeholder management', 'Project coordination'], justification },
        { role: 'Operations Coordinator', allocation: 0.75, months: Math.floor(timeline * 0.8), skills: ['Logistics', 'Vendor management', 'Process optimization'], justification },
        { role: 'Business Development Lead', allocation: 0.75, months: Math.floor(timeline * 0.7), skills: ['Strategy', 'Partnership development', 'Market analysis'], justification },
        { role: 'Marketing Coordinator', allocation: 0.5, months: Math.floor(timeline * 0.5), skills: ['Local marketing', 'Social media', 'Community engagement'], justification },
      ],
      
      software_development: [
        { role: 'Product Manager', allocation: 1.0, months: timeline, skills: ['Product strategy', 'Roadmap planning', 'Stakeholder management'], justification },
        { role: 'Tech Lead/Architect', allocation: 1.0, months: timeline, skills: ['System architecture', 'Technical leadership', 'Code review'], justification },
        { role: 'Software Engineer', allocation: 1.0, months: timeline, skills: ['Full-stack development', 'API design', 'Database design'], justification },
        { role: 'DevOps Engineer', allocation: 0.75, months: Math.floor(timeline * 0.8), skills: ['CI/CD', 'Infrastructure', 'Deployment automation'], justification },
        { role: 'QA Engineer', allocation: 0.75, months: Math.floor(timeline * 0.7), skills: ['Test automation', 'Quality assurance', 'Bug tracking'], justification },
        { role: 'UX/UI Designer', allocation: 0.5, months: Math.floor(timeline * 0.6), skills: ['User research', 'Interface design', 'Prototyping'], justification },
      ],
      
      digital_transformation: [
        { role: 'Digital Transformation Lead', allocation: 1.0, months: timeline, skills: ['Change leadership', 'Digital strategy', 'Stakeholder alignment'], justification },
        { role: 'Business Process Analyst', allocation: 1.0, months: timeline, skills: ['Process mapping', 'Gap analysis', 'Requirements gathering'], justification },
        { role: 'Integration Specialist', allocation: 1.0, months: Math.floor(timeline * 0.8), skills: ['Systems integration', 'API development', 'Data migration'], justification },
        { role: 'Change Manager', allocation: 0.75, months: timeline, skills: ['Change management', 'Training delivery', 'Communication'], justification },
        { role: 'Technical Consultant', allocation: 0.75, months: Math.floor(timeline * 0.7), skills: ['Platform implementation', 'Configuration', 'Technical training'], justification },
      ],
      
      market_expansion: [
        { role: 'Market Expansion Lead', allocation: 1.0, months: timeline, skills: ['Market entry strategy', 'Partnership development', 'Regional planning'], justification },
        { role: 'Market Research Analyst', allocation: 1.0, months: Math.floor(timeline * 0.6), skills: ['Market analysis', 'Competitive research', 'Customer insights'], justification },
        { role: 'Regional Manager', allocation: 1.0, months: Math.floor(timeline * 0.8), skills: ['Regional operations', 'Team building', 'Local execution'], justification },
        { role: 'Business Development Manager', allocation: 0.75, months: timeline, skills: ['Partnership development', 'Sales strategy', 'Relationship management'], justification },
        { role: 'Localization Specialist', allocation: 0.5, months: Math.floor(timeline * 0.5), skills: ['Cultural adaptation', 'Translation', 'Local compliance'], justification },
      ],
      
      product_launch: [
        { role: 'Product Launch Manager', allocation: 1.0, months: timeline, skills: ['Launch planning', 'Cross-functional coordination', 'Go-to-market'], justification },
        { role: 'Product Marketing Manager', allocation: 1.0, months: Math.floor(timeline * 0.8), skills: ['Positioning', 'Messaging', 'Campaign management'], justification },
        { role: 'Supply Chain Coordinator', allocation: 0.75, months: Math.floor(timeline * 0.7), skills: ['Inventory planning', 'Vendor management', 'Logistics'], justification },
        { role: 'Sales Enablement Specialist', allocation: 0.75, months: Math.floor(timeline * 0.6), skills: ['Sales training', 'Collateral development', 'Channel support'], justification },
        { role: 'Customer Success Manager', allocation: 0.5, months: Math.floor(timeline * 0.5), skills: ['Customer onboarding', 'Support', 'Feedback collection'], justification },
      ],
      
      service_launch: [
        { role: 'Service Design Lead', allocation: 1.0, months: timeline, skills: ['Service design', 'Process definition', 'Quality standards'], justification },
        { role: 'Operations Manager', allocation: 1.0, months: timeline, skills: ['Service delivery', 'Resource allocation', 'Performance management'], justification },
        { role: 'Training Specialist', allocation: 0.75, months: Math.floor(timeline * 0.7), skills: ['Training program design', 'Delivery', 'Certification'], justification },
        { role: 'Service Coordinator', allocation: 0.75, months: Math.floor(timeline * 0.8), skills: ['Scheduling', 'Client communication', 'Service tracking'], justification },
        { role: 'Quality Assurance Manager', allocation: 0.5, months: Math.floor(timeline * 0.6), skills: ['Quality monitoring', 'Process improvement', 'Auditing'], justification },
      ],
      
      process_improvement: [
        { role: 'Process Improvement Lead', allocation: 1.0, months: timeline, skills: ['Lean Six Sigma', 'Process mapping', 'Change leadership'], justification },
        { role: 'Business Analyst', allocation: 1.0, months: timeline, skills: ['Requirements analysis', 'Data analysis', 'Process documentation'], justification },
        { role: 'Operations Analyst', allocation: 0.75, months: Math.floor(timeline * 0.8), skills: ['Metrics analysis', 'Bottleneck identification', 'Efficiency optimization'], justification },
        { role: 'Change Manager', allocation: 0.75, months: Math.floor(timeline * 0.7), skills: ['Stakeholder engagement', 'Training', 'Adoption tracking'], justification },
        { role: 'Process Automation Specialist', allocation: 0.5, months: Math.floor(timeline * 0.6), skills: ['RPA', 'Workflow automation', 'Tool implementation'], justification },
      ],
      
      other: [
        { role: 'Program Manager', allocation: 1.0, months: timeline, skills: ['Program management', 'Stakeholder management', 'Risk management'], justification },
        { role: 'Business Analyst', allocation: 1.0, months: Math.floor(timeline * 0.8), skills: ['Requirements analysis', 'Process mapping', 'Documentation'], justification },
        { role: 'Project Coordinator', allocation: 0.75, months: timeline, skills: ['Coordination', 'Tracking', 'Communication'], justification },
        { role: 'Subject Matter Expert', allocation: 0.75, months: Math.floor(timeline * 0.7), skills: ['Domain expertise', 'Advisory', 'Validation'], justification },
        { role: 'Change Manager', allocation: 0.5, months: Math.floor(timeline * 0.6), skills: ['Change management', 'Training', 'Support'], justification },
      ],
    };
    
    const roles = templates[initiativeType] || templates.other;
    return roles.slice(0, Math.min(estimatedFTEs, roles.length));
  }

  /**
   * Filter out domain-contaminated skills that don't belong in this initiative type
   *
   * PREVENTS: Physical business terminology (POS, food safety) appearing in SaaS/tech roles
   * PREVENTS: SaaS terminology (API, DevOps) appearing in physical business roles
   *
   * FIXES: Issue #2 from ZIP analysis - Domain contamination ("POS systems" in AI roles,
   * "food safety" in SaaS Compliance Officer)
   */
  private filterDomainContamination(skills: string[], initiativeType: string): string[] {
    if (!skills || !Array.isArray(skills)) return [];

    // Define domain-specific vocabulary blacklists
    const PHYSICAL_BUSINESS_TERMS = [
      'POS systems', 'POS', 'point of sale',
      'food safety', 'food', 'beverage', 'kitchen', 'culinary',
      'barista', 'server', 'chef', 'cooking',
      'health permits', 'health inspections', 'HACCP',
      'store', 'retail', 'cashier', 'merchandising',
      'inventory control', 'stockroom',
      'restaurant', 'cafe', 'catering',
      'supply chain', 'logistics',
      'licensing', 'permits'
    ];

    const TECH_SAAS_TERMS = [
      'API', 'API design', 'REST', 'GraphQL',
      'DevOps', 'CI/CD', 'Docker', 'Kubernetes',
      'frontend', 'backend', 'full-stack',
      'React', 'Vue', 'Angular', 'TypeScript',
      'database design', 'SQL', 'NoSQL',
      'cloud infrastructure', 'AWS', 'Azure', 'GCP',
      'microservices', 'serverless'
    ];

    // Map initiative types to blacklisted terms
    const blacklistMap: Record<string, string[]> = {
      'software_development': PHYSICAL_BUSINESS_TERMS,
      'digital_transformation': PHYSICAL_BUSINESS_TERMS,
      'saas_platform': PHYSICAL_BUSINESS_TERMS,
      'tech_startup': PHYSICAL_BUSINESS_TERMS,

      'physical_business_launch': TECH_SAAS_TERMS,
      'retail_launch': TECH_SAAS_TERMS,
      'cafe_launch': TECH_SAAS_TERMS,
      'restaurant_launch': TECH_SAAS_TERMS,
      'food_service': TECH_SAAS_TERMS,
    };

    const blacklist = blacklistMap[initiativeType];
    if (!blacklist) {
      // No specific filtering for this initiative type
      return skills;
    }

    // Filter out contaminated skills (case-insensitive partial match)
    const filtered = skills.filter(skill => {
      const skillLower = skill.toLowerCase();
      const isContaminated = blacklist.some(term =>
        skillLower.includes(term.toLowerCase())
      );

      if (isContaminated) {
        console.warn(`[ResourceAllocator] 🚫 Filtered domain-contaminated skill: "${skill}" (initiative: ${initiativeType})`);
      }

      return !isContaminated;
    });

    // If we filtered out all skills, keep at least one generic skill
    if (filtered.length === 0 && skills.length > 0) {
      console.warn(`[ResourceAllocator] ⚠️  All skills were contaminated, using generic fallback`);
      return ['General domain expertise'];
    }

    return filtered;
  }

  /**
   * SPRINT 6B FIX #2: Enforce capacity envelope by scaling allocations
   *
   * Strategy: Proportional scaling with floor (preserves role mix, systematic)
   *
   * HARDENING: Explicit minimum viable team guard
   * - If trimming results in sub-minimum viable team, throws (HARD_CAP mode)
   * - MIN_VIABLE_TEAM_FTE derived from domain policy (4 roles minimum)
   *
   * @param team - Generated roles (may exceed envelope)
   * @param maxAffordableFTEs - Envelope limit (authoritative)
   * @param currentTotalFTEs - Current total before scaling
   * @returns Scaled team that fits within envelope
   */
  private enforceEnvelopeByScalingAllocations(
    team: ResourceAllocation[],
    maxAffordableFTEs: number,
    currentTotalFTEs: number
  ): ResourceAllocation[] {
    const MIN_ROLE_FTE = 0.25; // Minimum allocation to keep role viable
    const MIN_VIABLE_TEAM_FTE = 1.0; // 4 roles at 0.25 FTE each (domain policy)
    const scaleFactor = maxAffordableFTEs / currentTotalFTEs;

    console.log(`[ResourceAllocator] Scaling allocations by ${(scaleFactor * 100).toFixed(1)}%`);

    const scaled = team.map(role => {
      const originalAllocation = role.allocation || 1.0;
      const scaledAllocation = originalAllocation * scaleFactor;

      // Round to nearest quarter (0.25, 0.5, 0.75, 1.0, etc.)
      const roundedAllocation = Math.round(scaledAllocation * 4) / 4;

      // Apply floor to keep role viable
      const finalAllocation = Math.max(MIN_ROLE_FTE, roundedAllocation);

      if (originalAllocation !== finalAllocation) {
        console.log(
          `[ResourceAllocator]   ${role.role}: ${originalAllocation.toFixed(2)} → ${finalAllocation.toFixed(2)} FTE`
        );
      }

      return {
        ...role,
        allocation: finalAllocation,
        months: Math.ceil(role.months * (finalAllocation / originalAllocation)),
      };
    });

    // Verify we didn't overshoot due to rounding + floors
    const newTotal = scaled.reduce((sum, r) => sum + r.allocation, 0);
    if (newTotal > maxAffordableFTEs) {
      // Need second pass: trim smallest roles until we fit
      console.warn(
        `[ResourceAllocator] ⚠️ After rounding, total=${newTotal.toFixed(2)} still exceeds ${maxAffordableFTEs}. ` +
        `Trimming smallest roles.`
      );

      // Sort by allocation ascending, remove smallest until we fit
      const sorted = [...scaled].sort((a, b) => a.allocation - b.allocation);
      let trimmed = sorted;
      let runningTotal = newTotal;

      for (let i = 0; i < sorted.length && runningTotal > maxAffordableFTEs; i++) {
        runningTotal -= sorted[i].allocation;
        trimmed = sorted.slice(i + 1);
        console.log(`[ResourceAllocator]   Removed: ${sorted[i].role} (${sorted[i].allocation} FTE)`);
      }

      // HARDENING: Explicit minimum viable team guard (HARD_CAP mode)
      const trimmedTotal = trimmed.reduce((sum, r) => sum + r.allocation, 0);
      if (trimmedTotal < MIN_VIABLE_TEAM_FTE) {
        throw new Error(
          `[ResourceAllocator] Cannot fit minimum viable team within budget envelope. ` +
          `After trimming: ${trimmedTotal.toFixed(2)} FTE < minimum ${MIN_VIABLE_TEAM_FTE} FTE. ` +
          `Budget too low for viable program (${trimmed.length} roles remaining).`
        );
      }

      return trimmed;
    }

    return scaled;
  }

  /**
   * Generate external resources
   */
  generateExternalResources(insights: StrategyInsights, userContext?: UserContext): ExternalResource[] {
    const defaultBudget = userContext?.budgetRange?.max || 1000000;
    
    return [
      {
        type: 'Consultant' as const,
        description: 'Strategic advisory and specialized expertise',
        estimatedCost: Math.floor(defaultBudget * 0.15),
        timing: 'Months 0-3',
        justification: 'Domain expertise and methodology guidance',
      },
      {
        type: 'Software' as const,
        description: 'Project management and collaboration tools',
        estimatedCost: Math.floor(defaultBudget * 0.05),
        timing: 'Months 0-12',
        justification: 'Enable effective team collaboration and tracking',
      },
    ];
  }
}

export default ResourceAllocator;
