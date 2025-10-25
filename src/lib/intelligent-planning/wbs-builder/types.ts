/**
 * Supporting type definitions for WBS Builder
 */

/**
 * Work stream categories mapped to business domains
 */
export enum WorkStreamDomain {
  PHYSICAL_INFRASTRUCTURE = 'physical_infrastructure',
  TECHNOLOGY_SYSTEMS = 'technology_systems',
  OPERATIONS = 'operations',
  HUMAN_RESOURCES = 'human_resources',
  MARKETING_SALES = 'marketing_sales',
  LEGAL_COMPLIANCE = 'legal_compliance',
  FINANCIAL_MANAGEMENT = 'financial_management',
  SUPPLY_CHAIN = 'supply_chain',
}

/**
 * Effort allocation presets for different business types
 */
export const EffortAllocationPresets = {
  PHYSICAL_BUSINESS: {
    [WorkStreamDomain.PHYSICAL_INFRASTRUCTURE]: 35,
    [WorkStreamDomain.TECHNOLOGY_SYSTEMS]: 10,
    [WorkStreamDomain.OPERATIONS]: 25,
    [WorkStreamDomain.HUMAN_RESOURCES]: 15,
    [WorkStreamDomain.MARKETING_SALES]: 10,
    [WorkStreamDomain.LEGAL_COMPLIANCE]: 5,
  },
  SOFTWARE_BUSINESS: {
    [WorkStreamDomain.TECHNOLOGY_SYSTEMS]: 60,
    [WorkStreamDomain.OPERATIONS]: 10,
    [WorkStreamDomain.HUMAN_RESOURCES]: 15,
    [WorkStreamDomain.MARKETING_SALES]: 10,
    [WorkStreamDomain.LEGAL_COMPLIANCE]: 5,
  },
  HYBRID_BUSINESS: {
    [WorkStreamDomain.PHYSICAL_INFRASTRUCTURE]: 20,
    [WorkStreamDomain.TECHNOLOGY_SYSTEMS]: 30,
    [WorkStreamDomain.OPERATIONS]: 20,
    [WorkStreamDomain.HUMAN_RESOURCES]: 15,
    [WorkStreamDomain.MARKETING_SALES]: 10,
    [WorkStreamDomain.LEGAL_COMPLIANCE]: 5,
  },
};
