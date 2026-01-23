import { randomUUID as uuid } from 'crypto';
import { conversationPersistence, ConversationLog, BusinessContext } from './persistence/conversation-log';
import { agents, getAgent, getAllAgentIds } from './agents';
import { rounds, getRound, getTotalRounds, synthesisOutputSchema, conflictResolutionSchema } from './rounds';
import { buildAgentSystemPrompt, buildRoundPrompt, buildSynthesisPrompt, buildConflictResolutionPrompt } from './prompts/agent-prompts';
import { llmInterface } from './llm/interface';
import { epmAssembler, EPMProgram } from './assembly/epm-assembler';
import { replaceTimelineGeneration, ProgressCallback } from '../../../src/lib/intelligent-planning/epm-integration';
import { PlanningContext } from '../../../src/lib/intelligent-planning/types';

export interface ProgressUpdate {
  type: 'resume' | 'round_start' | 'round_complete' | 'agent_start' | 'agent_complete' | 'synthesis_start' | 'synthesis_complete' | 'conflict_resolution_start' | 'conflict_resolution_complete' | 'complete' | 'error';
  round?: number;
  name?: string;
  agent?: string;
  conflicts?: number;
  progress?: number;
  message?: string;
  error?: string;
  skipped?: boolean; // True when round was already completed (resume case)
}

export interface OrchestratorConfig {
  agentTimeoutMs?: number;
  maxRetries?: number;
  parallelAgents?: boolean;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  agentTimeoutMs: 90000,
  maxRetries: 2,
  parallelAgents: true,
};

