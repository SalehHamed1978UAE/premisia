# Multi-Agent EPM Generator - TypeScript Native Specification

**Date:** January 22, 2026
**Purpose:** Replace CrewAI Python service with TypeScript-native multi-agent system
**Goal:** Full complexity, checkpoint/resume, modular, same output quality as original WBS Builder

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Agent Orchestrator                      │
│                        (TypeScript)                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Agent Pool  │  │ Round Defs  │  │ Conversation│             │
│  │  (config)   │  │  (config)   │  │    Log      │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Conversation Persistence Layer              │   │
│  │   - Every turn saved immediately                         │   │
│  │   - Resume from any point                                │   │
│  │   - Session-based storage                                │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    LLM Interface                         │   │
│  │   - Uses existing aiClients.callWithFallback()          │   │
│  │   - Structured output with JSON schemas                  │   │
│  │   - Parallel calls with Promise.all()                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   EPM Output    │
                    │  (Same format   │
                    │   as original)  │
                    └─────────────────┘
```

---

## 2. The 7 Agents

Each agent is a configuration object, not code. Easy to add/modify.

```typescript
// server/services/multi-agent/agents/index.ts

export interface AgentDefinition {
  id: string;
  role: string;
  goal: string;
  expertise: string[];
  perspective: string;  // What unique viewpoint does this agent bring?
  outputSchema: JSONSchema;  // Structured output format
}

export const agents: Record<string, AgentDefinition> = {

  programCoordinator: {
    id: 'program_coordinator',
    role: 'Program Coordinator',
    goal: 'Synthesize inputs, track decisions, resolve conflicts, ensure program coherence',
    expertise: ['program management', 'cross-functional coordination', 'decision facilitation'],
    perspective: 'Holistic view - ensures all pieces fit together and conflicts are resolved',
    outputSchema: { /* ... */ }
  },

  techArchitect: {
    id: 'tech_architect',
    role: 'Technical Architecture Lead',
    goal: 'Define technology requirements, assess feasibility, identify technical risks',
    expertise: ['systems architecture', 'technology selection', 'technical feasibility'],
    perspective: 'Technical feasibility and scalability - what can actually be built',
    outputSchema: { /* ... */ }
  },

  platformDelivery: {
    id: 'platform_delivery',
    role: 'Platform Delivery Manager',
    goal: 'Define delivery approach, quality gates, and operational readiness',
    expertise: ['delivery management', 'quality assurance', 'operational excellence'],
    perspective: 'Execution reality - how things actually get delivered',
    outputSchema: { /* ... */ }
  },

  goToMarket: {
    id: 'go_to_market',
    role: 'Go-to-Market Strategist',
    goal: 'Define market entry, positioning, channels, and launch strategy',
    expertise: ['market strategy', 'positioning', 'channel development', 'launch planning'],
    perspective: 'Market reality - what customers want and how to reach them',
    outputSchema: { /* ... */ }
  },

  customerSuccess: {
    id: 'customer_success',
    role: 'Customer Success Lead',
    goal: 'Define onboarding, retention, and customer experience strategies',
    expertise: ['customer onboarding', 'retention', 'customer experience', 'feedback loops'],
    perspective: 'Customer lifetime value - keeping customers happy long-term',
    outputSchema: { /* ... */ }
  },

  riskCompliance: {
    id: 'risk_compliance',
    role: 'Risk & Compliance Officer',
    goal: 'Identify risks, regulatory requirements, and mitigation strategies',
    expertise: ['risk assessment', 'regulatory compliance', 'mitigation planning'],
    perspective: 'What can go wrong and how to prevent it',
    outputSchema: { /* ... */ }
  },

  financeResources: {
    id: 'finance_resources',
    role: 'Finance & Resource Manager',
    goal: 'Define budget, resource allocation, and financial projections',
    expertise: ['financial planning', 'resource allocation', 'cost optimization'],
    perspective: 'Financial viability - can we afford this and is it worth it',
    outputSchema: { /* ... */ }
  }
};
```

---

## 3. The 7 Rounds

Each round defines: which agents participate, what they do, how outputs combine.

```typescript
// server/services/multi-agent/rounds/index.ts

