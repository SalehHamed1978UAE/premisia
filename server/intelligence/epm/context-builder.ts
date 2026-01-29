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
        
        console.log('[ContextBuilder] INPUT:', {
          sessionId,
          understandingFound: understanding.length > 0,
          title: understanding[0]?.title?.substring(0, 50),
          userInput: understanding[0]?.userInput?.substring(0, 100),
          initiativeType: understanding[0]?.initiativeType
        });
        
        if (understanding.length > 0) {
          if (understanding[0].initiativeType) {
            initiativeType = understanding[0].initiativeType;
            console.log(`[ContextBuilder] 🎯 Retrieved initiative type from DB: ${initiativeType}`);
          }
          if (understanding[0].title && understanding[0].title !== 'Untitled' && understanding[0].title.length > 3) {
            businessName = understanding[0].title;
            console.log(`[ContextBuilder] 🏢 Retrieved business name from title: "${businessName}"`);
          } else if (understanding[0].userInput) {
            // If no title or title is 'Untitled', extract business name from userInput
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
    
    console.log('[ContextBuilder] OUTPUT:', {
      businessName,
      businessType,
      industry
    });
    
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
   * Looks for common patterns like "Basketball Sneaker Store" or "a sneaker store called X"
   */
  private static extractBusinessNameFromInput(userInput: string): string {
    console.log('[extractBusinessName] Input:', userInput?.substring(0, 100));
    
    if (!userInput || userInput.trim().length === 0) {
      return 'the business';
    }
    
    // Clean input - remove common sentence starters
    let cleanInput = userInput.trim();
    const sentenceStarters = [
      /^i\s+(?:want\s+to|am\s+planning\s+to|plan\s+to|would\s+like\s+to|need\s+to)\s+(?:open|start|build|launch|create)\s+(?:a\s+)?/i,
      /^we\s+(?:want\s+to|are\s+planning\s+to|plan\s+to|would\s+like\s+to|need\s+to)\s+(?:open|start|build|launch|create)\s+(?:a\s+)?/i,
      /^(?:opening|starting|launching|building|creating)\s+(?:a\s+)?/i,
      /^(?:open|start|build|launch|create)\s+(?:a\s+)?/i,
      /^(?:a\s+|an\s+|the\s+)/i,
    ];
    
    for (const starter of sentenceStarters) {
      cleanInput = cleanInput.replace(starter, '');
    }
    
    // Try to extract quoted names first
    const quotedMatch = userInput.match(/["']([^"']+)["']/);
    if (quotedMatch && quotedMatch[1].length <= 60) {
      console.log('[extractBusinessName] Found quoted name:', quotedMatch[1]);
      return quotedMatch[1];
    }
    
    // Pattern: Look for "X store/shop/business in Location" - extract X store/shop/business
    const storePattern = cleanInput.match(/^(.+?(?:store|shop|boutique|cafe|restaurant|business))/i);
    if (storePattern && storePattern[1]) {
      const extracted = storePattern[1].trim();
      if (extracted.length > 3 && extracted.length <= 60) {
        console.log('[extractBusinessName] Store pattern matched:', extracted);
        return extracted;
      }
    }
    
    // Pattern: Extract everything before location markers (in, at, for, located)
    const locationPattern = cleanInput.match(/^(.+?)\s+(?:in|at|for|located\s+in)\s+/i);
    if (locationPattern && locationPattern[1]) {
      const extracted = locationPattern[1].trim();
      if (extracted.length > 3 && extracted.length <= 60) {
        console.log('[extractBusinessName] Location pattern matched:', extracted);
        return extracted;
      }
    }
    
    // Pattern: "called X" or "named X"
    const namedPattern = userInput.match(/(?:called|named)\s+["']?([^"']+?)["']?(?:\s+in|\s+at|\s*$)/i);
    if (namedPattern && namedPattern[1]) {
      const extracted = namedPattern[1].trim();
      if (extracted.length > 2 && extracted.length <= 60) {
        console.log('[extractBusinessName] Named pattern matched:', extracted);
        return extracted;
      }
    }
    
    // Fallback: Use cleaned input if short enough, otherwise first 5 meaningful words
    if (cleanInput.length > 3 && cleanInput.length <= 60) {
      console.log('[extractBusinessName] Using cleaned input:', cleanInput);
      return cleanInput;
    }
    
    // Get first 5 words from clean input, filter out articles
    const words = cleanInput.split(/\s+/).filter(w => !['a', 'an', 'the', 'i', 'we'].includes(w.toLowerCase()));
    const result = words.slice(0, 5).join(' ');
    if (result.length > 3) {
      console.log('[extractBusinessName] Fallback words:', result);
      return result;
    }
    
    console.log('[extractBusinessName] Final fallback to cleaned input');
    return cleanInput || 'the business';
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
