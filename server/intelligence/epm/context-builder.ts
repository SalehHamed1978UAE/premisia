/**
 * ContextBuilder - Infers business context from strategic insights
 * 
 * Provides robust scale inference using multiple signals to prevent
 * the intelligent planning system from generating inappropriate timelines
 * (e.g., 166 months for a coffee shop)
 */

import type { StrategyInsights } from '../types';
import type { PlanningContext, BusinessScale } from '../../../src/lib/intelligent-planning/types';

export class ContextBuilder {
  /**
   * Build planning context from journey insights
   * Now ASYNC to fetch initiative type from database
   */
  static async fromJourneyInsights(
    insights: StrategyInsights,
    journeyType: string = 'strategy_workspace',
    sessionId?: string
  ): Promise<PlanningContext> {
    const scale = this.inferScale(insights);
    const timelineRange = this.inferTimelineRange(scale, insights);
    const budgetRange = this.inferBudgetRange(scale, insights);
    
    let initiativeType: string | undefined = undefined;
    if (sessionId) {
      try {
        const { db } = await import('../../db');
        const { strategicUnderstanding } = await import('@shared/schema');
        const { eq } = await import('drizzle-orm');
        
        const understanding = await db
          .select({ initiativeType: strategicUnderstanding.initiativeType })
          .from(strategicUnderstanding)
          .where(eq(strategicUnderstanding.sessionId, sessionId))
          .limit(1);
        
        if (understanding.length > 0 && understanding[0].initiativeType) {
          initiativeType = understanding[0].initiativeType;
          console.log(`[ContextBuilder] 🎯 Retrieved initiative type from DB: ${initiativeType}`);
        } else {
          console.log('[ContextBuilder] ⚠️ No initiative type found in DB for session:', sessionId);
        }
      } catch (error) {
        console.error('[ContextBuilder] Error fetching initiative type:', error);
      }
    } else {
      console.log('[ContextBuilder] ⚠️ No sessionId provided, cannot fetch initiative type');
    }
    
    return {
      business: {
        name: 'Unnamed Business',
        type: this.inferBusinessType(insights),
        industry: insights.marketContext?.industry || 'general',
        description: '',
        scale,
        initiativeType
      },
      strategic: {
        insights: insights,
        constraints: [],
        objectives: this.extractObjectives(insights)
      },
      execution: {
        timeline: timelineRange,
        budget: budgetRange,
        resources: []
      },
      meta: {
        journeyType,
        confidence: insights.overallConfidence || 0.75,
        version: '1.0'
      }
    };
  }

  /**
   * Infer business scale using multiple signals
   */
  private static inferScale(insights: StrategyInsights): BusinessScale {
    const contextText = (
      insights.insights.map(i => i.content).join(' ')
    ).toLowerCase();
    
    let smb_score = 0;
    let enterprise_score = 0;
    
    if (contextText.match(/\b(shop|store|cafe|coffee|local|small|startup|boutique|restaurant)\b/g)) {
      smb_score += 3;
    }
    if (contextText.match(/\b(single location|one location|neighborhood|community)\b/g)) {
      smb_score += 2;
    }
    if (contextText.match(/\b(under \$\d+k|small budget|limited budget|bootstrap)\b/g)) {
      smb_score += 2;
    }
    if (contextText.match(/\b(1-5 employees|small team|solo|founder)\b/g)) {
      smb_score += 2;
    }
    
    if (contextText.match(/\b(enterprise|corporation|global|multinational|platform|saas)\b/g)) {
      enterprise_score += 3;
    }
    if (contextText.match(/\b(multi-location|nationwide|international|multiple markets)\b/g)) {
      enterprise_score += 2;
    }
    if (contextText.match(/\b(million|series [abc]|vc funded|enterprise software)\b/g)) {
      enterprise_score += 2;
    }
    if (contextText.match(/\b(100\+ employees|large team|department)\b/g)) {
      enterprise_score += 2;
    }
    
    if (smb_score >= 4 && smb_score > enterprise_score) {
      return 'smb';
    }
    if (enterprise_score >= 4 && enterprise_score > smb_score) {
      return 'enterprise';
    }
    
    return 'mid_market';
  }

  /**
   * Infer timeline range based on scale
   */
  private static inferTimelineRange(scale: BusinessScale, insights: StrategyInsights): { min: number; max: number } {
    const contextText = insights.insights.map(i => i.content).join(' ').toLowerCase();
    
    const monthsMatch = contextText.match(/(\d+)\s*months?/);
    if (monthsMatch) {
      const explicitMonths = parseInt(monthsMatch[1]);
      return {
        min: Math.max(3, Math.floor(explicitMonths * 0.75)),
        max: Math.ceil(explicitMonths * 1.5)
      };
    }
    
    switch (scale) {
      case 'smb':
        return { min: 6, max: 12 };
      case 'mid_market':
        return { min: 12, max: 24 };
      case 'enterprise':
        return { min: 24, max: 48 };
    }
  }

  /**
   * Infer budget range based on scale and context
   */
  private static inferBudgetRange(scale: BusinessScale, insights: StrategyInsights): { min: number; max: number } | undefined {
    const contextText = insights.insights.map(i => i.content).join(' ').toLowerCase();
    
    const budgetMatch = contextText.match(/\$(\d+(?:,\d+)*)\s*(k|thousand|million|mm|m(?=\s|$))?/i);
    if (budgetMatch) {
      const amount = parseInt(budgetMatch[1].replace(/,/g, ''));
      const unit = (budgetMatch[2] || '').toLowerCase();
      
      const multiplier = (unit === 'million' || unit === 'mm' || unit === 'm') ? 1000000 : 
                        (unit === 'k' || unit === 'thousand') ? 1000 : 1;
      const budget = amount * multiplier;
      return {
        min: budget * 0.75,
        max: budget * 1.25
      };
    }
    
    switch (scale) {
      case 'smb':
        return { min: 50000, max: 250000 };
      case 'mid_market':
        return { min: 250000, max: 2000000 };
      case 'enterprise':
        return { min: 2000000, max: 10000000 };
    }
  }

  /**
   * Infer business type from insights
   */
  private static inferBusinessType(insights: StrategyInsights): string {
    const contextText = insights.insights.map(i => i.content).join(' ').toLowerCase();
    
    if (contextText.match(/\b(coffee|cafe|shop|store|restaurant|bakery)\b/)) return 'retail_food_service';
    if (contextText.match(/\b(saas|software|platform|app|tech)\b/)) return 'saas_platform';
    if (contextText.match(/\b(consulting|service|agency)\b/)) return 'professional_services';
    if (contextText.match(/\b(manufacturing|factory|production)\b/)) return 'manufacturing';
    if (contextText.match(/\b(ecommerce|online|marketplace)\b/)) return 'ecommerce';
    
    return 'general_business';
  }

  /**
   * Extract objectives from insights
   */
  private static extractObjectives(insights: StrategyInsights): string[] {
    return insights.insights
      .filter(i => i.type === 'workstream' || i.source?.includes('objective'))
      .slice(0, 5)
      .map(i => i.content.split('\n')[0]);
  }
}

export default ContextBuilder;
