import { aiClients } from '../ai-clients.js';
import type { AIProvider } from '@shared/schema.js';

export type InitiativeType = 
  | 'physical_business_launch'
  | 'software_development'
  | 'digital_transformation'
  | 'market_expansion'
  | 'product_launch'
  | 'service_launch'
  | 'process_improvement'
  | 'other';

export interface ClassificationResult {
  initiativeType: InitiativeType;
  description: string;
  confidence: number; // 0.0 to 1.0
  reasoning: string;
}

const CLASSIFICATION_SYSTEM_PROMPT = `You are an expert business analyst specializing in initiative classification.

Your task is to analyze strategic inputs and classify the type of initiative being described.

Choose the MOST SPECIFIC classification that fits:

1. **physical_business_launch** - Opening physical locations (stores, restaurants, offices, warehouses)
   Examples: "Open a coffee shop in Brooklyn", "Launch a retail store", "Start a gym"

2. **software_development** - Building software products, apps, platforms, or technical systems
   Examples: "Build a SaaS platform", "Create a mobile app", "Develop an AI tool"

3. **digital_transformation** - Modernizing existing physical business with digital capabilities
   Examples: "Add online ordering to restaurant", "Build e-commerce for retail store", "Digitize manual processes"

4. **market_expansion** - Entering new markets, regions, or customer segments with existing products/services
   Examples: "Expand to European markets", "Target enterprise customers", "Launch in Asia"

5. **product_launch** - Introducing new physical or digital products to existing markets
   Examples: "Launch new product line", "Release upgraded version", "Add new SKU"

6. **service_launch** - Introducing new service offerings
   Examples: "Add consulting services", "Launch subscription service", "Offer training programs"

7. **process_improvement** - Optimizing existing operations, workflows, or efficiency
   Examples: "Improve supply chain", "Streamline HR processes", "Reduce operational costs"

8. **other** - Initiatives that don't clearly fit the above (use sparingly)

IMPORTANT: Always respond with valid JSON in this exact format:
{
  "initiativeType": "physical_business_launch",
  "description": "Launch of a physical retail location",
  "confidence": 0.95,
  "reasoning": "User explicitly mentions opening a physical store in a specific location"
}`;

const CLASSIFICATION_USER_PROMPT = `Analyze this strategic input and classify the initiative type:

USER INPUT:
{userInput}

Provide:
1. The most appropriate classification from the 8 types listed
2. A 1-2 sentence description of what type of initiative this is
3. Confidence score (0.0-1.0) - how certain you are about this classification
4. Brief reasoning for your choice

Respond ONLY with valid JSON.`;

