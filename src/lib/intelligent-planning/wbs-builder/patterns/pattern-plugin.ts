/**
 * Base Pattern Plugin - Abstract base class for pattern plugins
 */

import { IPatternPlugin, BusinessIntent, WorkStreamPattern, WorkStream, InitiativeType } from '../interfaces';

export abstract class PatternPlugin implements IPatternPlugin {
  abstract type: InitiativeType;
  abstract name: string;
  
  /**
   * Analyze business intent and generate work stream pattern
   * Must be implemented by concrete pattern classes
   */
  abstract analyze(context: BusinessIntent): Promise<WorkStreamPattern>;
  
  /**
   * Validate generated work streams
   * Default implementation checks total effort allocation
   */
  async validate(streams: WorkStream[]): Promise<boolean> {
    const totalEffort = streams.reduce((sum, s) => sum + s.proportionalEffort, 0);
    
    // Allow 5% tolerance
    const isValid = Math.abs(totalEffort - 100) <= 5;
    
    if (!isValid) {
      console.error(`[${this.name}] Validation failed: total effort = ${totalEffort}%, expected ~100%`);
    }
    
    return isValid;
  }
}
