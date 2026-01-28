import { SourceValidator, type ValidationResult } from './source-validator';
import type { Finding, Source } from './market-researcher';
import type { BMCBlockType } from './bmc-query-generator';

export interface BMCValidationResult extends ValidationResult {
  blockType: BMCBlockType;
  blockSpecificIssues: string[];
}

export class BMCValidator extends SourceValidator {
  async validateBMCFindings(
    findings: Finding[],
    sources: Source[],
    blockType: BMCBlockType
  ): Promise<BMCValidationResult[]> {
    const baseValidation = await this.validateFindings(findings, sources);

    const bmcValidation = baseValidation.map((validation) => {
      const blockIssues = this.checkBlockSpecificCriteria(
        validation.claim,
        blockType,
        validation
      );

      return {
        ...validation,
        blockType,
        blockSpecificIssues: blockIssues,
      };
    });

    return bmcValidation;
  }

  private checkBlockSpecificCriteria(
    claim: string,
    blockType: BMCBlockType,
    validation: ValidationResult
  ): string[] {
    const issues: string[] = [];

    switch (blockType) {
      case 'customer_segments':
        issues.push(...this.validateCustomerSegments(claim, validation));
        break;
      case 'value_propositions':
        issues.push(...this.validateValuePropositions(claim, validation));
        break;
      case 'revenue_streams':
        issues.push(...this.validateRevenueStreams(claim, validation));
        break;
    }

    return issues;
  }

  private validateCustomerSegments(claim: string, validation: ValidationResult): string[] {
    const issues: string[] = [];

    const hasDemographics = /\b(age|gender|income|education|location|region)\b/i.test(claim);
    const hasFirmographics = /\b(company size|industry|revenue|employees|B2B|enterprise|SMB|SME)\b/i.test(claim);
    const hasPainPoints = /\b(pain|problem|challenge|struggle|need|issue|frustration)\b/i.test(claim);
    const hasQuantitativeData = /\d+%|\d+\s*(million|billion|thousand)|\$\d+/i.test(claim);

    if (!hasDemographics && !hasFirmographics) {
      issues.push('Missing specific customer characteristics (demographics or firmographics)');
    }

    if (!hasPainPoints) {
      issues.push('Missing customer pain points or needs');
    }

    if (!hasQuantitativeData && validation.strength === 'STRONG') {
      issues.push('Consider adding quantitative market sizing or segment data');
    }

    if (validation.sourceCount < 2) {
      issues.push('Customer segment claims need multiple source validation');
    }

    return issues;
  }

  private validateValuePropositions(claim: string, validation: ValidationResult): string[] {
    const issues: string[] = [];

    const hasBenefits = /\b(benefit|advantage|value|outcome|result|improves|reduces|increases)\b/i.test(claim);
    const hasDifferentiation = /\b(unique|different|competitive advantage|differentiat|only|exclusively|unlike)\b/i.test(claim);
    const hasFeatures = /\b(feature|functionality|capability|offers|provides|includes)\b/i.test(claim);
    const hasCustomerValue = /\b(customer|user|buyer|client|helps|solves|addresses)\b/i.test(claim);

    if (!hasBenefits && !hasCustomerValue) {
      issues.push('Missing clear customer benefits or value');
    }

    if (!hasDifferentiation) {
      issues.push('Missing differentiation from alternatives');
    }

    if (hasFeatures && !hasBenefits) {
      issues.push('Features mentioned without linking to benefits');
    }

    if (validation.hasCounterEvidence) {
      issues.push('Conflicting evidence on value proposition - verify differentiation claims');
    }

    return issues;
  }

  private validateRevenueStreams(claim: string, validation: ValidationResult): string[] {
    const issues: string[] = [];

    const hasPricingModel = /\b(subscription|license|usage-based|transaction|freemium|tiered|per-seat|SaaS|one-time|recurring)\b/i.test(claim);
    const hasPricePoints = /\$\d+|\d+\s*(dollars|USD|EUR)|price|pricing|cost|fee/i.test(claim);
    const hasMonetization = /\b(revenue|monetiz|payment|billing|pricing strategy)\b/i.test(claim);
    const hasMarketData = /\b(willingness to pay|price sensitivity|market rate|competitive pricing|benchmark)\b/i.test(claim);

    if (!hasPricingModel && !hasMonetization) {
      issues.push('Missing clear pricing or monetization model');
    }

    if (!hasPricePoints && validation.strength === 'STRONG') {
      issues.push('Missing specific price points or ranges');
    }

    if (!hasMarketData) {
      issues.push('Consider adding market pricing data or customer willingness to pay');
    }

    if (validation.recencyMonths > 12) {
      issues.push('Pricing data is >12 months old - verify current market rates');
    }

    if (validation.sourceCount < 2) {
      issues.push('Revenue model claims need multiple source validation');
    }

    return issues;
  }

  async validateAllBlocks(
    customerFindings: Finding[],
    valueFindings: Finding[],
    revenueFindings: Finding[],
    sources: Source[]
  ): Promise<{
    customer_segments: BMCValidationResult[];
    value_propositions: BMCValidationResult[];
    revenue_streams: BMCValidationResult[];
  }> {
    const [customerValidation, valueValidation, revenueValidation] = await Promise.all([
      this.validateBMCFindings(customerFindings, sources, 'customer_segments'),
      this.validateBMCFindings(valueFindings, sources, 'value_propositions'),
      this.validateBMCFindings(revenueFindings, sources, 'revenue_streams'),
    ]);

    return {
      customer_segments: customerValidation,
      value_propositions: valueValidation,
      revenue_streams: revenueValidation,
    };
  }
}
