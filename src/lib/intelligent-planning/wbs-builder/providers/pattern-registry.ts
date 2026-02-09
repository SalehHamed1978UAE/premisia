/**
 * Pattern Registry - Plugin system for work breakdown patterns
 * Allows extensible addition of new initiative type patterns
 */

import { IPatternPlugin, InitiativeType } from '../interfaces';

export class PatternRegistry {
  private patterns = new Map<InitiativeType, IPatternPlugin>();
  
  /**
   * Register a pattern plugin
   */
  register(plugin: IPatternPlugin): void {
    if (this.patterns.has(plugin.type)) {
      console.warn(`[Pattern Registry] Overwriting existing pattern: ${plugin.type}`);
    }
    
    this.patterns.set(plugin.type, plugin);
    console.log(`[Pattern Registry] Registered pattern: ${plugin.type} (${plugin.name})`);
  }
  
  /**
   * Get pattern plugin by initiative type
   */
  getPattern(type: InitiativeType): IPatternPlugin | undefined {
    return this.patterns.get(type);
  }
  
  /**
   * Get all registered patterns
   */
  getAllPatterns(): IPatternPlugin[] {
    return Array.from(this.patterns.values());
  }
  
  /**
   * Check if pattern exists for initiative type
   */
  hasPattern(type: InitiativeType): boolean {
    return this.patterns.has(type);
  }
  
  /**
   * Get list of registered initiative types
   */
  getRegisteredTypes(): InitiativeType[] {
    return Array.from(this.patterns.keys());
  }
}
