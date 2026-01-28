/**
 * ResourceAllocator - Handles resource planning and team generation
 * 
 * Uses LLM for context-aware role generation with fallback templates.
 */

import type { StrategyInsights, StrategyInsight, Workstream, ResourcePlan, ResourceAllocation, ExternalResource } from '../types';
import type { UserContext } from '../types';
import { aiClients } from '../../ai-clients';
import { normalizeResourceFTEs } from '../normalizers/fte-normalizer';

export class ResourceAllocator {
  /**
   * Generate resource plan with internal team and external resources
   */
  async allocate(
    insights: StrategyInsights,
    workstreams: Workstream[],
    userContext?: UserContext,
    initiativeType?: string
  ): Promise<ResourcePlan> {
    const resourceInsights = insights.insights.filter(i => i.type === 'resource');
    
    const estimatedFTEs = Math.max(8, Math.min(workstreams.length * 2, 20));
    
    const finalInitiativeType = initiativeType || 'other';
    console.log('[ResourceAllocator] 🎯 Initiative type source:');
    console.log(`  Passed parameter: ${initiativeType || 'UNDEFINED'}`);
    console.log(`  Final value used: ${finalInitiativeType}`);
    
    const internalTeam = await this.generateInternalTeam(
      estimatedFTEs, 
      workstreams, 
      resourceInsights,
      finalInitiativeType,
      insights
    );
    const externalResources = this.generateExternalResources(insights, userContext);
    const criticalSkills = Array.from(new Set(internalTeam.flatMap(r => r.skills)));

    return {
      internalTeam,
      externalResources,
      criticalSkills,
      totalFTEs: estimatedFTEs,
      confidence: resourceInsights.length > 0 ? 0.70 : 0.60,
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
        
        // Map back to original structure with normalized allocation
        const normalizedRoles = normalized.map((r: any) => ({
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
   * Fallback role templates for each initiative type
   */
  private getFallbackRoles(
    initiativeType: string,
    estimatedFTEs: number,
    workstreams: Workstream[]
  ): ResourceAllocation[] {
    const timeline = workstreams[0]?.endMonth || 12;
    const justification = `Required for ${workstreams.length} workstreams across ${timeline} months`;
    
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
