/**
 * Software Development Pattern - For building software products
 * Examples: SaaS platforms, mobile apps, web applications, tech products
 */

import { PatternPlugin } from './pattern-plugin';
import { BusinessIntent, WorkStreamPattern, InitiativeType } from '../interfaces';

export class SoftwareDevelopmentPattern extends PatternPlugin {
  type: InitiativeType = 'software_development';
  name = 'Software Development Pattern';
  
  /**
   * Generate work breakdown pattern for software development initiatives
   */
  async analyze(context: BusinessIntent): Promise<WorkStreamPattern> {
    const isSaaS = context.businessModel.toLowerCase().includes('saas') || 
                   context.businessModel.toLowerCase().includes('platform');
    const isEnterprise = context.businessModel.toLowerCase().includes('enterprise');
    
    const pattern: WorkStreamPattern = {
      initiativeType: this.type,
      streams: []
    };
    
    // Build streams with weights that sum to exactly 100%
    // Software businesses are technology-heavy by nature
    
    // Technology platform development (core product)
    pattern.streams.push({
      category: 'technology_systems',
      weight: 60,  // Technology IS the product
      priority: 'critical',
      description: 'Platform architecture, core features, infrastructure, security, scalability'
    });
    
    // Operations (DevOps, monitoring, support)
    pattern.streams.push({
      category: 'operations',
      weight: 10,
      priority: 'high',
      description: 'DevOps, CI/CD, monitoring, customer support systems'
    });
    
    // Human resources (engineering team, hiring)
    pattern.streams.push({
      category: 'human_resources',
      weight: 15,
      priority: 'high',
      description: 'Engineering hiring, team structure, development processes'
    });
    
    // Marketing & sales (product marketing, sales infrastructure)
    pattern.streams.push({
      category: 'marketing_sales',
      weight: 10,  // Standard for software businesses
      priority: 'high',
      description: 'Product marketing, sales enablement, go-to-market strategy'
    });
    
    // Legal & compliance (data privacy, SLAs, terms of service)
    pattern.streams.push({
      category: 'legal_compliance',
      weight: 5,  // Essential for software (GDPR, SOC2, etc.)
      priority: 'high',
      description: 'Data privacy, security compliance, terms of service, SLAs'
    });
    
    // Verify total is exactly 100% (60+10+15+10+5 = 100)
    pattern.totalWeight = 100;
    
    return pattern;
  }
}
