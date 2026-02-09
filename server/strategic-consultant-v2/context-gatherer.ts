/**
 * Context Gatherer
 * 
 * Handles the initial context gathering phase of Strategic Consultant V2.
 * Runs strategic analysis and collects user clarifications.
 */

import { db } from '../db';
import { strategicUnderstanding } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { StrategicContext, AnalysisResult, ClarificationQuestion } from './types';
import { strategicUnderstandingService } from '../strategic-understanding-service';
import { getStrategicUnderstanding, updateStrategicUnderstanding, saveStrategicUnderstanding } from '../services/secure-data-service';

export class ContextGatherer {
  async askClarifications(userInput: string): Promise<ClarificationQuestion[]> {
    const questions: ClarificationQuestion[] = [];
    
    const lowerInput = userInput.toLowerCase();
    
    if (!lowerInput.includes('budget') && !lowerInput.includes('$') && !lowerInput.includes('cost')) {
      questions.push({
        id: 'budget_range',
        question: 'What is your approximate budget range for this initiative?',
        type: 'select',
        options: [
          'Under $50,000',
          '$50,000 - $250,000',
          '$250,000 - $1,000,000',
          '$1,000,000 - $5,000,000',
          'Over $5,000,000',
        ],
        required: false,
      });
    }
    
    if (!lowerInput.includes('month') && !lowerInput.includes('year') && !lowerInput.includes('week') && !lowerInput.includes('timeline')) {
      questions.push({
        id: 'timeline',
        question: 'What is your target timeline for completion?',
        type: 'select',
        options: [
          '1-3 months',
          '3-6 months',
          '6-12 months',
          '12-24 months',
          'Over 24 months',
        ],
        required: false,
      });
    }
    
    return questions;
  }

  async runAnalysis(userInput: string, clarifications: Record<string, string>): Promise<AnalysisResult> {
    console.log('[ContextGatherer] Running initial analysis...');
    
    const industry = this.detectIndustry(userInput);
    const businessType = this.detectBusinessType(userInput);
    
    console.log(`[ContextGatherer] Detected industry: ${industry}, type: ${businessType}`);
    
    return {
      detectedIndustry: industry,
      detectedBusinessType: businessType,
      keyInsights: [],
      opportunities: [],
      threats: [],
      strategicChallenge: this.extractChallenge(userInput),
    };
  }

  async saveContext(sessionId: string, context: {
    userInput: string;
    clarifications: Record<string, string>;
    analysis: AnalysisResult;
  }, userId: string): Promise<string> {
    console.log(`[ContextGatherer] Saving context for session: ${sessionId}`);
    
    const initiativeType = this.mapToInitiativeType(context.userInput, context.analysis.detectedIndustry);
    const existing = await getStrategicUnderstanding(sessionId);
    
    if (existing) {
      await updateStrategicUnderstanding(sessionId, {
        userInput: context.userInput,
        initiativeType,
        initiativeDescription: `${context.analysis.detectedBusinessType}: ${context.analysis.strategicChallenge}`,
      });
      return sessionId;
    } else {
      console.log(`[ContextGatherer] Creating new Strategic Understanding record`);
      const saved = await saveStrategicUnderstanding({
        sessionId,
        userInput: context.userInput,
        initiativeType,
        initiativeDescription: `${context.analysis.detectedBusinessType}: ${context.analysis.strategicChallenge}`,
        title: context.analysis.strategicChallenge.substring(0, 100),
        companyContext: {
          industry: context.analysis.detectedIndustry,
          businessType: context.analysis.detectedBusinessType,
          v2Analysis: context.analysis,
          clarifications: context.clarifications,
        },
      });
      return saved.sessionId;
    }
  }

  private mapToInitiativeType(userInput: string, detectedIndustry: string): string {
    const lowerInput = userInput.toLowerCase();
    
    if (lowerInput.includes('store') || lowerInput.includes('shop') || lowerInput.includes('restaurant') || 
        lowerInput.includes('cafe') || lowerInput.includes('open') || lowerInput.includes('launch') && 
        (lowerInput.includes('physical') || lowerInput.includes('location'))) {
      return 'physical_business_launch';
    }
    if (lowerInput.includes('app') || lowerInput.includes('software') || lowerInput.includes('saas') || 
        lowerInput.includes('platform') || lowerInput.includes('build')) {
      return 'software_development';
    }
    if (lowerInput.includes('digital') || lowerInput.includes('transform') || lowerInput.includes('modernize') ||
        lowerInput.includes('automate')) {
      return 'digital_transformation';
    }
    if (lowerInput.includes('expand') || lowerInput.includes('new market') || lowerInput.includes('geographic') ||
        lowerInput.includes('international')) {
      return 'market_expansion';
    }
    if (lowerInput.includes('product') || lowerInput.includes('launch') || lowerInput.includes('new line')) {
      return 'product_launch';
    }
    
    return 'physical_business_launch';
  }

  private detectIndustry(userInput: string): string {
    const lowerInput = userInput.toLowerCase();
    
    const industryPatterns: Record<string, string[]> = {
      'retail': ['store', 'shop', 'retail', 'ecommerce', 'e-commerce', 'merchandise', 'sneaker', 'fashion', 'clothing'],
      'food_service': ['restaurant', 'cafe', 'food', 'dining', 'kitchen', 'catering', 'bakery', 'bistro'],
      'technology': ['software', 'app', 'tech', 'saas', 'platform', 'digital', 'IT', 'cloud'],
      'healthcare': ['health', 'medical', 'clinic', 'hospital', 'pharma', 'wellness'],
      'finance': ['bank', 'financial', 'fintech', 'investment', 'insurance'],
      'manufacturing': ['factory', 'manufacturing', 'production', 'assembly'],
      'professional_services': ['consulting', 'agency', 'legal', 'accounting', 'advisory'],
      'hospitality': ['hotel', 'resort', 'tourism', 'travel', 'hospitality'],
      'education': ['school', 'university', 'education', 'training', 'learning'],
      'real_estate': ['property', 'real estate', 'development', 'construction'],
    };
    
    for (const [industry, keywords] of Object.entries(industryPatterns)) {
      if (keywords.some(keyword => lowerInput.includes(keyword))) {
        return industry;
      }
    }
    
    return 'general';
  }

  private detectBusinessType(userInput: string): string {
    const lowerInput = userInput.toLowerCase();
    
    if (lowerInput.includes('startup') || lowerInput.includes('new business') || lowerInput.includes('launch')) {
      return 'startup';
    }
    if (lowerInput.includes('expand') || lowerInput.includes('growth') || lowerInput.includes('scale')) {
      return 'expansion';
    }
    if (lowerInput.includes('transform') || lowerInput.includes('modernize') || lowerInput.includes('digital')) {
      return 'transformation';
    }
    if (lowerInput.includes('improve') || lowerInput.includes('optimize') || lowerInput.includes('efficiency')) {
      return 'optimization';
    }
    
    return 'initiative';
  }

  private extractChallenge(userInput: string): string {
    const sentences = userInput.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 0) {
      return sentences[0].trim();
    }
    return userInput.substring(0, 200);
  }
}

export const contextGatherer = new ContextGatherer();
