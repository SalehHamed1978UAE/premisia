/**
 * WBS Pipeline - Orchestrates sequential execution of analysis stages
 * Each stage can validate its input before processing
 */

import { IPipelineStage } from '../interfaces';

export class WBSPipeline {
  private stages: IPipelineStage[] = [];
  
  /**
   * Add a processing stage to the pipeline
   * Stages execute in the order they are added
   */
  addStage(stage: IPipelineStage): this {
    this.stages.push(stage);
    console.log(`[WBS Pipeline] Added stage: ${stage.name}`);
    return this;
  }
  
  /**
   * Execute all stages in sequence
   * Each stage receives the output of the previous stage
   * Optional validation runs before processing
   */
  async execute<T>(input: any): Promise<T> {
    let result = input;
    
    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];
      console.log(`[WBS Pipeline] Executing stage ${i + 1}/${this.stages.length}: ${stage.name}`);
      
      // Run optional validation before processing
      if (stage.validate) {
        const isValid = await stage.validate(result);
        if (!isValid) {
          throw new Error(`Validation failed at stage: ${stage.name}`);
        }
        console.log(`[WBS Pipeline] ✓ Validation passed for stage: ${stage.name}`);
      }
      
      // Process the input
      const startTime = Date.now();
      result = await stage.process(result);
      const duration = Date.now() - startTime;
      
      console.log(`[WBS Pipeline] ✓ Stage completed: ${stage.name} (${duration}ms)`);
    }
    
    console.log(`[WBS Pipeline] Pipeline execution complete`);
    return result as T;
  }
  
  /**
   * Get number of stages in the pipeline
   */
  get stageCount(): number {
    return this.stages.length;
  }
  
  /**
   * Get names of all stages
   */
  get stageNames(): string[] {
    return this.stages.map(s => s.name);
  }
}
