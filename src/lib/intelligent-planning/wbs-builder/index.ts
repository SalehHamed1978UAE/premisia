/**
 * WBS Builder - Public API
 * Factory function with dependency injection and pattern registration
 */

import { IWBSBuilder, ILLMProvider } from './interfaces';
import { WBSBuilder } from './core/wbs-builder';
import { BusinessAnalyzer } from './analyzers/business-analyzer';
import { PatternRegistry } from './providers/pattern-registry';
import { PatternProvider } from './providers/pattern-provider';
import { StreamOptimizer } from './optimizers/stream-optimizer';
import { SemanticValidator } from './validators/semantic-validator';
import { BusinessLaunchPattern } from './patterns/business-launch';
import { SoftwareDevelopmentPattern } from './patterns/software-development';

/**
 * Create WBS Builder with all dependencies configured
 * 
 * @param llm - LLM provider for AI-powered analysis
 * @returns Configured WBS Builder instance
 */
export function createWBSBuilder(llm: ILLMProvider): IWBSBuilder {
  console.log('[WBS Builder Factory] Creating WBS Builder...');
  
  // Create pattern registry and register patterns
  const registry = new PatternRegistry();
  
  // Register core patterns
  registry.register(new BusinessLaunchPattern());
  registry.register(new SoftwareDevelopmentPattern());
  
  // Easy to add more patterns in the future:
  // registry.register(new DigitalTransformationPattern());
  // registry.register(new MarketExpansionPattern());
  
  console.log(`[WBS Builder Factory] Registered ${registry.getAllPatterns().length} patterns`);
  
  // Create pipeline components with dependency injection
  const analyzer = new BusinessAnalyzer(llm);
  const patternProvider = new PatternProvider(registry, llm);
  const optimizer = new StreamOptimizer(llm);
  const validator = new SemanticValidator(llm);
  
  // Compose the WBS Builder
  const builder = new WBSBuilder(
    analyzer,
    patternProvider,
    optimizer,
    validator
  );
  
  console.log('[WBS Builder Factory] ✓ WBS Builder created');
  
  return builder;
}

// Re-export types for convenience
export * from './interfaces';
export * from './types';
