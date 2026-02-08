import { describe, expect, it } from 'vitest';
import { inferSkillsFromCategory } from '../server/intelligence/epm/role-inference';
import { buildEpmJsonPayload } from '../server/services/export/json-payloads';

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

  it('sanitizes leaked restaurant skills from resource plan during technology export build', () => {
    const payload = buildEpmJsonPayload({
      program: {
        workstreams: [],
        resourcePlan: {
          internalTeam: [
            { role: 'AI Compliance Specialist', skills: ['food safety', 'policy controls'] },
          ],
          externalResources: [],
        },
      },
      assignments: [],
    } as any, {
      understanding: {
        title: 'Launch AI Platform',
        initiativeDescription: 'Agentic AI SaaS platform',
      },
    } as any);

    const skills = payload.resourcePlan.internalTeam[0].skills.join(' ').toLowerCase();
    expect(skills).not.toContain('food safety');
    expect(skills).toContain('policy controls');
  });
});
