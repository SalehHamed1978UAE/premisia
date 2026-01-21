export interface JourneyProgress {
  status: 'in_progress' | 'completed' | 'abandoned';
  journeyType?: string;
  hasAnalysis: boolean;
  hasDecisions: boolean;
  nextStep?: 'bmc_results' | 'decisions' | 'workspace' | 'complete';
  nextUrl?: string;
}

export interface StatementSummary {
  understandingId: string;
  sessionId: string;
  statement: string;
  title?: string;
  createdAt: Date | string;
  analyses: Record<string, { count: number; latestVersion: string }>;
  totalAnalyses: number;
  lastActivity: Date | string;
  journeyProgress?: JourneyProgress;
}

export interface AnalysisInfo {
  id: string;
  frameworkName: string;
  version: string;
  versionNumber?: number;
  createdAt: Date | string;
  duration?: number;
  summary?: string;
  keyFindings?: string[];
}

export interface StatementDetail {
  understandingId: string;
  sessionId: string;
  statement: string;
  title?: string;
  companyContext?: any;
  createdAt: Date | string;
  analyses: Record<string, AnalysisInfo[]>;
}
