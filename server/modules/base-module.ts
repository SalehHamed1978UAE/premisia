/**
 * BASE MODULE
 * Abstract base class that all modules must extend.
 * Provides consistent interface, validation, logging, and error handling.
 */

import { MODULE_DATA_TYPES, type ModuleDataType } from '@shared/module-types';

export interface ModuleExecutionContext {
  sessionId?: string;
  understandingId?: string;
  userId?: string;
  journeySessionId?: string;
}

export interface ModuleResult<T> {
  success: boolean;
  output?: T;
  error?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export abstract class BaseModule<TInput = unknown, TOutput = unknown> {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly inputType: ModuleDataType | 'any';
  abstract readonly outputType: ModuleDataType | 'any';

  protected validateInput(input: unknown): TInput {
    if (this.inputType === 'any') {
      return input as TInput;
    }

    const typeConfig = MODULE_DATA_TYPES[this.inputType as ModuleDataType];
    if (!typeConfig) {
      console.warn(`[${this.id}] Unknown input type: ${this.inputType}, skipping validation`);
      return input as TInput;
    }

    try {
      return typeConfig.schema.parse(input) as TInput;
    } catch (error) {
      console.error(`[${this.id}] Input validation failed:`, error);
      throw new Error(`Input validation failed for ${this.id}: ${error}`);
    }
  }

  protected validateOutput(output: unknown): TOutput {
    if (this.outputType === 'any') {
      return output as TOutput;
    }

    const typeConfig = MODULE_DATA_TYPES[this.outputType as ModuleDataType];
    if (!typeConfig) {
      console.warn(`[${this.id}] Unknown output type: ${this.outputType}, skipping validation`);
      return output as TOutput;
    }

    try {
      return typeConfig.schema.parse(output) as TOutput;
    } catch (error) {
      console.error(`[${this.id}] Output validation failed:`, error);
      throw new Error(`Output validation failed for ${this.id}: ${error}`);
    }
  }

  abstract execute(input: TInput, context?: ModuleExecutionContext): Promise<TOutput>;

  async run(rawInput: unknown, context?: ModuleExecutionContext): Promise<ModuleResult<TOutput>> {
    const startTime = Date.now();
    console.log(`[${this.id}] Starting execution...`);

    try {
      const validatedInput = this.validateInput(rawInput);

      const output = await this.execute(validatedInput, context);

      const validatedOutput = this.validateOutput(output);

      const duration = Date.now() - startTime;
      console.log(`[${this.id}] Completed in ${duration}ms`);

      return {
        success: true,
        output: validatedOutput,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${this.id}] Execution failed after ${duration}ms:`, errorMessage);

      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }
}

export type { ModuleDataType };
