/**
 * Template Registry
 * 
 * Central registry for all journey templates.
 * Provides .get() and .list() methods for template discovery.
 */

import type { JourneyTemplate } from './template-types';
import { standardEPMTemplate } from './standard-epm';
import { bmcJourneyTemplate } from './bmc-journey';
import { digitalTransformationTemplate } from './digital-transformation';
import { productLaunchTemplate } from './product-launch';
import { marketExpansionTemplate } from './market-expansion';

export type { JourneyTemplate, EPMModuleConfig, FrameworkType } from './template-types';

const templates: Map<string, JourneyTemplate> = new Map([
  [standardEPMTemplate.id, standardEPMTemplate],
  [bmcJourneyTemplate.id, bmcJourneyTemplate],
  [digitalTransformationTemplate.id, digitalTransformationTemplate],
  [productLaunchTemplate.id, productLaunchTemplate],
  [marketExpansionTemplate.id, marketExpansionTemplate],
]);

export const templateRegistry = {
  get(templateId: string): JourneyTemplate {
    const template = templates.get(templateId);
    if (!template) {
      console.log(`[TemplateRegistry] Template ${templateId} not found, returning default`);
      return standardEPMTemplate;
    }
    return template;
  },

  list(): JourneyTemplate[] {
    return Array.from(templates.values());
  },

  has(templateId: string): boolean {
    return templates.has(templateId);
  },

  getDefault(): JourneyTemplate {
    return standardEPMTemplate;
  },

  getByIndustryHint(keyword: string): JourneyTemplate | null {
    const lowerKeyword = keyword.toLowerCase();
    const templateList = Array.from(templates.values());
    for (const template of templateList) {
      if (template.industryHints?.some((hint: string) => 
        lowerKeyword.includes(hint.toLowerCase()) || 
        hint.toLowerCase().includes(lowerKeyword)
      )) {
        return template;
      }
    }
    return null;
  },
};

export { standardEPMTemplate, bmcJourneyTemplate, digitalTransformationTemplate, productLaunchTemplate, marketExpansionTemplate };
