import { BaseValidator, ValidatorContext, ValidatorResult, ValidatorIssue } from './base-validator';

export interface QualityReport {
  overallPassed: boolean;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  validatorResults: ValidatorResult[];
  corrections: string[];
  timestamp: Date;
  durationMs: number;
}

export class ValidatorRegistry {
  private validators: Map<string, BaseValidator> = new Map();
  
  register(validator: BaseValidator): void {
    if (this.validators.has(validator.name)) {
      console.warn(`[ValidatorRegistry] Validator "${validator.name}" already registered, overwriting`);
    }
    this.validators.set(validator.name, validator);
    console.log(`[ValidatorRegistry] Registered validator: ${validator.name}`);
  }
  
  unregister(name: string): boolean {
    return this.validators.delete(name);
  }
  
  get(name: string): BaseValidator | undefined {
    return this.validators.get(name);
  }
  
  list(): string[] {
    return Array.from(this.validators.keys());
  }
  
  runAll(context: ValidatorContext): QualityReport {
    const startTime = Date.now();
    const validatorResults: ValidatorResult[] = [];
    const allCorrections: string[] = [];
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    
    for (const [name, validator] of Array.from(this.validators.entries())) {
      try {
        const result = validator.validate(context);
        validatorResults.push(result);
        allCorrections.push(...result.corrections);
        
        for (const issue of result.issues) {
          switch (issue.severity) {
            case 'error': errorCount++; break;
            case 'warning': warningCount++; break;
            case 'info': infoCount++; break;
          }
        }
      } catch (err) {
        console.error(`[ValidatorRegistry] Validator "${name}" threw error:`, err);
        validatorResults.push({
          validatorName: name,
          passed: false,
          issues: [{
            severity: 'error',
            code: 'VALIDATOR_ERROR',
            message: `Validator threw exception: ${err instanceof Error ? err.message : String(err)}`,
          }],
          corrections: [],
        });
        errorCount++;
      }
    }
    
    return {
      overallPassed: errorCount === 0,
      totalIssues: errorCount + warningCount + infoCount,
      errorCount,
      warningCount,
      infoCount,
      validatorResults,
      corrections: allCorrections,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
  
  runSelected(context: ValidatorContext, validatorNames: string[]): QualityReport {
    const startTime = Date.now();
    const validatorResults: ValidatorResult[] = [];
    const allCorrections: string[] = [];
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    
    for (const name of validatorNames) {
      const validator = this.validators.get(name);
      if (!validator) {
        validatorResults.push({
          validatorName: name,
          passed: false,
          issues: [{
            severity: 'error',
            code: 'VALIDATOR_NOT_FOUND',
            message: `Validator "${name}" not registered`,
          }],
          corrections: [],
        });
        errorCount++;
        continue;
      }
      
      try {
        const result = validator.validate(context);
        validatorResults.push(result);
        allCorrections.push(...result.corrections);
        
        for (const issue of result.issues) {
          switch (issue.severity) {
            case 'error': errorCount++; break;
            case 'warning': warningCount++; break;
            case 'info': infoCount++; break;
          }
        }
      } catch (err) {
        console.error(`[ValidatorRegistry] Validator "${name}" threw error:`, err);
        validatorResults.push({
          validatorName: name,
          passed: false,
          issues: [{
            severity: 'error',
            code: 'VALIDATOR_ERROR',
            message: `Validator threw exception: ${err instanceof Error ? err.message : String(err)}`,
          }],
          corrections: [],
        });
        errorCount++;
      }
    }
    
    return {
      overallPassed: errorCount === 0,
      totalIssues: errorCount + warningCount + infoCount,
      errorCount,
      warningCount,
      infoCount,
      validatorResults,
      corrections: allCorrections,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

export const validatorRegistry = new ValidatorRegistry();