export class MultiAgentOrchestrator {
  private config: OrchestratorConfig;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate an EPM program through multi-agent collaboration.
   * Session ID handling:
   * - If providedSessionId exists and is not completed, resume it
   * - If providedSessionId exists and is completed, return the cached result
   * - If providedSessionId doesn't exist, create a new session with that ID
   * - If no providedSessionId, generate a new session ID
   */
  async generate(
    userId: string,
    businessContext: BusinessContext,
    bmcInsights: any,
    journeySessionId?: string,
    onProgress?: (progress: ProgressUpdate) => void,
    providedSessionId?: string
  ): Promise<{ sessionId: string; program: EPMProgram }> {
    // Check if we should resume or return cached result for existing session
    if (providedSessionId) {
      const sessionStatus = await conversationPersistence.getSessionStatus(providedSessionId);
      if (sessionStatus.exists) {
        if (sessionStatus.status === 'completed') {
          console.log(`[Orchestrator] Session ${providedSessionId} already completed, returning cached result`);
          // Session is completed - return the cached program
          return this.resume(providedSessionId, onProgress);
        } else {
          console.log(`[Orchestrator] Session ${providedSessionId} exists with status ${sessionStatus.status}, resuming...`);
          return this.resume(providedSessionId, onProgress);
        }
      }
    }

    const sessionId = await conversationPersistence.createSession(
      userId,
      businessContext,
      bmcInsights,
      journeySessionId,
      providedSessionId
    );

    console.log(`[Orchestrator] Created session ${sessionId} for ${businessContext.name}`);

    await conversationPersistence.updateSessionStatus(sessionId, 'in_progress');

    try {
      const program = await this.executeSession(sessionId, businessContext, bmcInsights, onProgress);
      
      await conversationPersistence.updateSessionStatus(sessionId, 'completed', {
        finalProgram: program,
      });

      onProgress?.({ type: 'complete', progress: 100, message: 'EPM program generated successfully' });

      return { sessionId, program };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Orchestrator] Session ${sessionId} failed:`, errorMessage);
      
      await conversationPersistence.updateSessionStatus(sessionId, 'failed', {
        errorMessage,
      });

      onProgress?.({ type: 'error', error: errorMessage });
      throw error;
    }
  }

  async resume(
    sessionId: string,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<{ sessionId: string; program: EPMProgram }> {
    const data = await conversationPersistence.loadSession(sessionId);
    if (!data) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const { session } = data;
    const businessContext = session.businessContext as BusinessContext;
    const bmcInsights = session.bmcInsights;

    if (session.status === 'completed' && session.finalProgram) {
      return { sessionId, program: session.finalProgram as EPMProgram };
    }

    console.log(`[Orchestrator] Resuming session ${sessionId} from round ${session.currentRound}`);
    
    await conversationPersistence.updateSessionStatus(sessionId, 'in_progress');
    onProgress?.({ type: 'resume', round: session.currentRound });

    try {
      const program = await this.executeSession(sessionId, businessContext, bmcInsights, onProgress);
      
      await conversationPersistence.updateSessionStatus(sessionId, 'completed', {
        finalProgram: program,
      });

      onProgress?.({ type: 'complete', progress: 100, message: 'EPM program generated successfully' });

      return { sessionId, program };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await conversationPersistence.updateSessionStatus(sessionId, 'failed', {
        errorMessage,
      });
      onProgress?.({ type: 'error', error: errorMessage });
      throw error;
    }
  }

  private async executeSession(
    sessionId: string,
    businessContext: BusinessContext,
    bmcInsights: any,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<EPMProgram> {
    const totalRounds = getTotalRounds();

    for (const roundDef of rounds) {
      const resumePoint = await conversationPersistence.getResumePoint(
        sessionId,
        roundDef.participatingAgents.includes('all') ? getAllAgentIds() : roundDef.participatingAgents
      );

      if (roundDef.round < resumePoint.round) {
        console.log(`[Orchestrator] Skipping completed round ${roundDef.round}`);
        // Emit progress event for already-completed round so frontend knows it's done
        onProgress?.({
          type: 'round_complete',
          round: roundDef.round,
          name: roundDef.name,
          progress: Math.round((roundDef.round / totalRounds) * 100),
          message: `Round ${roundDef.round}/${totalRounds}: ${roundDef.name} (already completed)`,
          skipped: true,
        });
        continue;
      }

      const progress = Math.round(((roundDef.round - 1) / totalRounds) * 100);
      onProgress?.({
        type: 'round_start',
        round: roundDef.round,
        name: roundDef.name,
        progress,
        message: `Round ${roundDef.round}/${totalRounds}: ${roundDef.name}`,
      });

      await conversationPersistence.updateSessionStatus(sessionId, 'in_progress', {
        currentRound: roundDef.round,
      });

      // skipAgents should be true ONLY when resuming mid-round and all agents are already done
      // needsSynthesis = true means all agents completed, synthesis pending
      // If we're at a new round (resumePoint.round < roundDef.round), run fresh (skipAgents = false)
      const skipAgents = resumePoint.round === roundDef.round && resumePoint.needsSynthesis;
      
      await this.executeRound(
        sessionId,
        roundDef,
        businessContext,
        bmcInsights,
        resumePoint.round === roundDef.round ? resumePoint.agentsCompleted : [],
        skipAgents,
        onProgress
      );

      await conversationPersistence.updateSessionStatus(sessionId, 'in_progress', {
        lastCompletedRound: roundDef.round,
      });

      onProgress?.({
        type: 'round_complete',
        round: roundDef.round,
        name: roundDef.name,
        progress: Math.round((roundDef.round / totalRounds) * 100),
      });
    }

    const conversationLog = await conversationPersistence.loadConversation(sessionId);
    if (!conversationLog) {
      throw new Error('Failed to load conversation log for assembly');
    }

    // Step 1: Basic EPM assembly from agent outputs
    const basicProgram = epmAssembler.assemble(conversationLog, businessContext);
    
    // Step 2: Enhance with intelligent planning system
    const enhancedProgram = await this.applyIntelligentPlanning(basicProgram, businessContext, onProgress);
    
    return enhancedProgram;
  }
  
  /**
   * Apply intelligent planning to enhance the EPM program with proper
   * timelines, phases, milestones, stage gates, and other components
   */
  private async applyIntelligentPlanning(
    program: EPMProgram,
    businessContext: BusinessContext,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<EPMProgram> {
    console.log('[Orchestrator] Applying intelligent planning system...');
    
    // Build planning context from business context
    const planningContext: PlanningContext = {
      business: {
        name: businessContext.name,
        type: businessContext.type,
        description: businessContext.description || '',
        scale: this.inferBusinessScale(businessContext),
        industry: businessContext.type,
      },
      strategic: {
        insights: {},
        constraints: [],
        objectives: [],
      },
      execution: {
        timeline: {
          min: 3,
          max: Math.max(12, program.timeline?.totalMonths || 12),
        },
        budget: {
          min: program.financialPlan?.totalBudget * 0.8 || 100000,
          max: program.financialPlan?.totalBudget * 1.2 || 500000,
        },
      },
      meta: {
        journeyType: 'strategy_workspace',
        confidence: 0.75,
        version: '1.0',
      },
    };
    
    try {
      // Convert orchestrator progress callback to planning progress callback
      const planningProgress: ProgressCallback | undefined = onProgress ? (event) => {
        if (event.type === 'step-start' || event.type === 'step-complete') {
          onProgress({
            type: 'agent_complete',
            agent: event.step || 'planning',
            name: event.name || event.description,
            progress: event.progress,
          });
        }
      } : undefined;
      
      const result = await replaceTimelineGeneration(
        program,
        planningContext,
        {
          maxDuration: planningContext.execution.timeline.max,
          budget: program.financialPlan?.totalBudget || 200000,
        },
        planningProgress
      );
      
      if (result.success) {
        console.log(`[Orchestrator] Intelligent planning succeeded with ${result.confidence}% confidence`);
        
        // Apply enhanced data structures
        const enhancedProgram = result.program;
        
        // Ensure proper Governance structure
        enhancedProgram.governance = this.buildProperGovernance(enhancedProgram.governance, businessContext);
        
        // Ensure proper QA Plan structure
        enhancedProgram.qaPlan = this.buildProperQAPlan(enhancedProgram.qaPlan);
        
        // Ensure proper Stage Gates structure
        enhancedProgram.stageGates = this.buildProperStageGates(enhancedProgram.stageGates, enhancedProgram.timeline);
        
        // Ensure proper KPIs structure  
        enhancedProgram.kpis = this.buildProperKPIs(enhancedProgram.benefitsRealization);
        
        // Ensure proper Risk Register structure
        enhancedProgram.riskRegister = this.buildProperRiskRegister(enhancedProgram.riskRegister);
        
        return enhancedProgram;
      } else {
        console.warn('[Orchestrator] Intelligent planning failed, using basic program with enhanced structures');
        return this.enhanceBasicProgram(program, businessContext);
      }
    } catch (error) {
      console.error('[Orchestrator] Intelligent planning error:', error);
      return this.enhanceBasicProgram(program, businessContext);
    }
  }
  
  /**
   * Infer business scale from context - maps to intelligent planning BusinessScale type
   */
  private inferBusinessScale(businessContext: BusinessContext): 'smb' | 'mid_market' | 'enterprise' {
    const desc = (businessContext.description || '').toLowerCase();
    if (desc.includes('enterprise') || desc.includes('large') || desc.includes('corporation')) return 'enterprise';
    if (desc.includes('medium') || desc.includes('growing') || desc.includes('mid')) return 'mid_market';
    return 'smb';
  }
  
  /**
   * Build proper governance structure matching frontend types
   */
  private buildProperGovernance(existing: any, businessContext: BusinessContext): any {
    return {
      bodies: existing?.bodies || [
        {
          name: 'Steering Committee',
          level: 'Strategic',
          members: ['Executive Sponsor', 'Program Director', 'Finance Lead'],
          cadence: 'Monthly',
          responsibilities: ['Strategic direction', 'Budget approval', 'Risk oversight'],
          escalationPath: 'Board of Directors',
        },
        {
          name: 'Program Management Office',
          level: 'Tactical',
          members: ['Program Manager', 'Project Leads', 'QA Lead'],
          cadence: 'Weekly',
          responsibilities: ['Progress tracking', 'Resource allocation', 'Issue resolution'],
          escalationPath: 'Steering Committee',
        },
        {
          name: 'Delivery Team',
          level: 'Execution',
          members: ['Team Leads', 'Technical Specialists', 'Analysts'],
          cadence: 'Daily',
          responsibilities: ['Task execution', 'Status reporting', 'Quality delivery'],
          escalationPath: 'Program Management Office',
        },
      ],
      decisionRights: existing?.decisionRights || [
        {
          decision: 'Budget Changes > 10%',
          responsible: 'Program Manager',
          accountable: 'Executive Sponsor',
          consulted: 'Finance Lead',
          informed: 'Steering Committee',
        },
        {
          decision: 'Scope Changes',
          responsible: 'Project Lead',
          accountable: 'Program Manager',
          consulted: 'Technical Lead',
          informed: 'Stakeholders',
        },
        {
          decision: 'Resource Allocation',
          responsible: 'PMO',
          accountable: 'Program Manager',
          consulted: 'Team Leads',
          informed: 'HR',
        },
      ],
      meetingCadence: existing?.meetingCadence || {
        'Steering Committee': 'Monthly on first Monday',
        'PMO Review': 'Weekly on Wednesday',
        'Team Stand-up': 'Daily at 9:00 AM',
        'Sprint Review': 'Bi-weekly on Friday',
      },
      confidence: existing?.confidence || 0.75,
    };
  }
  
  /**
   * Build proper QA Plan structure matching frontend types
   */
  private buildProperQAPlan(existing: any): any {
    return {
      standards: existing?.standards || [
        {
          area: 'Code Quality',
          standard: 'All code must pass automated testing with >80% coverage',
          acceptanceCriteria: ['Unit tests pass', 'Integration tests pass', 'No critical bugs'],
        },
        {
          area: 'Documentation',
          standard: 'Complete technical and user documentation required',
          acceptanceCriteria: ['API documentation complete', 'User guides updated', 'Training materials prepared'],
        },
        {
          area: 'Performance',
          standard: 'System must meet defined SLAs',
          acceptanceCriteria: ['Response time < 2s', '99.9% uptime', 'Load test passed'],
        },
      ],
      processes: existing?.processes || [
        {
          phase: 'Planning',
          activities: ['Requirements review', 'Test plan creation', 'Resource allocation'],
        },
        {
          phase: 'Development',
          activities: ['Code reviews', 'Unit testing', 'Continuous integration'],
        },
        {
          phase: 'Testing',
          activities: ['Integration testing', 'UAT', 'Performance testing', 'Security testing'],
        },
        {
          phase: 'Deployment',
          activities: ['Deployment validation', 'Smoke testing', 'Rollback verification'],
        },
      ],
      acceptanceCriteria: existing?.acceptanceCriteria || [
        'All critical defects resolved',
        'User acceptance sign-off obtained',
        'Performance benchmarks met',
        'Security audit passed',
        'Documentation complete',
      ],
      confidence: existing?.confidence || 0.75,
    };
  }
  
  /**
   * Build proper Stage Gates structure matching frontend types
   */
  private buildProperStageGates(existing: any, timeline: any): any {
    const phases = timeline?.phases || [];
    const gates = existing?.gates || phases.map((phase: any, index: number) => ({
      gate: index + 1,
      name: `Gate ${index + 1}: ${phase.name || 'Phase'} Review`,
      month: phase.endMonth || (index + 1) * 3,
      goCriteria: [
        `All ${phase.name || 'phase'} deliverables complete`,
        'Quality standards met',
        'Stakeholder approval obtained',
      ],
      noGoTriggers: [
        'Critical defects unresolved',
        'Budget overrun > 15%',
        'Key resources unavailable',
      ],
      deliverables: [`${phase.name || 'Phase'} completion report`],
      confidence: 0.75,
    }));
    
    return {
      gates,
      confidence: existing?.confidence || 0.75,
    };
  }
  
  /**
   * Build proper KPIs structure matching frontend types
   */
  private buildProperKPIs(benefitsRealization: any): any {
    const benefits = benefitsRealization?.benefits || [];
    const kpis = benefits.slice(0, 5).map((benefit: any, index: number) => ({
      id: `kpi-${index + 1}`,
      name: benefit.name || `KPI ${index + 1}`,
      category: benefit.category || 'Operational',
      baseline: 'Current state',
      target: benefit.measurement || 'Target value',
      measurement: benefit.measurement || 'To be defined',
      frequency: 'Monthly',
      owner: 'Program Manager',
      linkedBenefitIds: [benefit.id || `benefit-${index + 1}`],
      confidence: benefit.confidence || 0.75,
    }));
    
    // Add default KPIs if none from benefits
    if (kpis.length === 0) {
      kpis.push(
        {
          id: 'kpi-1',
          name: 'Project Delivery On-Time',
          category: 'Operational',
          baseline: '0%',
          target: '95%',
          measurement: 'Milestone completion rate',
          frequency: 'Monthly',
          owner: 'Program Manager',
          linkedBenefitIds: [],
          confidence: 0.75,
        },
        {
          id: 'kpi-2',
          name: 'Budget Variance',
          category: 'Financial',
          baseline: '0%',
          target: '< 10%',
          measurement: 'Actual vs planned spend',
          frequency: 'Monthly',
          owner: 'Finance Lead',
          linkedBenefitIds: [],
          confidence: 0.75,
        },
        {
          id: 'kpi-3',
          name: 'Stakeholder Satisfaction',
          category: 'Strategic',
          baseline: '0',
          target: '> 4.0/5.0',
          measurement: 'Satisfaction survey score',
          frequency: 'Quarterly',
          owner: 'Program Manager',
          linkedBenefitIds: [],
          confidence: 0.75,
        }
      );
    }
    
    return {
      kpis,
      confidence: 0.75,
    };
  }
  
  /**
   * Build proper Risk Register structure matching frontend types
   */
  private buildProperRiskRegister(existing: any): any {
    const risks = existing?.risks || existing || [];
    const formattedRisks = (Array.isArray(risks) ? risks : []).map((risk: any, index: number) => ({
      id: risk.id || `risk-${index + 1}`,
      description: risk.description || risk.name || `Risk ${index + 1}`,
      category: risk.category || 'Operational',
      probability: typeof risk.probability === 'number' ? risk.probability : 0.5,
      impact: this.normalizeImpact(risk.impact),
      severity: typeof risk.severity === 'number' ? risk.severity : 5,
      mitigation: risk.mitigation || 'Mitigation plan to be defined',
      contingency: risk.contingency || 'Contingency plan to be defined',
      owner: risk.owner || 'Risk Owner',
      confidence: risk.confidence || 0.75,
    }));
    
    // Add default risks if none exist
    if (formattedRisks.length === 0) {
      formattedRisks.push(
        {
          id: 'risk-1',
          description: 'Resource availability constraints',
          category: 'Resource',
          probability: 0.4,
          impact: 'Medium',
          severity: 5,
          mitigation: 'Cross-train team members, maintain resource buffer',
          contingency: 'Engage contractors if needed',
          owner: 'Program Manager',
          confidence: 0.75,
        },
        {
          id: 'risk-2',
          description: 'Scope creep affecting timeline',
          category: 'Scope',
          probability: 0.5,
          impact: 'High',
          severity: 7,
          mitigation: 'Strict change control process',
          contingency: 'Prioritize and defer non-critical features',
          owner: 'Project Lead',
          confidence: 0.75,
        },
        {
          id: 'risk-3',
          description: 'Technical integration challenges',
          category: 'Technical',
          probability: 0.3,
          impact: 'High',
          severity: 6,
          mitigation: 'Early proof of concept, technical spikes',
          contingency: 'Alternative technical approaches identified',
          owner: 'Technical Lead',
          confidence: 0.75,
        }
      );
    }
    
    // Identify top risks (highest severity)
    const topRisks = [...formattedRisks].sort((a, b) => b.severity - a.severity).slice(0, 3);
    
    return {
      risks: formattedRisks,
      topRisks,
      mitigationBudget: formattedRisks.length * 10000,
      confidence: 0.75,
    };
  }
  
  /**
   * Normalize impact to valid enum value
   */
  private normalizeImpact(impact: any): 'Low' | 'Medium' | 'High' | 'Critical' {
    if (!impact) return 'Medium';
    const str = String(impact).toLowerCase();
    if (str.includes('critical') || str.includes('severe')) return 'Critical';
    if (str.includes('high') || str.includes('major')) return 'High';
    if (str.includes('low') || str.includes('minor')) return 'Low';
    return 'Medium';
  }
  
  /**
   * Enhance basic program with proper data structures when intelligent planning fails
   */
  private enhanceBasicProgram(program: EPMProgram, businessContext: BusinessContext): EPMProgram {
    const enhanced = { ...program };
    enhanced.governance = this.buildProperGovernance(program.governance, businessContext);
    enhanced.qaPlan = this.buildProperQAPlan((program as any).qaPlan);
    enhanced.stageGates = this.buildProperStageGates(program.stageGates, program.timeline);
    enhanced.kpis = this.buildProperKPIs(program.benefitsRealization);
    enhanced.riskRegister = this.buildProperRiskRegister(program.riskRegister);
    return enhanced;
  }

  private async executeRound(
    sessionId: string,
    roundDef: typeof rounds[0],
    businessContext: BusinessContext,
    bmcInsights: any,
    alreadyCompleted: string[],
    skipAgents: boolean,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<void> {
    const agentIds = roundDef.participatingAgents.includes('all')
      ? getAllAgentIds()
      : roundDef.participatingAgents;

    const pendingAgents = skipAgents ? [] : agentIds.filter(id => !alreadyCompleted.includes(id));
    const previousContext = await this.buildContextFromPreviousRounds(sessionId, roundDef.inputFromPreviousRounds);

    if (pendingAgents.length > 0) {
      if (roundDef.parallel && this.config.parallelAgents) {
        await Promise.all(pendingAgents.map(agentId =>
          this.executeAgent(
            sessionId,
            agentId,
            roundDef,
            businessContext,
            bmcInsights,
            previousContext,
            onProgress
          )
        ));
      } else {
        for (const agentId of pendingAgents) {
          await this.executeAgent(
            sessionId,
            agentId,
            roundDef,
            businessContext,
            bmcInsights,
            previousContext,
            onProgress
          );
        }
      }
    }

    if (roundDef.requiresSynthesis) {
      await this.executeSynthesis(sessionId, roundDef, businessContext, onProgress);
    }

    if (roundDef.conflictResolution) {
      await this.executeConflictResolution(sessionId, roundDef, businessContext, onProgress);
    }
  }

  private async executeAgent(
    sessionId: string,
    agentId: string,
    roundDef: typeof rounds[0],
    businessContext: BusinessContext,
    bmcInsights: any,
    previousContext: string,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<void> {
    const agent = getAgent(agentId);
    if (!agent) {
      console.warn(`[Orchestrator] Unknown agent: ${agentId}`);
      return;
    }

    const turnId = uuid();
    const systemPrompt = buildAgentSystemPrompt(agent);
    const userPrompt = buildRoundPrompt(agent, roundDef, businessContext, bmcInsights, previousContext);

    await conversationPersistence.saveTurn({
      id: turnId,
      sessionId,
      round: roundDef.round,
      agentId,
      turnType: 'agent_input',
      prompt: userPrompt,
      response: null,
      status: 'in_progress',
      tokensUsed: 0,
    });

    onProgress?.({
      type: 'agent_start',
      round: roundDef.round,
      agent: agent.role,
    });

    const startTime = Date.now();

    try {
      const response = await llmInterface.generateStructured({
        systemPrompt,
        userPrompt,
        schema: agent.outputSchema,
      });

      const parsedOutput = response.content as Record<string, any>;
      
      await conversationPersistence.updateTurn(turnId, {
        response: JSON.stringify(parsedOutput),
        status: 'complete',
        tokensUsed: response.tokensUsed,
        durationMs: response.durationMs,
        parsedOutput,
      });

      await conversationPersistence.saveTurn({
        id: uuid(),
        sessionId,
        round: roundDef.round,
        agentId,
        turnType: 'agent_output',
        prompt: '',
        response: JSON.stringify(parsedOutput),
        status: 'complete',
        tokensUsed: response.tokensUsed,
        durationMs: response.durationMs,
        parsedOutput,
      });

      onProgress?.({
        type: 'agent_complete',
        round: roundDef.round,
        agent: agent.role,
      });

      console.log(`[Orchestrator] Agent ${agentId} completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await conversationPersistence.updateTurn(turnId, {
        status: 'failed',
        errorMessage,
        durationMs: Date.now() - startTime,
      });

      console.error(`[Orchestrator] Agent ${agentId} failed:`, errorMessage);
    }
  }

  private async executeSynthesis(
    sessionId: string,
    roundDef: typeof rounds[0],
    businessContext: BusinessContext,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<void> {
    const agentOutputs = await conversationPersistence.getRoundOutputs(sessionId, roundDef.round);

    if (Object.keys(agentOutputs).length === 0) {
      console.warn(`[Orchestrator] No agent outputs for synthesis in round ${roundDef.round}`);
      return;
    }

    const turnId = uuid();
    const synthesisPrompt = buildSynthesisPrompt(roundDef, agentOutputs, businessContext);

    await conversationPersistence.saveTurn({
      id: turnId,
      sessionId,
      round: roundDef.round,
      agentId: 'program_coordinator',
      turnType: 'synthesis',
      prompt: synthesisPrompt,
      response: null,
      status: 'in_progress',
      tokensUsed: 0,
    });

    onProgress?.({ type: 'synthesis_start', round: roundDef.round });

    try {
      const response = await llmInterface.generateStructured({
        systemPrompt: agents.program_coordinator.goal,
        userPrompt: synthesisPrompt,
        schema: synthesisOutputSchema,
      });

      const synthesisParsedOutput = response.content as Record<string, any>;
      
      await conversationPersistence.updateTurn(turnId, {
        response: JSON.stringify(synthesisParsedOutput),
        status: 'complete',
        tokensUsed: response.tokensUsed,
        durationMs: response.durationMs,
        parsedOutput: synthesisParsedOutput,
      });

      onProgress?.({ type: 'synthesis_complete', round: roundDef.round });

      console.log(`[Orchestrator] Synthesis for round ${roundDef.round} completed`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await conversationPersistence.updateTurn(turnId, {
        status: 'failed',
        errorMessage,
      });

      console.error(`[Orchestrator] Synthesis failed for round ${roundDef.round}:`, errorMessage);
    }
  }

  private async executeConflictResolution(
    sessionId: string,
    roundDef: typeof rounds[0],
    businessContext: BusinessContext,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<void> {
    const synthesis = await conversationPersistence.getSynthesis(sessionId, roundDef.round);

    if (!synthesis?.conflicts || synthesis.conflicts.length === 0) {
      console.log(`[Orchestrator] No conflicts to resolve in round ${roundDef.round}`);
      return;
    }

    const turnId = uuid();
    const resolutionPrompt = buildConflictResolutionPrompt(roundDef, synthesis, businessContext);

    await conversationPersistence.saveTurn({
      id: turnId,
      sessionId,
      round: roundDef.round,
      agentId: 'program_coordinator',
      turnType: 'conflict_resolution',
      prompt: resolutionPrompt,
      response: null,
      status: 'in_progress',
      tokensUsed: 0,
    });

    onProgress?.({
      type: 'conflict_resolution_start',
      round: roundDef.round,
      conflicts: synthesis.conflicts.length,
    });

    try {
      const response = await llmInterface.generateStructured({
        systemPrompt: 'You are an experienced program manager who makes clear, justified decisions to resolve conflicts.',
        userPrompt: resolutionPrompt,
        schema: conflictResolutionSchema,
      });

      const resolutionParsedOutput = response.content as Record<string, any>;
      
      await conversationPersistence.updateTurn(turnId, {
        response: JSON.stringify(resolutionParsedOutput),
        status: 'complete',
        tokensUsed: response.tokensUsed,
        durationMs: response.durationMs,
        parsedOutput: resolutionParsedOutput,
      });

      onProgress?.({ type: 'conflict_resolution_complete', round: roundDef.round });

      console.log(`[Orchestrator] Conflict resolution for round ${roundDef.round} completed`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await conversationPersistence.updateTurn(turnId, {
        status: 'failed',
        errorMessage,
      });

      console.error(`[Orchestrator] Conflict resolution failed for round ${roundDef.round}:`, errorMessage);
    }
  }

  private async buildContextFromPreviousRounds(
    sessionId: string,
    roundNumbers: number[]
  ): Promise<string> {
    if (roundNumbers.length === 0) {
      return '';
    }

    const contextParts: string[] = [];

    for (const round of roundNumbers) {
      const synthesis = await conversationPersistence.getSynthesis(sessionId, round);
      if (synthesis) {
        contextParts.push(`### Round ${round} Summary\n${synthesis.roundSummary || JSON.stringify(synthesis, null, 2)}`);
      }
    }

    return contextParts.join('\n\n');
  }
}

export const multiAgentOrchestrator = new MultiAgentOrchestrator();
