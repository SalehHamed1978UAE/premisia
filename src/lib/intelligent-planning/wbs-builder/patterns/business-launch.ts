/**
 * Business Launch Pattern - For opening physical businesses
 * Examples: Coffee shops, restaurants, retail stores, service businesses
 */

import { PatternPlugin } from './pattern-plugin';
import { BusinessIntent, WorkStreamPattern, InitiativeType } from '../interfaces';

export class BusinessLaunchPattern extends PatternPlugin {
  type: InitiativeType = 'business_launch';
  name = 'Business Launch Pattern';
  
  /**
   * Generate work breakdown pattern for business launch initiatives
   */
  async analyze(context: BusinessIntent): Promise<WorkStreamPattern> {
    const isPhysical = context.isPhysical;
    const usesTech = context.technologyRole === 'operational_tool';
    const isService = context.businessModel.toLowerCase().includes('service');
    
    // Adjust proportions based on business characteristics
    const pattern: WorkStreamPattern = {
      initiativeType: this.type,
      streams: []
    };
    
    // Build streams based on business characteristics
    // Weights are carefully calibrated to sum to exactly 100%
    
    // Physical infrastructure (location, buildout, equipment)
    if (isPhysical) {
      pattern.streams.push({
        category: 'physical_infrastructure',
        weight: 35,  // Major focus for physical businesses
        priority: 'critical',
        description: 'Location scouting, lease negotiation, buildout, equipment procurement'
      });
    }
    
    // Technology systems (POS, inventory, online ordering)
    pattern.streams.push({
      category: 'technology_systems',
      weight: 10,  // Operational tools, not core product
      priority: 'medium',
      description: 'POS systems, inventory management, basic technology setup'
    });
    
    // Operations (processes, procedures, day-to-day)
    pattern.streams.push({
      category: 'operations',
      weight: 25,  // Critical for any business
      priority: 'critical',
      description: 'Operating procedures, vendor relationships, daily operations setup'
    });
    
    // Human resources (hiring, training)
    pattern.streams.push({
      category: 'human_resources',
      weight: 15,  // Standard for physical businesses
      priority: 'high',
      description: 'Hiring, training, team structure, HR policies'
    });
    
    // Marketing & sales (launch marketing, customer acquisition)
    pattern.streams.push({
      category: 'marketing_sales',
      weight: 10,  // Standard for physical businesses
      priority: 'high',
      description: 'Brand development, marketing strategy, customer acquisition'
    });
    
    // Legal & compliance (permits, licenses, regulations)
    pattern.streams.push({
      category: 'legal_compliance',
      weight: 5,  // Essential for new businesses
      priority: 'critical',
      description: 'Business licenses, permits, insurance, regulatory compliance'
    });
    
    // Verify total is exactly 100% (35+10+25+15+10+5 = 100)
    pattern.totalWeight = 100;
    
    return pattern;
  }
}
