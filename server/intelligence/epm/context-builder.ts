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
    let businessName: string = 'Unnamed Business';
    let businessDescription: string = '';
    let userInput: string = '';
    
    if (sessionId) {
      try {
        const { db } = await import('../../db');
        const { strategicUnderstanding } = await import('@shared/schema');
        const { eq } = await import('drizzle-orm');
        
        // The sessionId passed is actually the understanding_id (UUID format)
        // which equals strategic_understanding.id, NOT strategic_understanding.session_id
        const understanding = await db
          .select({ 
            initiativeType: strategicUnderstanding.initiativeType,
            title: strategicUnderstanding.title,
            initiativeDescription: strategicUnderstanding.initiativeDescription,
            userInput: strategicUnderstanding.userInput,
          })
          .from(strategicUnderstanding)
          .where(eq(strategicUnderstanding.id, sessionId))
          .limit(1);
        
        if (understanding.length > 0) {
          if (understanding[0].initiativeType) {
            initiativeType = understanding[0].initiativeType;
            console.log(`[ContextBuilder] 🎯 Retrieved initiative type from DB: ${initiativeType}`);
          }
          if (understanding[0].title) {
            businessName = understanding[0].title;
            console.log(`[ContextBuilder] 🏢 Retrieved business name from DB: "${businessName}"`);
          } else if (understanding[0].userInput) {
            // If no title, try to extract business name from userInput
            businessName = this.extractBusinessNameFromInput(understanding[0].userInput);
            console.log(`[ContextBuilder] 🏢 Extracted business name from userInput: "${businessName}"`);
          }
          if (understanding[0].initiativeDescription) {
            businessDescription = understanding[0].initiativeDescription;
            console.log(`[ContextBuilder] 📝 Retrieved business description from DB`);
          }
          if (understanding[0].userInput) {
            userInput = understanding[0].userInput;
          }
        } else {
          console.log('[ContextBuilder] ⚠️ No strategic understanding found for id:', sessionId);
        }
      } catch (error) {
        console.error('[ContextBuilder] Error fetching strategic understanding:', error);
      }
    } else {
      console.log('[ContextBuilder] ⚠️ No sessionId provided, cannot fetch strategic context');
    }
    
    // Infer business type first, then use it for industry if not explicitly set
    const businessType = this.inferBusinessType(insights);
    const industry = insights.marketContext?.industry || this.inferIndustryFromType(businessType);
    
    console.log(`[ContextBuilder] 🏭 Business type: ${businessType}, Industry: ${industry}`);
    
    return {
      business: {
        name: businessName,
        type: businessType,
        industry: industry,
        description: businessDescription || userInput,
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
   * Uses a more intelligent approach: check for specific industry context BEFORE generic patterns
   */
  private static inferBusinessType(insights: StrategyInsights): string {
    const contextText = insights.insights.map(i => i.content).join(' ').toLowerCase();
    
    // SPECIFIC RETAIL TYPES - must check BEFORE generic "store/shop" patterns
    // Footwear/Athletic retail
    if (contextText.match(/\b(sneaker|shoe|footwear|athletic|sportswear|nike|adidas|apparel|clothing|fashion)\b/)) {
      return 'retail_specialty';
    }
    
    // Electronics retail
    if (contextText.match(/\b(electronics|phone|computer|laptop|gadget|tech.*store|tech.*shop)\b/)) {
      return 'retail_electronics';
    }
    
    // Home/Furniture retail
    if (contextText.match(/\b(furniture|home.*store|home.*shop|decor|interior)\b/)) {
      return 'retail_home_goods';
    }
    
    // General merchandise retail (non-food)
    if (contextText.match(/\b(retail|merchandise|department|boutique)\b/) && 
        !contextText.match(/\b(food|cafe|coffee|restaurant|bakery|grocery|kitchen|perishable)\b/)) {
      return 'retail_general';
    }
    
    // FOOD-SPECIFIC patterns - only match when food context is explicit
    if (contextText.match(/\b(coffee|cafe|restaurant|bakery|food.*service|grocery|kitchen|dining|cuisine|menu)\b/)) {
      return 'retail_food_service';
    }
    
    // Technology/Software
    if (contextText.match(/\b(saas|software|platform|app(?:lication)?|tech(?:nology)?)\b/) &&
        !contextText.match(/\b(store|shop|retail)\b/)) {
      return 'saas_platform';
    }
    
    // Professional services
    if (contextText.match(/\b(consulting|service|agency|advisory)\b/)) return 'professional_services';
    
    // Manufacturing
    if (contextText.match(/\b(manufacturing|factory|production|assembly)\b/)) return 'manufacturing';
    
    // E-commerce
    if (contextText.match(/\b(ecommerce|e-commerce|online.*store|marketplace)\b/)) return 'ecommerce';
    
    // Generic store/shop WITHOUT food context = general retail
    if (contextText.match(/\b(store|shop)\b/) && 
        !contextText.match(/\b(food|cafe|coffee|restaurant|bakery|grocery)\b/)) {
      return 'retail_general';
    }
    
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

  /**
   * Extract business name from user input if title is not set
   * Looks for common patterns like "a sneaker store called X" or "my business X"
   */
  private static extractBusinessNameFromInput(userInput: string): string {
    // Try to extract quoted names first
    const quotedMatch = userInput.match(/["']([^"']+)["']/);
    if (quotedMatch && quotedMatch[1].length <= 60) {
      return quotedMatch[1];
    }
    
    // Try patterns like "called X", "named X", "my X store/shop/business"
    const patterns = [
      /called\s+([A-Z][A-Za-z0-9\s&'-]+?)(?:\s+in|\s+at|\s+to|\s+for|\s*,|\s*\.)/i,
      /named\s+([A-Z][A-Za-z0-9\s&'-]+?)(?:\s+in|\s+at|\s+to|\s+for|\s*,|\s*\.)/i,
      /opening\s+(?:a\s+)?([A-Z][A-Za-z0-9\s&'-]+?\s+(?:store|shop|boutique|cafe|restaurant|business))(?:\s+in|\s+at|\s*,|\s*\.)/i,
      /launch(?:ing)?\s+(?:a\s+)?([A-Z][A-Za-z0-9\s&'-]+?\s+(?:store|shop|boutique|cafe|restaurant|business))(?:\s+in|\s+at|\s*,|\s*\.)/i,
      /starting\s+(?:a\s+)?([A-Z][A-Za-z0-9\s&'-]+?\s+(?:store|shop|boutique|cafe|restaurant|business))(?:\s+in|\s+at|\s*,|\s*\.)/i,
    ];
    
    for (const pattern of patterns) {
      const match = userInput.match(pattern);
      if (match && match[1].trim().length > 0 && match[1].trim().length <= 60) {
        return match[1].trim();
      }
    }
    
    // Fallback: Extract first capitalized phrase as potential business name
    const capitalizedMatch = userInput.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/);
    if (capitalizedMatch && capitalizedMatch[1].length > 2 && capitalizedMatch[1].length <= 40) {
      // Exclude common words that start sentences
      const commonWords = ['The', 'This', 'Our', 'My', 'We', 'I', 'It', 'They', 'He', 'She'];
      if (!commonWords.includes(capitalizedMatch[1])) {
        return capitalizedMatch[1];
      }
    }
    
    return 'Unnamed Business';
  }

  /**
   * Infer human-readable industry from business type
   */
  private static inferIndustryFromType(businessType: string): string {
    const industryMap: Record<string, string> = {
      'retail_specialty': 'Specialty Retail',
      'retail_electronics': 'Electronics Retail',
      'retail_home_goods': 'Home Goods Retail',
      'retail_general': 'General Retail',
      'retail_food_service': 'Food & Beverage',
      'saas_platform': 'Technology / SaaS',
      'professional_services': 'Professional Services',
      'manufacturing': 'Manufacturing',
      'ecommerce': 'E-Commerce',
      'general_business': 'General Business',
    };
    
    return industryMap[businessType] || 'General Business';
  }
}

export default ContextBuilder;
