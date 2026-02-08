import { describe, expect, it } from 'vitest';
import { StrategySignalExtractor } from '../src/lib/intelligent-planning/wbs-builder/analyzers/strategy-signal-extractor';
import { StrategyProfiler } from '../src/lib/intelligent-planning/wbs-builder/analyzers/strategy-profiler';

function insight(content: string, category = 'key_activities') {
  return {
    content,
    metadata: { category },
    source: category,
  };
}

describe('StrategySignalExtractor platform inference guardrails', () => {
  it('does not infer platform build from a single ambiguous platform mention in service-launch context', () => {
    const insights = {
      insights: [
        insight('Launch consulting and implementation services for agentic AI transformation'),
        insight('Create reusable platform capabilities to support delivery quality', 'key_resources'),
      ],
    };

    const signals = StrategySignalExtractor.extract(insights, {
      business: {
        type: 'consulting_agency',
        initiativeType: 'service_launch',
        description: 'Professional services business',
      },
    });
    const profile = StrategyProfiler.buildProfile(signals);

    expect(signals.platformNeeds).toHaveLength(0);
    expect(StrategySignalExtractor.needsPlatform(signals)).toBe(false);
    expect(profile.needsPlatform).toBe(false);
  });

  it('infers platform build when software product intent is explicit', () => {
    const insights = {
      insights: [
        insight('Build a SaaS platform product for autonomous workflow orchestration', 'key_activities'),
        insight('Monetize through subscription revenue and platform transaction fees', 'revenue_streams'),
        insight('Core resources include software architecture, APIs, and engineering teams', 'key_resources'),
      ],
    };

    const signals = StrategySignalExtractor.extract(insights, {
      business: {
        type: 'saas_platform',
        initiativeType: 'software_development',
      },
    });
    const profile = StrategyProfiler.buildProfile(signals);

    expect(signals.platformNeeds.length).toBeGreaterThan(0);
    expect(StrategySignalExtractor.needsPlatform(signals)).toBe(true);
    expect(profile.needsPlatform).toBe(true);
  });

  it('treats operational software mentions as tooling, not product-platform build', () => {
    const insights = {
      insights: [
        insight('Implement internal software tools for CRM and workflow automation to improve project delivery', 'key_activities'),
        insight('Use digital channels for lead capture and client onboarding', 'channels'),
      ],
    };

    const signals = StrategySignalExtractor.extract(insights, {
      business: {
        type: 'implementation_services',
        initiativeType: 'service_launch',
      },
    });

    expect(signals.platformNeeds).toHaveLength(0);
    expect(signals.platformOperationalSignals.length).toBeGreaterThan(0);
    expect(StrategySignalExtractor.needsPlatform(signals)).toBe(false);
  });
});