export interface RoundDefinition {
  round: number;
  name: string;
  objective: string;
  participatingAgents: string[];  // Agent IDs, or 'all', or 'coordinator_only'
  parallel: boolean;  // Can agents run in parallel this round?
  requiresSynthesis: boolean;  // Does coordinator synthesize at end?
  conflictResolution: boolean;  // Explicitly resolve conflicts this round?
  inputFromPreviousRounds: number[];  // Which rounds' outputs feed into this?
  expectedOutputs: string[];  // What this round should produce
}

export const rounds: RoundDefinition[] = [
  {
    round: 1,
    name: 'Framing',
    objective: 'Understand scope, objectives, constraints, and success criteria',
    participatingAgents: ['all'],
    parallel: true,  // All 7 agents analyze in parallel
    requiresSynthesis: true,
    conflictResolution: false,
    inputFromPreviousRounds: [],
    expectedOutputs: [
      'program_vision',
      'scope_boundaries',
      'stakeholder_expectations',
      'success_criteria',
      'initial_constraints'
    ]
  },
  {
    round: 2,
    name: 'Dependency Discovery',
    objective: 'Map cross-workstream dependencies, integration points, critical path',
    participatingAgents: ['program_coordinator', 'tech_architect', 'platform_delivery', 'go_to_market', 'customer_success'],
    parallel: true,
    requiresSynthesis: true,
    conflictResolution: false,
    inputFromPreviousRounds: [1],
    expectedOutputs: [
      'dependency_matrix',
      'integration_points',
      'critical_path_elements',
      'shared_resources'
    ]
  },
  {
    round: 3,
    name: 'Negotiation',
    objective: 'Resolve conflicts, make trade-offs, reach consensus',
    participatingAgents: ['all'],
    parallel: false,  // Sequential - coordinator facilitates
    requiresSynthesis: true,
    conflictResolution: true,  // EXPLICIT CONFLICT RESOLUTION
    inputFromPreviousRounds: [1, 2],
    expectedOutputs: [
      'resolved_conflicts',
      'trade_off_decisions',
      'priority_rankings',
      'scope_adjustments'
    ]
  },
  {
    round: 4,
    name: 'Resource & Timeline',
    objective: 'Allocate resources, build schedule, establish milestones',
    participatingAgents: ['program_coordinator', 'platform_delivery', 'finance_resources', 'tech_architect'],
    parallel: true,
    requiresSynthesis: true,
    conflictResolution: false,
    inputFromPreviousRounds: [1, 2, 3],
    expectedOutputs: [
      'resource_allocation',
      'project_schedule',
      'milestone_roadmap',
      'capacity_analysis'
    ]
  },
  {
    round: 5,
    name: 'Risk Assessment',
    objective: 'Identify risks, assess impact, define mitigation strategies',
    participatingAgents: ['program_coordinator', 'risk_compliance', 'tech_architect', 'finance_resources', 'platform_delivery'],
    parallel: true,
    requiresSynthesis: true,
    conflictResolution: false,
    inputFromPreviousRounds: [1, 2, 3, 4],
    expectedOutputs: [
      'risk_register',
      'mitigation_plans',
      'contingency_reserves',
      'risk_monitoring_plan'
    ]
  },
  {
    round: 6,
    name: 'Reconciliation',
    objective: 'Verify alignment, reconcile budget, ensure consistency',
    participatingAgents: ['program_coordinator', 'finance_resources', 'platform_delivery'],
    parallel: false,  // Sequential verification
    requiresSynthesis: true,
    conflictResolution: true,  // Final conflict resolution
    inputFromPreviousRounds: [1, 2, 3, 4, 5],
    expectedOutputs: [
      'consolidated_plan',
      'budget_reconciliation',
      'timeline_validation',
      'consistency_report'
    ]
  },
  {
    round: 7,
    name: 'Sign-off',
    objective: 'Final review, confidence scoring, formal approval',
    participatingAgents: ['all'],
    parallel: true,  // All agents provide confidence scores
    requiresSynthesis: true,
    conflictResolution: false,
    inputFromPreviousRounds: [1, 2, 3, 4, 5, 6],
    expectedOutputs: [
      'final_program_plan',
      'confidence_scores',
      'outstanding_items',
      'sign_off_record'
    ]
  }
];
```

---

## 4. Conversation Persistence Layer

**Every single LLM interaction is saved immediately.**

```typescript
// server/services/multi-agent/persistence/conversation-log.ts

