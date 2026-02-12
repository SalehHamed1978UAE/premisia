import { BaseValidator, ValidatorContext, ValidatorIssue, ValidatorResult } from './base-validator';

export class IndustryValidator extends BaseValidator {
  readonly name = 'IndustryValidator';
  readonly description = 'Detects cross-industry template contamination in workstreams';
  
  private industryKeywords: Record<string, string[]> = {
    food_service: ['food safety', 'kitchen', 'restaurant', 'menu', 'chef', 'dining', 'catering', 'culinary', 'food handling', 'haccp'],
    healthcare: ['hipaa', 'patient', 'clinical', 'medical', 'healthcare', 'pharmacy', 'hospital', 'diagnosis', 'treatment'],
    finance: ['banking', 'trading', 'securities', 'investment', 'loan', 'credit', 'forex', 'asset management'],
    manufacturing: ['assembly line', 'production floor', 'quality control', 'lean manufacturing', 'six sigma', 'warehouse'],
    retail: ['inventory', 'point of sale', 'merchandising', 'storefront', 'e-commerce', 'fulfillment'],
    technology: ['software development', 'devops', 'api', 'database', 'cloud', 'agile', 'sprint'],
    education: ['curriculum', 'enrollment', 'student', 'faculty', 'academic', 'campus'],
    construction: ['site safety', 'building permit', 'contractor', 'blueprints', 'construction site'],
    hospitality: ['hotel', 'guest services', 'booking', 'concierge', 'housekeeping'],
    transportation: ['logistics', 'fleet management', 'route optimization', 'cargo', 'freight'],
  };
  
  validate(context: ValidatorContext): ValidatorResult {
    const issues: ValidatorIssue[] = [];
    const { workstreams, businessContext } = context;
    
    if (!businessContext) {
      return this.createResult(true, [], [], { skipped: true, reason: 'No business context provided' });
    }
    
    const contextLower = businessContext.toLowerCase();
    const detectedIndustries: string[] = [];

    // Detect industries from businessContext classification
    for (const [industry, keywords] of Object.entries(this.industryKeywords)) {
      if (keywords.some(kw => contextLower.includes(kw))) {
        detectedIndustries.push(industry);
      }
    }

    // Sprint 6: Also detect industries from workstream content itself
    // If 3+ keywords from an industry appear across workstreams, it's the user's domain
    const allWsContent = workstreams.map(ws => `${ws.name} ${ws.description || ''}`).join(' ').toLowerCase();
    for (const [industry, keywords] of Object.entries(this.industryKeywords)) {
      if (detectedIndustries.includes(industry)) continue;
      const hitCount = keywords.filter(kw => allWsContent.includes(kw)).length;
      if (hitCount >= 3) {
        detectedIndustries.push(industry);
      }
    }
    
    for (const workstream of workstreams) {
      const wsContent = `${workstream.name} ${workstream.description || ''}`.toLowerCase();
      
      for (const [industry, keywords] of Object.entries(this.industryKeywords)) {
        if (detectedIndustries.includes(industry)) continue;
        
        const matchedKeyword = keywords.find(kw => wsContent.includes(kw));
        if (matchedKeyword) {
          issues.push(this.createIssue(
            'warning',
            'INDUSTRY_MISMATCH',
            `Workstream "${workstream.name}" contains "${matchedKeyword}" (${industry} industry term)`,
            {
              workstreamId: workstream.id,
              suggestion: `Review if this workstream is appropriate for your business context: ${businessContext}`,
            }
          ));
        }
      }
    }
    
    return this.createResult(
      true,
      issues,
      [],
      {
        detectedIndustries,
        workstreamsChecked: workstreams.length,
        mismatches: issues.length,
      }
    );
  }
}
