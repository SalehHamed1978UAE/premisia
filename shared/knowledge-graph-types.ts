/**
 * TypeScript type definitions for Decision Support Knowledge Graph
 * All node types and their properties
 */

// =====================================
// CORE DOMAIN NODE TYPES
// =====================================

export interface LocationNode {
  id: string;
  extId?: string;
  name: string;
  type: 'district' | 'city' | 'emirate' | 'country';
  lat?: number;
  lng?: number;
  parentId?: string;
  aliases?: string[];
  dataSource: string;
  retrievedAt: string;
}

export interface JurisdictionNode {
  id: string;
  name: string;
  type: 'mainland' | 'free_zone';
  authorityOrgId?: string;
  dataSource: string;
  retrievedAt: string;
}

export interface IndustryNode {
  id: string;
  name: string;
  code?: string;
  aliases?: string[];
  dataSource: string;
  retrievedAt: string;
}

export interface IncentiveNode {
  id: string;
  sourceKey: string;
  name: string;
  provider: string;
  description: string;
  eligibilitySummary?: string;
  benefits?: string[];
  url?: string;
  expiryDate?: string;
  dataSource: string;
  retrievedAt: string;
}

export interface RegulationNode {
  id: string;
  sourceKey: string;
  title: string;
  authority: string;
  summary: string;
  effectiveDate?: string;
  url?: string;
  dataSource: string;
  retrievedAt: string;
}

export interface ReferenceNode {
  id: string;
  url: string;
  title: string;
  publisher?: string;
  publishedAt?: string;
  license?: string;
  dataSource: string;
  retrievedAt: string;
}

export interface OrganizationNode {
  id: string;
  extId?: string;
  name: string;
  type: 'government' | 'authority' | 'agency' | 'private';
  url?: string;
  dataSource: string;
  retrievedAt: string;
}

// =====================================
// JOURNEY SESSION NODE TYPES
// =====================================

export interface JourneySessionNode {
  id: string;
  journeyType: string;
  versionNumber: number;
  locationId?: string;
  jurisdictionId?: string;
  industryId?: string;
  consentAggregate?: boolean;
  consentPeerShare?: boolean;
  consentModelTrain?: boolean;
  createdAt: string;
}

export interface FrameworkOutputNode {
  id: string;
  journeyId: string;
  stepId: string;
  framework: string;
  data: Record<string, any>;
  confidence?: number;
  createdAt: string;
}

export interface DecisionNode {
  id: string;
  journeyId: string;
  question: string;
  selectedOptionId?: string;
  createdAt: string;
}

export interface DecisionOptionNode {
  id: string;
  decisionId: string;
  label: string;
  isSelected: boolean;
  reasonRejected?: string;
  estimatedCost?: number;
  estimatedTimeline?: string;
}

export interface EvidenceNode {
  id: string;
  referenceId?: string;
  confidence?: number;
  snippet?: string;
  sourceType: 'web' | 'document' | 'research' | 'internal';
  origin: string;
  createdAt: string;
}

export interface ProgramNode {
  id: string;
  journeyId: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  workstreamCount?: number;
  timelineMonths?: number;
  budget?: number;
  locationId?: string;
  createdAt: string;
}

export interface EligibilityCriterionNode {
  id: string;
  key: string;
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  value: string | number | boolean;
}

// =====================================
// UPSERT TYPES FOR ETL
// =====================================

export type NodeLabel = 
  | 'Location'
  | 'Jurisdiction'
  | 'Industry'
  | 'Incentive'
  | 'Regulation'
  | 'Reference'
  | 'Organization'
  | 'JourneySession'
  | 'FrameworkOutput'
  | 'Decision'
  | 'DecisionOption'
  | 'Evidence'
  | 'Program'
  | 'EligibilityCriterion';

export interface NodeUpsert {
  label: NodeLabel;
  matchOn: { 
    id?: string; 
    extId?: string; 
    sourceKey?: string;
  };
  properties: Record<string, any>;
}

export type RelationshipType =
  | 'WITHIN'
  | 'LOCATED_IN'
  | 'UNDER'
  | 'TARGETS_INDUSTRY'
  | 'AVAILABLE_IN'
  | 'HAS_CRITERION'
  | 'SUPPORTED_BY'
  | 'CITES'
  | 'PRODUCED_FRAMEWORK'
  | 'CONCERNS_LOCATION'
  | 'CONCERNS_INDUSTRY'
  | 'GENERATED_PROGRAM'
  | 'ELIGIBLE_FOR'
  | 'CONSTRAINED_BY'
  | 'WRITTEN_BY';

export interface RelUpsert {
  from: { 
    label: NodeLabel; 
    matchOn: { 
      id?: string; 
      extId?: string; 
      sourceKey?: string;
    };
  };
  type: RelationshipType;
  to: { 
    label: NodeLabel; 
    matchOn: { 
      id?: string; 
      extId?: string; 
      sourceKey?: string;
    };
  };
  properties?: Record<string, any>;
}

// =====================================
// QUERY RESULT TYPES
// =====================================

export interface SimilarJourneyResult {
  id: string;
  journeyType: string;
  locationName?: string;
  industryName?: string;
  versionNumber: number;
  createdAt: string;
  programStatus?: string;
  frameworks?: string[];
}

export interface AvailableIncentiveResult {
  id: string;
  name: string;
  provider: string;
  description: string;
  eligibilitySummary?: string;
  benefits?: string[];
  url?: string;
  expiryDate?: string;
}

// =====================================
// ETL PROVENANCE TYPES
// =====================================

export interface ETLRun {
  id: string;
  scriptName: string;
  dataSource: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  nodesCreated: number;
  relationshipsCreated: number;
  errors?: string[];
}
