/**
 * Module Compatibility Rules
 * Defines which module outputs can connect to which module inputs
 * Used by Journey Builder for validation and connection guidance
 */

export interface ConnectionRule {
  sourceModuleId: string;
  sourcePortId: string;
  targetModuleId: string;
  targetPortId: string;
  allowed: boolean;
  reason?: string;
}

export interface DataTypeCompatibility {
  outputType: string;
  compatibleInputTypes: string[];
}

export const dataTypeCompatibility: DataTypeCompatibility[] = [
  {
    outputType: 'strategic_context',
    compatibleInputTypes: ['strategic_context', 'any', 'business_context'],
  },
  {
    outputType: 'bmc_output',
    compatibleInputTypes: ['bmc_output', 'business_context', 'any'],
  },
  {
    outputType: 'five_whys_output',
    compatibleInputTypes: ['five_whys_output', 'design_constraints', 'any'],
  },
  {
    outputType: 'swot_output',
    compatibleInputTypes: ['swot_output', 'current_state', 'strategic_analysis', 'any'],
  },
  {
    outputType: 'porters_output',
    compatibleInputTypes: ['porters_output', 'competitive_forces', 'industry_analysis', 'any'],
  },
  {
    outputType: 'pestle_output',
    compatibleInputTypes: ['pestle_output', 'external_factors', 'macro_factors', 'any'],
  },
  {
    outputType: 'segment_discovery_output',
    compatibleInputTypes: ['segment_discovery_output', 'target_segments', 'customer_context', 'any'],
  },
  {
    outputType: 'ansoff_output',
    compatibleInputTypes: ['ansoff_output', 'growth_strategy', 'any'],
  },
  {
    outputType: 'blue_ocean_output',
    compatibleInputTypes: ['blue_ocean_output', 'any'],
  },
  {
    outputType: 'vrio_output',
    compatibleInputTypes: ['vrio_output', 'resource_analysis', 'any'],
  },
  {
    outputType: 'value_chain_output',
    compatibleInputTypes: ['value_chain_output', 'any'],
  },
  {
    outputType: 'bcg_matrix_output',
    compatibleInputTypes: ['bcg_matrix_output', 'portfolio_analysis', 'any'],
  },
  {
    outputType: 'scenario_planning_output',
    compatibleInputTypes: ['scenario_planning_output', 'future_scenarios', 'any'],
  },
  {
    outputType: 'jobs_to_be_done_output',
    compatibleInputTypes: ['jobs_to_be_done_output', 'customer_jobs', 'any'],
  },
  {
    outputType: 'okr_output',
    compatibleInputTypes: ['okr_output', 'objectives', 'any'],
  },
  {
    outputType: 'string',
    compatibleInputTypes: ['string', 'any'],
  },
  {
    outputType: 'marketing_context',
    compatibleInputTypes: ['marketing_context', 'classification', 'any'],
  },
];

export const connectionRules: ConnectionRule[] = [
  { sourceModuleId: 'bmc-analyzer', sourcePortId: 'bmcResults', targetModuleId: 'swot-analyzer', targetPortId: 'business_context', allowed: true },
  { sourceModuleId: 'bmc-analyzer', sourcePortId: 'bmcResults', targetModuleId: 'porters-analyzer', targetPortId: 'business_context', allowed: true },
  { sourceModuleId: 'bmc-analyzer', sourcePortId: 'bmcResults', targetModuleId: 'value-chain-analyzer', targetPortId: 'business_context', allowed: true },
  { sourceModuleId: 'bmc-analyzer', sourcePortId: 'bmcResults', targetModuleId: 'ansoff-analyzer', targetPortId: 'business_context', allowed: true },

  { sourceModuleId: 'swot-analyzer', sourcePortId: 'output', targetModuleId: 'ansoff-analyzer', targetPortId: 'swot_analysis', allowed: true },
  { sourceModuleId: 'swot-analyzer', sourcePortId: 'output', targetModuleId: 'blue-ocean-analyzer', targetPortId: 'current_state', allowed: true },
  { sourceModuleId: 'swot-analyzer', sourcePortId: 'output', targetModuleId: 'ocean-strategy-analyzer', targetPortId: 'current_state', allowed: true },
  { sourceModuleId: 'swot-analyzer', sourcePortId: 'output', targetModuleId: 'okr-generator', targetPortId: 'strategic_analysis', allowed: true },

  { sourceModuleId: 'porters-analyzer', sourcePortId: 'output', targetModuleId: 'competitive-positioning-analyzer', targetPortId: 'competitive_forces', allowed: true },
  { sourceModuleId: 'porters-analyzer', sourcePortId: 'output', targetModuleId: 'blue-ocean-analyzer', targetPortId: 'industry_analysis', allowed: true },
  { sourceModuleId: 'porters-analyzer', sourcePortId: 'output', targetModuleId: 'swot-analyzer', targetPortId: 'business_context', allowed: true },

  { sourceModuleId: 'segment-discovery-analyzer', sourcePortId: 'output', targetModuleId: 'jobs-to-be-done-analyzer', targetPortId: 'target_segments', allowed: true },
  { sourceModuleId: 'segment-discovery-analyzer', sourcePortId: 'output', targetModuleId: 'value-chain-analyzer', targetPortId: 'customer_context', allowed: true },
  { sourceModuleId: 'segment-discovery-analyzer', sourcePortId: 'output', targetModuleId: 'competitive-positioning-analyzer', targetPortId: 'target_segments', allowed: true },

  { sourceModuleId: 'pestle-analyzer', sourcePortId: 'output', targetModuleId: 'scenario-planning-analyzer', targetPortId: 'macro_factors', allowed: true },
  { sourceModuleId: 'pestle-analyzer', sourcePortId: 'output', targetModuleId: 'swot-analyzer', targetPortId: 'external_factors', allowed: true },

  { sourceModuleId: 'five-whys-analyzer', sourcePortId: 'output', targetModuleId: 'bmc-analyzer', targetPortId: 'designConstraints', allowed: true },

  { sourceModuleId: 'okr-generator', sourcePortId: 'output', targetModuleId: 'bmc-analyzer', targetPortId: 'strategicContext', allowed: false, reason: 'OKRs are an output, not input to business model analysis' },
  { sourceModuleId: 'okr-generator', sourcePortId: 'output', targetModuleId: 'five-whys-analyzer', targetPortId: 'problem', allowed: false, reason: 'OKRs cannot be used as input to root cause analysis' },

  { sourceModuleId: 'epm-generator', sourcePortId: 'output', targetModuleId: 'bmc-analyzer', targetPortId: 'strategicContext', allowed: false, reason: 'EPM output cannot feed back into analysis' },
];

