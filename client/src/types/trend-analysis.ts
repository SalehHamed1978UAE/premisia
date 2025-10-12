// PESTLE Trend Analysis Types

export type PESTLECategory = 'POLITICAL' | 'ECONOMIC' | 'SOCIAL' | 'TECHNOLOGICAL' | 'LEGAL' | 'ENVIRONMENTAL';

export type TimeHorizon = 'short-term' | 'medium-term' | 'long-term';

export type RelationshipType = 'validates' | 'contradicts' | 'partially_validates';

export interface TrendClaim {
  id?: string;
  category: PESTLECategory;
  claim: string;
  evidence: string[];
  sources: string[];
  confidence: 'high' | 'medium' | 'low';
  timeHorizon: TimeHorizon;
  rationale: string;
}

export interface PESTLEFactors {
  political: TrendClaim[];
  economic: TrendClaim[];
  social: TrendClaim[];
  technological: TrendClaim[];
  legal: TrendClaim[];
  environmental: TrendClaim[];
}

export interface AssumptionComparison {
  assumptionId: string;
  assumptionClaim: string;
  relationship: RelationshipType;
  relatedTrends: string[];
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
  explanation: string;
}

export interface TrendSynthesis {
  executiveSummary: string;
  keyFindings: string[];
  strategicImplications: string[];
  recommendedActions: string[];
  risks: string[];
  opportunities: string[];
}

export interface TrendTelemetry {
  totalLatencyMs: number;
  llmCalls: number;
  tokenUsage?: {
    prompt: number;
    completion: number;
  };
  providerUsage: {
    openai?: number;
    anthropic?: number;
    gemini?: number;
  };
  cacheHits: number;
  apiCalls: number;
  retries: number;
}

export interface TrendAnalysisResult {
  insightId: string;
  understandingId: string;
  pestleFactors: PESTLEFactors;
  comparisons: AssumptionComparison[];
  synthesis: TrendSynthesis;
  telemetry: TrendTelemetry;
  createdAt: string;
}

export interface TrendProgressMessage {
  type: 'progress' | 'complete' | 'error';
  message?: string;
  phase?: string;
  step?: number;
  totalSteps?: number;
  result?: TrendAnalysisResult;
  error?: string;
}
