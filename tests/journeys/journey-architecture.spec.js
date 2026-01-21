/**
 * Journey Architecture Integrity Tests
 * Fails build if someone hardcodes journey-specific logic in shared components
 */

const fs = require('fs');
const path = require('path');

describe('Journey Architecture Integrity', () => {

  it('ResearchExperience should not hardcode Porter categories', () => {
    const filePath = 'client/src/components/research-experience/ResearchExperience.tsx';
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf8');
    const porterCategories = ['market_dynamics', 'competitive_landscape', 'buyer_behavior'];

    for (const cat of porterCategories) {
      if (content.includes(`"${cat}"`) || content.includes(`'${cat}'`)) {
        throw new Error(
          `Found hardcoded Porter's category "${cat}" in shared component.\n` +
          `This breaks BMC journeys. Move to PortersResearchExperience.tsx.`
        );
      }
    }
  });

  it('strategic-consultant.ts should use getNextPage for routing', () => {
    const filePath = 'server/routes/strategic-consultant.ts';
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf8');

    if (/nextUrl:\s*[`'"]\/strategy-workspace/.test(content) && !content.includes('getNextPage')) {
      throw new Error(
        `Found hardcoded nextUrl in strategic-consultant.ts.\n` +
        `Use getNextPage() from journey-registry.ts instead.`
      );
    }
  });

  it('journey-registry.ts should exist and define BMC journey', () => {
    const filePath = 'server/journey/journey-registry.ts';
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('business_model_innovation');
    expect(content).toContain('bmc');
  });
});
