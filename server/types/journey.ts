import type { FrameworkType } from './epm';

export interface JourneyDefinition {
  id: string;
  name: string;
  description: string;
  frameworks: FrameworkType[];
  pageSequence: PageDefinition[];
  version: string;
  isActive: boolean;
}

export interface PageDefinition {
  id: string;
  path: string;
  component: string;
  requiredData: string[];
  producedData: string[];
}

export interface JourneySession {
  id: string;
  journeyId: string;
  userId: string;
  currentPage: string;
  state: JourneyState;
  createdAt: Date;
  updatedAt: Date;
}

export type JourneyState = 'active' | 'completed' | 'abandoned';

export interface JourneyProgress {
  currentStep: number;
  totalSteps: number;
  completedPages: string[];
  currentPage: string;
}

export interface JourneyContext {
  sessionId: string;
  userId: string;
  journeyType: string;
  input: string;
  analysisResults?: Record<string, unknown>;
  decisions?: Record<string, unknown>;
}
