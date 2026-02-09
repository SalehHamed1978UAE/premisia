/**
 * Strategic Consultant V2 Types
 * 
 * Type definitions for the V2 implementation.
 */

export interface StrategicContext {
  sessionId: string;
  userInput: string;
  clarifications?: Record<string, string>;
  analysis?: AnalysisResult;
  industry?: string;
  businessType?: string;
}

export interface AnalysisResult {
  detectedIndustry: string;
  detectedBusinessType: string;
  keyInsights: string[];
  opportunities: string[];
  threats: string[];
  strategicChallenge: string;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'multi-select';
  options?: string[];
  required: boolean;
}

export interface JourneyInput {
  templateId: string;
  context: StrategicContext;
  options?: {
    skipFrameworks?: string[];
    customPrompts?: Record<string, string>;
  };
}

export interface V2RunResult {
  success: boolean;
  sessionId: string;
  templateUsed: string;
  epmProgramId?: string;
  error?: string;
}