export interface ConversationTurn {
  id: string;  // UUID
  sessionId: string;
  round: number;
  agentId: string;
  turnType: 'agent_input' | 'agent_output' | 'synthesis' | 'conflict_resolution';
  prompt: string;
  response: string;
  timestamp: Date;
  tokensUsed: number;
  status: 'complete' | 'in_progress' | 'failed';
  metadata?: Record<string, any>;
}

export interface ConversationLog {
  sessionId: string;
  businessContext: BusinessContext;
  startedAt: Date;
  lastUpdatedAt: Date;
  currentRound: number;
  status: 'in_progress' | 'completed' | 'failed' | 'paused';
  turns: ConversationTurn[];

  // Computed from turns
  completedRounds: number[];
  agentOutputsByRound: Record<number, Record<string, any>>;
  synthesisOutputsByRound: Record<number, any>;
}

export class ConversationPersistence {

  // Save immediately after each LLM call
  async saveTurn(turn: ConversationTurn): Promise<void> {
    await db.insert('conversation_turns', turn);
  }

  // Load full conversation state for resume
  async loadConversation(sessionId: string): Promise<ConversationLog | null> {
    const turns = await db.query('conversation_turns', { sessionId });
    if (turns.length === 0) return null;

    return this.reconstructState(sessionId, turns);
  }

  // Find where to resume from
  async getResumePoint(sessionId: string): Promise<{
    round: number;
    agentsCompleted: string[];
    agentsPending: string[];
  }> {
    const log = await this.loadConversation(sessionId);
    if (!log) return { round: 1, agentsCompleted: [], agentsPending: ['all'] };

    // Find the last completed round
    const lastCompletedRound = Math.max(...log.completedRounds, 0);
    const currentRound = lastCompletedRound + 1;

    // Find which agents have completed current round
    const currentRoundTurns = log.turns.filter(t =>
      t.round === currentRound &&
      t.status === 'complete' &&
      t.turnType === 'agent_output'
    );

    const agentsCompleted = currentRoundTurns.map(t => t.agentId);
    const roundDef = rounds.find(r => r.round === currentRound);
    const allAgents = roundDef?.participatingAgents || [];
    const agentsPending = allAgents.filter(a => !agentsCompleted.includes(a));

    return { round: currentRound, agentsCompleted, agentsPending };
  }
}
```

---

## 5. The Orchestrator

Runs rounds, manages agents, handles resume.

```typescript
// server/services/multi-agent/orchestrator.ts

export class MultiAgentOrchestrator {
  private persistence: ConversationPersistence;
  private llm: LLMInterface;

