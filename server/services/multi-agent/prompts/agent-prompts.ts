import { AgentDefinition } from '../agents';
import { RoundDefinition } from '../rounds';
import { BusinessContext } from '../persistence/conversation-log';

export function buildAgentSystemPrompt(agent: AgentDefinition): string {
  return `You are the ${agent.role} for a strategic program planning initiative.

**Your Goal:** ${agent.goal}

**Your Expertise:** ${agent.expertise.join(', ')}

**Your Unique Perspective:** ${agent.perspective}

**Output Requirements:**
- Be specific and actionable - use real business terminology relevant to the actual business
- For a pizzeria, use terms like "Location Scouting", "Kitchen Equipment Procurement", "Staff Training"
- For software, use terms like "Architecture Design", "MVP Development", "User Testing"
- Never use generic placeholders like "Strategic Initiative 1" or "Phase A"
- Every deliverable must be concrete and measurable
- Reference the specific business context provided
- Provide realistic timeline and resource estimates

**Output Format:** Return valid JSON matching the requested schema. Be thorough but concise.`;
}

export function buildRoundPrompt(
  agent: AgentDefinition,
  roundDef: RoundDefinition,
  businessContext: BusinessContext,
  bmcInsights: any,
  previousContext: string
): string {
  return `## Round ${roundDef.round}: ${roundDef.name}

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

${previousContext || 'This is the first round. No previous context available.'}

---

## Your Task as ${agent.role}

Based on your expertise in ${agent.expertise.join(', ')}, provide your analysis for this round.

**Round ${roundDef.round} Expected Outputs:**
${roundDef.expectedOutputs.map(o => `- ${o.replace(/_/g, ' ')}`).join('\n')}

Focus on ${agent.perspective}.

Be specific to "${businessContext.name}" - avoid generic recommendations.

Provide your response as structured JSON with the following fields:
- observations: Key insights from your analysis
- recommendations: Specific, actionable recommendations with priority and rationale
- workItems: Proposed work packages (if applicable for this round)
- risks: Risks you've identified from your perspective
- resourceRequirements: Resources needed (if applicable)
- timeline: Timeline considerations (if applicable)
- confidence: Your confidence score (0-1) for this analysis

Make sure all work items and deliverables are business-specific to "${businessContext.name}".`;
}

export function buildSynthesisPrompt(
  roundDef: RoundDefinition,
  agentOutputs: Record<string, any>,
  businessContext: BusinessContext
): string {
  const agentSummaries = Object.entries(agentOutputs).map(([agentId, output]) => {
    return `### ${agentId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
${JSON.stringify(output, null, 2)}`;
  }).join('\n\n');

  return `You are the Program Coordinator synthesizing outputs from Round ${roundDef.round}: ${roundDef.name}

**Business Context:** ${businessContext.name} - ${businessContext.description}
**Scale:** ${businessContext.scale}

**Round Objective:** ${roundDef.objective}

---

## Agent Outputs

${agentSummaries}

---

## Your Task

1. Identify key themes and consensus points across all agents
2. Note any conflicting views or recommendations
3. Create a consolidated synthesis that captures collective intelligence
4. List any open items or decisions needed for subsequent rounds

Return a structured synthesis with:
- consensusPoints: What all agents agree on (array of {topic, agreement, supportingAgents})
- conflicts: Any disagreements (array of {topic, agentA, positionA, agentB, positionB, impact})
- consolidatedOutputs: Merged recommendations including workstreams, risks, resources, timeline
- openItems: Questions or decisions for later rounds
- roundSummary: Brief 2-3 sentence summary of this round

Ensure workstream names are specific to "${businessContext.name}" and not generic.`;
}

export function buildConflictResolutionPrompt(
  roundDef: RoundDefinition,
  synthesis: any,
  businessContext: BusinessContext
): string {
  if (!synthesis.conflicts || synthesis.conflicts.length === 0) {
    return '';
  }

  const conflictsList = synthesis.conflicts.map((c: any, i: number) => `
${i + 1}. **${c.topic}**
   - Position A (${c.agentA}): ${c.positionA}
   - Position B (${c.agentB}): ${c.positionB}
   - Impact: ${c.impact}
`).join('\n');

  return `You are the Program Coordinator resolving conflicts from Round ${roundDef.round}: ${roundDef.name}

**Business Context:**
${businessContext.name} - ${businessContext.description}
Scale: ${businessContext.scale}

---

## Conflicts Identified

${conflictsList}

---

## Your Task

For each conflict, provide:
1. Your recommended resolution
2. Rationale for the decision
3. Any compromises or trade-offs
4. Impact on timeline/budget/scope

Be decisive. These resolutions will be final for this program.

Return a structured response with:
- resolutions: Array of {conflictTopic, resolution, rationale, compromises, impactOnTimeline, impactOnBudget, impactOnScope}
- summary: Brief summary of the resolutions made`;
}

function formatBMCInsights(bmcInsights: any): string {
  if (!bmcInsights) {
    return 'No BMC insights provided.';
  }

  if (typeof bmcInsights === 'string') {
    return bmcInsights;
  }

  const blocks = [
    'customerSegments',
    'valuePropositions',
    'channels',
    'customerRelationships',
    'revenueStreams',
    'keyResources',
    'keyActivities',
    'keyPartners',
    'costStructure',
  ];

  const formatted: string[] = [];

  for (const block of blocks) {
    if (bmcInsights[block]) {
      const title = block.replace(/([A-Z])/g, ' $1').trim();
      formatted.push(`**${title}:** ${summarizeBlock(bmcInsights[block])}`);
    }
  }

  if (formatted.length === 0) {
    return JSON.stringify(bmcInsights, null, 2);
  }

  return formatted.join('\n');
}

function summarizeBlock(block: any): string {
  if (typeof block === 'string') return block;
  if (Array.isArray(block)) {
    return block.slice(0, 3).map(item => 
      typeof item === 'string' ? item : item.name || item.title || JSON.stringify(item)
    ).join(', ');
  }
  if (block.summary) return block.summary;
  if (block.description) return block.description;
  return JSON.stringify(block).slice(0, 200);
}
