import type { FrameworkExecutor } from '../framework-executor-registry';
import type { StrategicContext, FrameworkName } from '@shared/journey-types';

/**
 * Stub Executor Factory
 * Creates placeholder executors for frameworks not yet implemented
 * These validate inputs but throw on execute, making it clear they need implementation
 */
export function createStubExecutor(name: FrameworkName, displayName: string): FrameworkExecutor {
  return {
    name,
    
    async validate(context: StrategicContext) {
      return {
        valid: !!context.userInput,
        errors: context.userInput ? undefined : ['Business challenge/input is required'],
      };
    },
    
    async execute(_context: StrategicContext) {
      throw new Error(`${displayName} executor not yet implemented. Framework '${name}' is registered but awaiting full implementation.`);
    },
  };
}
