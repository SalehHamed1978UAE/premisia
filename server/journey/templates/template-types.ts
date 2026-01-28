/**
 * Journey Template Types
 * 
 * Defines the structure for pre-configured journey templates
 * that can be used by Strategic Consultant V2.
 */

export interface JourneyTemplate {
  id: string;
  name: string;
  description: string;

  analysisFrameworks: FrameworkType[];

  epmModules: EPMModuleConfig[];

  industryHints?: string[];

  defaultTimeline?: { min: number; max: number };

  defaultBudget?: { min: number; max: number };
}

export type FrameworkType = 
  | 'five_whys'
  | 'swot'
  | 'pestle'
  | 'porters'
  | 'bmc'
  | 'ansoff'
  | 'blue_ocean'
  | 'ocean_strategy'
  | 'bcg_matrix'
  | 'value_chain'
  | 'vrio'
  | 'scenario_planning'
  | 'jobs_to_be_done'
  | 'competitive_positioning'
  | 'segment_discovery';

export interface EPMModuleConfig {
  moduleId: string;
  required: boolean;
  customPrompt?: string;
}