  async generate(
    sessionId: string,
    businessContext: BusinessContext,
    bmcInsights: any,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<EPMProgram> {

    // Check for existing progress
    const resumePoint = await this.persistence.getResumePoint(sessionId);

    if (resumePoint.round > 1 || resumePoint.agentsCompleted.length > 0) {
      console.log(`[Orchestrator] Resuming from Round ${resumePoint.round}, ` +
        `${resumePoint.agentsCompleted.length} agents completed`);
      onProgress?.({ type: 'resume', round: resumePoint.round });
    }

    const conversationLog = await this.persistence.loadConversation(sessionId) ||
      this.initializeConversation(sessionId, businessContext);

    // Execute rounds
    for (const roundDef of rounds) {
      if (roundDef.round < resumePoint.round) continue;  // Skip completed rounds

      onProgress?.({ type: 'round_start', round: roundDef.round, name: roundDef.name });

      await this.executeRound(
        roundDef,
        conversationLog,
        businessContext,
        bmcInsights,
        resumePoint.round === roundDef.round ? resumePoint.agentsCompleted : [],
        onProgress
      );

      onProgress?.({ type: 'round_complete', round: roundDef.round });
    }

    // Convert conversation outputs to EPM format
    return this.assembleEPMProgram(conversationLog, businessContext);
  }

  private async executeRound(
    roundDef: RoundDefinition,
    conversationLog: ConversationLog,
    businessContext: BusinessContext,
    bmcInsights: any,
    alreadyCompleted: string[],
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<void> {

    // Get agents for this round
    const agentIds = roundDef.participatingAgents.includes('all')
      ? Object.keys(agents)
      : roundDef.participatingAgents;

    // Filter out already completed agents (for resume)
    const pendingAgents = agentIds.filter(id => !alreadyCompleted.includes(id));

    // Build context from previous rounds
    const previousContext = this.buildContextFromPreviousRounds(
      conversationLog,
      roundDef.inputFromPreviousRounds
    );

    if (roundDef.parallel) {
      // Run agents in parallel
      await Promise.all(pendingAgents.map(agentId =>
        this.executeAgent(
          agentId,
          roundDef,
          businessContext,
          bmcInsights,
          previousContext,
          conversationLog,
          onProgress
        )
      ));
    } else {
      // Run agents sequentially (for negotiation rounds)
      for (const agentId of pendingAgents) {
        await this.executeAgent(
          agentId,
          roundDef,
          businessContext,
          bmcInsights,
          previousContext,
          conversationLog,
          onProgress
        );
      }
    }

    // Synthesis step
    if (roundDef.requiresSynthesis) {
      await this.executeSynthesis(
        roundDef,
        conversationLog,
        businessContext,
        onProgress
      );
    }

    // Conflict resolution step
    if (roundDef.conflictResolution) {
      await this.executeConflictResolution(
        roundDef,
        conversationLog,
        businessContext,
        onProgress
      );
    }
  }

  private async executeAgent(
    agentId: string,
    roundDef: RoundDefinition,
    businessContext: BusinessContext,
    bmcInsights: any,
    previousContext: string,
    conversationLog: ConversationLog,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<void> {

    const agent = agents[agentId];

    const prompt = this.buildAgentPrompt(
      agent,
      roundDef,
      businessContext,
      bmcInsights,
      previousContext
    );

    // Save that we're starting this turn
    const turnId = uuid();
    await this.persistence.saveTurn({
      id: turnId,
      sessionId: conversationLog.sessionId,
      round: roundDef.round,
      agentId,
      turnType: 'agent_input',
      prompt,
      response: '',
      timestamp: new Date(),
      tokensUsed: 0,
      status: 'in_progress'
    });

    onProgress?.({ type: 'agent_start', round: roundDef.round, agent: agent.role });

    // Make LLM call
    const response = await this.llm.generateStructured({
      systemPrompt: this.buildAgentSystemPrompt(agent),
      userPrompt: prompt,
      schema: agent.outputSchema
    });

    // Save completed turn immediately
    await this.persistence.saveTurn({
      id: turnId,
      sessionId: conversationLog.sessionId,
      round: roundDef.round,
      agentId,
      turnType: 'agent_output',
      prompt,
      response: JSON.stringify(response),
      timestamp: new Date(),
      tokensUsed: response.tokensUsed || 0,
      status: 'complete'
    });

    onProgress?.({ type: 'agent_complete', round: roundDef.round, agent: agent.role });
  }

  private async executeSynthesis(
    roundDef: RoundDefinition,
    conversationLog: ConversationLog,
    businessContext: BusinessContext,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<void> {

    // Gather all agent outputs from this round
    const roundOutputs = await this.persistence.getRoundOutputs(
      conversationLog.sessionId,
      roundDef.round
    );

    const synthesisPrompt = `
You are the Program Coordinator synthesizing outputs from Round ${roundDef.round}: ${roundDef.name}

**Round Objective:** ${roundDef.objective}

**Agent Outputs:**
${Object.entries(roundOutputs).map(([agentId, output]) => `
### ${agents[agentId].role}
${JSON.stringify(output, null, 2)}
`).join('\n')}

**Your Task:**
1. Identify key themes and consensus points across all agents
2. Note any conflicting views or recommendations
3. Create a consolidated synthesis that captures collective intelligence
4. List any open items or decisions needed for subsequent rounds

Return a structured synthesis with:
- consensus_points: What all agents agree on
- conflicts: Any disagreements (to be resolved in negotiation)
- consolidated_outputs: Merged recommendations
- open_items: Questions or decisions for later rounds
`;

    onProgress?.({ type: 'synthesis_start', round: roundDef.round });

    const synthesis = await this.llm.generateStructured({
      systemPrompt: agents.programCoordinator.goal,
      userPrompt: synthesisPrompt,
      schema: synthesisOutputSchema
    });

    await this.persistence.saveTurn({
      id: uuid(),
      sessionId: conversationLog.sessionId,
      round: roundDef.round,
      agentId: 'program_coordinator',
      turnType: 'synthesis',
      prompt: synthesisPrompt,
      response: JSON.stringify(synthesis),
      timestamp: new Date(),
      tokensUsed: synthesis.tokensUsed || 0,
      status: 'complete'
    });

    onProgress?.({ type: 'synthesis_complete', round: roundDef.round });
  }

  private async executeConflictResolution(
    roundDef: RoundDefinition,
    conversationLog: ConversationLog,
    businessContext: BusinessContext,
    onProgress?: (progress: ProgressUpdate) => void
  ): Promise<void> {

    // Get synthesis to find conflicts
    const synthesis = await this.persistence.getSynthesis(
      conversationLog.sessionId,
      roundDef.round
    );

    if (!synthesis.conflicts || synthesis.conflicts.length === 0) {
      console.log(`[Orchestrator] No conflicts to resolve in Round ${roundDef.round}`);
      return;
    }

    const resolutionPrompt = `
You are the Program Coordinator resolving conflicts from Round ${roundDef.round}: ${roundDef.name}

**Conflicts Identified:**
${synthesis.conflicts.map((c: any, i: number) => `
${i + 1}. **${c.topic}**
   - Position A (${c.agentA}): ${c.positionA}
   - Position B (${c.agentB}): ${c.positionB}
   - Impact: ${c.impact}
`).join('\n')}

**Business Context:**
${businessContext.name} - ${businessContext.description}
Scale: ${businessContext.scale}

**Your Task:**
For each conflict, provide:
1. Your recommended resolution
2. Rationale for the decision
3. Any compromises or trade-offs
4. Impact on timeline/budget/scope

Be decisive. These resolutions will be final for this program.
`;

    onProgress?.({ type: 'conflict_resolution_start', round: roundDef.round, conflicts: synthesis.conflicts.length });

    const resolution = await this.llm.generateStructured({
      systemPrompt: 'You are an experienced program manager who makes clear, justified decisions to resolve conflicts.',
      userPrompt: resolutionPrompt,
      schema: conflictResolutionSchema
    });

    await this.persistence.saveTurn({
      id: uuid(),
      sessionId: conversationLog.sessionId,
      round: roundDef.round,
      agentId: 'program_coordinator',
      turnType: 'conflict_resolution',
      prompt: resolutionPrompt,
      response: JSON.stringify(resolution),
      timestamp: new Date(),
      tokensUsed: resolution.tokensUsed || 0,
      status: 'complete'
    });

    onProgress?.({ type: 'conflict_resolution_complete', round: roundDef.round });
  }
}
```

---

## 6. Output Assembly - Matching Original WBS Builder Quality

The final step converts conversation outputs to the EPM structure.

```typescript
// server/services/multi-agent/assembly/epm-assembler.ts

export class EPMAssembler {

  async assemble(conversationLog: ConversationLog, businessContext: BusinessContext): Promise<EPMProgram> {

    // Extract structured data from each round's synthesis
    const roundOutputs = this.extractRoundOutputs(conversationLog);

    return {
      id: uuid(),

      executiveSummary: this.buildExecutiveSummary(roundOutputs, businessContext),

      // Workstreams from Round 1-2 synthesis + Round 4 timeline
      workstreams: this.buildWorkstreams(roundOutputs, businessContext),

      // Timeline from Round 4
      timeline: this.buildTimeline(roundOutputs),

      // Resources from Round 4
      resourcePlan: this.buildResourcePlan(roundOutputs),

      // Financials from Round 4 + 6 reconciliation
      financialPlan: this.buildFinancialPlan(roundOutputs),

      // Risks from Round 5
      riskRegister: this.buildRiskRegister(roundOutputs),

      // Benefits from Round 1 + 7
      benefitsRealization: this.buildBenefitsRealization(roundOutputs),

      // Stage gates from Round 4 + 6
      stageGates: this.buildStageGates(roundOutputs),

      // KPIs from Round 7
      kpis: this.buildKPIs(roundOutputs),

      // Stakeholders from Round 1
      stakeholderMap: this.buildStakeholderMap(roundOutputs),

      // Governance from Round 6-7
      governance: this.buildGovernance(roundOutputs),

      // QA from Round 3-4
      qaPlan: this.buildQAPlan(roundOutputs),

      // Procurement from Round 4-5
      procurement: this.buildProcurement(roundOutputs),

      // Exit strategy from Round 5-6
      exitStrategy: this.buildExitStrategy(roundOutputs),

      // Confidence from Round 7
      componentConfidence: this.extractComponentConfidence(roundOutputs),
      overallConfidence: this.calculateOverallConfidence(roundOutputs),

      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private buildWorkstreams(roundOutputs: RoundOutputs, businessContext: BusinessContext): Workstream[] {
    // Extract workstreams identified in Rounds 1-2
    // Add timeline from Round 4
    // Add resources from Round 4
    // Add risks from Round 5

    const framingOutput = roundOutputs[1];
    const dependencyOutput = roundOutputs[2];
    const resourceOutput = roundOutputs[4];

    // Ensure workstream names are BUSINESS-SPECIFIC
    // Not "Strategic Initiative 1" but "Location Scouting & Lease Negotiation"

    return framingOutput.workstreams.map((ws: any, index: number) => ({
      id: `T${String(index + 1).padStart(3, '0')}`,
      name: ws.name,  // Must be business-specific
      description: ws.description,
      owner: resourceOutput.assignments?.[ws.id]?.owner || 'TBD',
      deliverables: ws.deliverables.map((d: any, dIndex: number) => ({
        id: `D${String(index + 1).padStart(3, '0')}.${dIndex + 1}`,
        name: d.name,  // Must be specific: "Signed lease agreement" not research content
        description: d.description,
        dueMonth: d.dueMonth,
        effort: d.effort
      })),
      dependencies: dependencyOutput.dependencies?.[ws.id] || [],
      startMonth: resourceOutput.timeline?.[ws.id]?.startMonth || index,
      endMonth: resourceOutput.timeline?.[ws.id]?.endMonth || index + 2,
      confidence: ws.confidence || 0.75,
      requirements: resourceOutput.requirements?.[ws.id] || []
    }));
  }
}
```

---

## 7. Agent Prompt Templates

Each agent needs a well-crafted prompt that produces quality output.

```typescript
// server/services/multi-agent/prompts/agent-prompts.ts

export function buildAgentSystemPrompt(agent: AgentDefinition): string {
  return `You are the ${agent.role} for a strategic program.

**Your Goal:** ${agent.goal}

**Your Expertise:** ${agent.expertise.join(', ')}

**Your Unique Perspective:** ${agent.perspective}

**Output Requirements:**
- Be specific and actionable - use real business terminology
- For a pizzeria, use terms like "Location Scouting", "Kitchen Equipment Procurement"
- For software, use terms like "Architecture Design", "MVP Development"
- Never use generic placeholders like "Strategic Initiative 1"
- Every deliverable must be concrete and measurable
- Reference the specific business context provided

**Output Format:** Return valid JSON matching the requested schema.`;
}

export function buildRoundPrompt(
  agent: AgentDefinition,
  roundDef: RoundDefinition,
  businessContext: BusinessContext,
  bmcInsights: any,
  previousContext: string
): string {
  return `
## Round ${roundDef.round}: ${roundDef.name}

**Objective:** ${roundDef.objective}

---

## Business Context

**Business Name:** ${businessContext.name}
**Type:** ${businessContext.type}
**Scale:** ${businessContext.scale}
**Industry:** ${businessContext.industry || 'Not specified'}

**Description:**
${businessContext.description}

---

## BMC Insights

${formatBMCInsights(bmcInsights)}

---

## Previous Round Context

${previousContext || 'This is the first round.'}

---

## Your Task as ${agent.role}

Based on your expertise in ${agent.expertise.join(', ')}, provide your analysis for this round.

**Round ${roundDef.round} Expected Outputs:**
${roundDef.expectedOutputs.map(o => `- ${o}`).join('\n')}

Focus on ${agent.perspective}.

Be specific to "${businessContext.name}" - not generic.
`;
}
```

---

## 8. Integration with Existing WBS Builder

The multi-agent system produces the same output format as the WBS Builder.

```typescript
// server/services/epm-generator/multi-agent-generator.ts

import { MultiAgentOrchestrator } from '../multi-agent/orchestrator';

export class MultiAgentEPMGenerator implements IEPMGenerator {
  private orchestrator: MultiAgentOrchestrator;

  async generate(input: EPMGeneratorInput): Promise<EPMGeneratorOutput> {
    const startTime = Date.now();

    console.log('[MultiAgentGenerator] Starting generation...');

    const program = await this.orchestrator.generate(
      input.sessionId,
      {
        name: input.businessContext.name,
        type: input.businessContext.type,
        scale: input.businessContext.scale,
        description: input.businessContext.description,
        industry: input.businessContext.industry
      },
      input.bmcInsights,
      (progress) => {
        // Emit progress events for UI
        console.log(`[MultiAgentGenerator] ${progress.type}: Round ${progress.round}`);
      }
    );

    return {
      program,
      metadata: {
        generator: 'multi-agent',
        generatedAt: new Date().toISOString(),
        confidence: program.overallConfidence,
        generationTimeMs: Date.now() - startTime
      }
    };
  }

  // Resume an interrupted generation
  async resume(sessionId: string): Promise<EPMGeneratorOutput> {
    // Just call generate - it auto-detects resume point
    return this.generate({ sessionId } as any);
  }
}
```

---

## 9. Database Schema for Conversation Persistence

```sql
-- Conversation turns table
CREATE TABLE conversation_turns (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL,
  round INTEGER NOT NULL,
  agent_id VARCHAR(50) NOT NULL,
  turn_type VARCHAR(30) NOT NULL,  -- agent_input, agent_output, synthesis, conflict_resolution
  prompt TEXT NOT NULL,
  response TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tokens_used INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  metadata JSONB,

  CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Index for fast resume queries
CREATE INDEX idx_turns_session_round ON conversation_turns(session_id, round);
CREATE INDEX idx_turns_status ON conversation_turns(session_id, status);

-- Conversation state view
CREATE VIEW conversation_state AS
SELECT
  session_id,
  MAX(round) FILTER (WHERE status = 'complete' AND turn_type = 'synthesis') as last_completed_round,
  COUNT(*) FILTER (WHERE status = 'complete') as completed_turns,
  COUNT(*) FILTER (WHERE status = 'in_progress') as pending_turns,
  MAX(timestamp) as last_activity
FROM conversation_turns
GROUP BY session_id;
```

---

## 10. File Structure

```
server/services/multi-agent/
├── index.ts                    # Exports
├── orchestrator.ts             # Main orchestrator
├── agents/
│   ├── index.ts               # Agent definitions
│   └── schemas.ts             # Output schemas per agent
├── rounds/
│   ├── index.ts               # Round definitions
│   └── schemas.ts             # Round output schemas
├── prompts/
│   ├── agent-prompts.ts       # Agent prompt templates
│   ├── synthesis-prompts.ts   # Synthesis prompts
│   └── conflict-prompts.ts    # Conflict resolution prompts
├── persistence/
│   ├── conversation-log.ts    # Conversation persistence
│   └── queries.ts             # Database queries
├── assembly/
│   ├── epm-assembler.ts       # Convert to EPM format
│   └── format-converters.ts   # Output formatters
└── llm/
    ├── interface.ts           # LLM interface (uses aiClients)
    └── structured-output.ts   # JSON schema enforcement
```

---

## 11. Summary: Why This is Better Than CrewAI

| Aspect | CrewAI | TypeScript Native |
|--------|--------|-------------------|
| Language | Python (separate service) | TypeScript (same as app) |
| Deployment | Separate process, port 8001 | Same process |
| Debugging | Black box | Full control |
| Resume | Not built-in | Every turn saved |
| Timeouts | 10 min limit, hangs | No limit, resume anytime |
| Modular | Config in YAML | Config in TypeScript |
| LLM | LiteLLM abstraction | Direct Claude API |
| Cost | Unknown | Predictable (N calls × cost) |
| Testing | Hard | Easy (mock LLM) |

---

## 12. Migration Path

1. **Phase 1:** Build orchestrator with persistence (1-2 days)
2. **Phase 2:** Implement 7 agents with prompts (1 day)
3. **Phase 3:** Implement 7 rounds with synthesis (1 day)
4. **Phase 4:** Build EPM assembler matching original format (1 day)
5. **Phase 5:** Integration testing with real business cases (1 day)
6. **Phase 6:** Deploy alongside legacy, A/B test quality (ongoing)

**Total: ~5-6 days to full replacement**

---

## 13. Quality Validation

Before shipping, validate that output matches or exceeds original quality:

**Test Case: "Specialty Coffee Roastery for UAE Residents"**

✓ Workstreams are business-specific:
  - "Market and location analysis for coffee shop"
  - "Lease negotiation and signing"
  - "Interior design and renovation"
  - NOT "Strategic Initiative 1"

✓ Deliverables are concrete:
  - "Signed lease agreement"
  - "Equipment and furniture installed"
  - "Trained staff"
  - NOT research content copy-pasted

✓ Resources are role-specific:
  - "Store Operations Manager"
  - "Head Barista"
  - "UAE Market Launch Manager"
  - NOT "Development Team"

✓ All EPM sections present and coherent