export const validationRules = {
  requireStartNode: true,
  requireAllInputs: true,
  preventCycles: true,
  warnOnStubModules: true,
  maxNodes: 15,
  maxParallelBranches: 4,
  durationWarningMinutes: 20,
};

export function isConnectionAllowed(
  sourceModuleId: string,
  sourcePortId: string,
  targetModuleId: string,
  targetPortId: string,
  sourceOutputType: string,
  targetInputType: string
): { allowed: boolean; reason?: string } {
  const explicitRule = connectionRules.find(
    r =>
      r.sourceModuleId === sourceModuleId &&
      r.sourcePortId === sourcePortId &&
      r.targetModuleId === targetModuleId &&
      r.targetPortId === targetPortId
  );

  if (explicitRule) {
    return { allowed: explicitRule.allowed, reason: explicitRule.reason };
  }

  const typeCompatibility = dataTypeCompatibility.find(d => d.outputType === sourceOutputType);
  if (typeCompatibility && typeCompatibility.compatibleInputTypes.includes(targetInputType)) {
    return { allowed: true };
  }

  if (targetInputType === 'any') {
    return { allowed: true };
  }

  return { allowed: false, reason: `Type mismatch: ${sourceOutputType} cannot connect to ${targetInputType}` };
}

export function detectCycle(
  nodes: { id: string }[],
  edges: { sourceNodeId: string; targetNodeId: string }[]
): { hasCycle: boolean; cycleNodes?: string[] } {
  const adjacencyList = new Map<string, string[]>();
  
  for (const node of nodes) {
    adjacencyList.set(node.id, []);
  }
  
  for (const edge of edges) {
    const targets = adjacencyList.get(edge.sourceNodeId) || [];
    targets.push(edge.targetNodeId);
    adjacencyList.set(edge.sourceNodeId, targets);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();
  const cyclePath: string[] = [];

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recStack.add(nodeId);
    cyclePath.push(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          return true;
        }
      } else if (recStack.has(neighbor)) {
        cyclePath.push(neighbor);
        return true;
      }
    }

    recStack.delete(nodeId);
    cyclePath.pop();
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) {
        return { hasCycle: true, cycleNodes: cyclePath };
      }
    }
  }

  return { hasCycle: false };
}

export function findStartNodes(
  nodes: { id: string; moduleId: string }[],
  edges: { targetNodeId: string }[]
): string[] {
  const nodesWithIncoming = new Set(edges.map(e => e.targetNodeId));
  return nodes
    .filter(n => !nodesWithIncoming.has(n.id))
    .map(n => n.id);
}

export function getExecutionOrder(
  nodes: { id: string }[],
  edges: { sourceNodeId: string; targetNodeId: string }[]
): string[] {
  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacencyList.set(node.id, []);
  }

  for (const edge of edges) {
    const currentDegree = inDegree.get(edge.targetNodeId) || 0;
    inDegree.set(edge.targetNodeId, currentDegree + 1);
    
    const targets = adjacencyList.get(edge.sourceNodeId) || [];
    targets.push(edge.targetNodeId);
    adjacencyList.set(edge.sourceNodeId, targets);
  }

  const queue: string[] = [];
  const result: string[] = [];

  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    const neighbors = adjacencyList.get(current) || [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  return result;
}