export class InitiativeClassifier {
  /**
   * Classify a strategic input to determine the type of initiative
   */
  static async classify(
    userInput: string, 
    preferredProvider?: AIProvider
  ): Promise<ClassificationResult> {
    try {
      console.log('[INITIATIVE-CLASSIFIER] Starting classification for input:', 
        userInput.substring(0, 100) + '...');
      
      const userMessage = CLASSIFICATION_USER_PROMPT.replace('{userInput}', userInput);
      
      const response = await aiClients.callWithFallback({
        systemPrompt: CLASSIFICATION_SYSTEM_PROMPT,
        userMessage,
        maxTokens: 1024
      }, preferredProvider);
      
      console.log('[INITIATIVE-CLASSIFIER] Raw AI response:', response.content);
      
      // Parse and validate the response with robust error handling
      let parsed: any;
      try {
        parsed = JSON.parse(response.content);
      } catch (parseError) {
        console.error('[INITIATIVE-CLASSIFIER] JSON parse error:', parseError);
        console.error('[INITIATIVE-CLASSIFIER] Invalid JSON content:', response.content);
        // Fallback to keyword classification if JSON parse fails
        return this.fallbackClassification(userInput);
      }
      
      // Validate required fields exist
      if (!parsed || typeof parsed !== 'object') {
        console.error('[INITIATIVE-CLASSIFIER] Response is not an object:', parsed);
        return this.fallbackClassification(userInput);
      }
      
      // Validate the classification result
      if (!this.isValidInitiativeType(parsed.initiativeType)) {
        console.warn(`[INITIATIVE-CLASSIFIER] Invalid initiative type returned: ${parsed.initiativeType}, defaulting to 'other'`);
        parsed.initiativeType = 'other';
      }
      
      // Ensure confidence is between 0 and 1
      if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
        console.warn(`[INITIATIVE-CLASSIFIER] Invalid confidence score: ${parsed.confidence}, defaulting to 0.5`);
        parsed.confidence = 0.5;
      }
      
      // Ensure description and reasoning exist
      if (!parsed.description || typeof parsed.description !== 'string') {
        console.warn('[INITIATIVE-CLASSIFIER] Missing or invalid description, using default');
        parsed.description = 'Initiative classification';
      }
      
      if (!parsed.reasoning || typeof parsed.reasoning !== 'string') {
        console.warn('[INITIATIVE-CLASSIFIER] Missing or invalid reasoning, using default');
        parsed.reasoning = 'Automatic classification';
      }
      
      const result: ClassificationResult = {
        initiativeType: parsed.initiativeType,
        description: parsed.description,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning
      };
      
      console.log('[INITIATIVE-CLASSIFIER] Classification result:', result);
      
      return result;
      
    } catch (error) {
      console.error('[INITIATIVE-CLASSIFIER] Classification failed:', error);
      
      // Fallback classification based on simple keyword matching
      return this.fallbackClassification(userInput);
    }
  }
  
  /**
   * Validate if a string is a valid InitiativeType
   */
  private static isValidInitiativeType(type: any): type is InitiativeType {
    const validTypes: InitiativeType[] = [
      'physical_business_launch',
      'software_development',
      'digital_transformation',
      'market_expansion',
      'product_launch',
      'service_launch',
      'process_improvement',
      'other'
    ];
    return validTypes.includes(type);
  }
  
  /**
   * Fallback classification using simple keyword matching
   * Used when LLM classification fails
   */
  private static fallbackClassification(userInput: string): ClassificationResult {
    console.log('[INITIATIVE-CLASSIFIER] Using fallback keyword-based classification');
    
    const input = userInput.toLowerCase();

    // Service launch indicators (check first for hybrid businesses)
    const serviceKeywords = ['service', 'consulting', 'agency', 'rental', 'subscription', 'marketplace'];
    const physicalKeywords = ['boutique', 'store', 'shop', 'location', 'outlet', 'branch'];
    const hasServiceIndicators = serviceKeywords.some(kw => input.includes(kw));
    const hasPhysicalIndicators = physicalKeywords.some(kw => input.includes(kw));

    // Hybrid service/retail business (like fashion rental with boutique)
    if (hasServiceIndicators && hasPhysicalIndicators) {
      return {
        initiativeType: 'service_launch',
        description: 'Service business launch with physical presence',
        confidence: 0.7,
        reasoning: 'Keyword-based fallback classification (hybrid service/retail indicators detected)'
      };
    }

    // Pure service business
    if (hasServiceIndicators) {
      return {
        initiativeType: 'service_launch',
        description: 'Service or marketplace business launch',
        confidence: 0.6,
        reasoning: 'Keyword-based fallback classification (service business indicators detected)'
      };
    }

    // Physical business indicators
    const strongPhysicalKeywords = ['open', 'launch', 'restaurant', 'cafe', 'coffee', 'retail', 'gym', 'office'];
    if (strongPhysicalKeywords.some(kw => input.includes(kw)) || hasPhysicalIndicators) {
      return {
        initiativeType: 'physical_business_launch',
        description: 'Physical business or location launch',
        confidence: 0.6,
        reasoning: 'Keyword-based fallback classification (physical business indicators detected)'
      };
    }

    // Software development indicators (check after service to avoid misclassification)
    const softwareKeywords = ['app', 'software', 'saas', 'website', 'system', 'code', 'develop', 'build', 'api', 'mobile'];
    const hasSoftwareIndicators = softwareKeywords.some(kw => input.includes(kw));

    // Check for platform in non-software context
    const hasPlatformKeyword = input.includes('platform');

    // Only classify as software if it has software indicators AND either:
    // 1. No service indicators, OR
    // 2. Platform is mentioned WITH other software keywords
    if (hasSoftwareIndicators && !hasServiceIndicators) {
      return {
        initiativeType: 'software_development',
        description: 'Software or technical product development',
        confidence: 0.6,
        reasoning: 'Keyword-based fallback classification (software development indicators detected)'
      };
    }

    // Platform alone without other software keywords -> likely a marketplace/service
    if (hasPlatformKeyword && !hasSoftwareIndicators) {
      return {
        initiativeType: 'service_launch',
        description: 'Platform or marketplace service',
        confidence: 0.5,
        reasoning: 'Keyword-based fallback classification (platform service indicators detected)'
      };
    }
    
    // Digital transformation indicators
    const digitalKeywords = ['digital', 'online', 'e-commerce', 'modernize', 'automate', 'cloud', 'transform'];
    if (digitalKeywords.some(kw => input.includes(kw))) {
      return {
        initiativeType: 'digital_transformation',
        description: 'Digital transformation or modernization',
        confidence: 0.6,
        reasoning: 'Keyword-based fallback classification (digital transformation indicators detected)'
      };
    }
    
    // Market expansion indicators
    const expansionKeywords = ['expand', 'new market', 'international', 'region', 'geography', 'enter', 'penetrate'];
    if (expansionKeywords.some(kw => input.includes(kw))) {
      return {
        initiativeType: 'market_expansion',
        description: 'Market or geographic expansion',
        confidence: 0.6,
        reasoning: 'Keyword-based fallback classification (market expansion indicators detected)'
      };
    }
    
    // Default to 'other' when no clear indicators
    return {
      initiativeType: 'other',
      description: 'General business initiative',
      confidence: 0.3,
      reasoning: 'Keyword-based fallback classification (no clear category indicators)'
    };
  }
}
