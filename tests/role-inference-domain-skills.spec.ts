import { describe, expect, it } from 'vitest';
import { inferSkillsFromCategory } from '../server/intelligence/epm/role-inference';

describe('Role inference domain-aware skills', () => {
  it('does not leak restaurant skills into technology programs', () => {
    const context = {
      industry: 'Technology',
      businessType: 'AI SaaS Platform',
      initiativeType: 'service_launch',
      programName: 'Launch AI consultancy platform',
    };

    const techSkills = inferSkillsFromCategory('technology', context);
    const complianceSkills = inferSkillsFromCategory('compliance', context);

    expect(techSkills.join(' ').toLowerCase()).not.toContain('pos');
    expect(complianceSkills.join(' ').toLowerCase()).not.toContain('food safety');
    expect(complianceSkills.join(' ').toLowerCase()).not.toContain('health inspection');
  });

  it('retains food-service-specific skills for restaurant contexts', () => {
    const context = {
      industry: 'Food Service',
      businessType: 'Thai Cafe',
      initiativeType: 'market_entry',
      programName: 'Open authentic thai cafe',
    };

    const techSkills = inferSkillsFromCategory('technology', context);
    const complianceSkills = inferSkillsFromCategory('compliance', context);

    expect(techSkills.join(' ').toLowerCase()).toContain('pos');
    expect(complianceSkills.join(' ').toLowerCase()).toContain('food safety');
  });
});

