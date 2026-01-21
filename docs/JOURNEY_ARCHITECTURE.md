# Journey Architecture - MANDATORY READING

> **If you're modifying journey, research, or framework code, READ THIS FIRST.**

## Source of Truth

| What | File |
|------|------|
| Journey Definitions | `server/journey/journey-registry.ts` |
| Module Execution | `server/journey/journey-orchestrator.ts` |
| Context Flow | `server/journey/strategic-context-accumulator.ts` |
| Module Bridges | `server/journey/bridges/*.ts` |
| Framework Executors | `server/journey/executors/*.ts` |

## The 6 Pre-Defined Journeys

| Journey Type | Module Sequence |
|--------------|-----------------|
| `business_model_innovation` | Five Whys → BMC |
| `market_entry` | PESTLE → Porter's → SWOT |
| `competitive_strategy` | Porter's → BMC → Blue Ocean |
| `digital_transformation` | PESTLE → BMC → Ansoff |
| `crisis_recovery` | Five Whys → SWOT → BMC |
| `growth_strategy` | PESTLE → Ansoff → BMC |

## Framework UI Components

Each framework has its OWN UI component. DO NOT share components.

| Framework | Categories/Blocks | UI Component |
|-----------|-------------------|--------------|
| BMC | 9 blocks: customer_segments, value_propositions, revenue_streams, channels, customer_relationships, key_resources, key_activities, key_partnerships, cost_structure | `BMCResearchExperience.tsx` |
| Porter's | 5 forces: market_dynamics, competitive_landscape, buyer_behavior, regulatory_factors, language_preferences | `PortersResearchExperience.tsx` |

## Rules (MUST FOLLOW)

### 1. Never Hardcode Journey Logic

```typescript
// ❌ WRONG - Hardcoded logic that WILL break
if (journeyType === 'business_model_innovation') {
  categories = ['customer_segments', ...];
} else {
  categories = ['market_dynamics', ...];
}

// ✅ CORRECT - Query the journey system
const journey = getJourneyByType(journeyType);
const currentFramework = journey.frameworks[currentFrameworkIndex];
```

### 2. Never Hardcode URLs

```typescript
// ❌ WRONG - Bypasses journey page sequence
nextUrl: `/strategy-workspace/decisions/${sessionId}/${version}`

// ✅ CORRECT - Use journey registry
import { getNextPage } from '../journey/journey-registry';
const nextUrl = getNextPage(journey, currentPage, { sessionId, version });
```

### 3. Keep Module UIs Separate

```typescript
// ❌ WRONG - One component trying to handle all frameworks
<ResearchExperience categories={hardcodedArray} />

// ✅ CORRECT - Each framework has its own component
if (currentFramework === 'bmc') {
  return <BMCResearchExperience />;
} else if (currentFramework === 'porters') {
  return <PortersResearchExperience />;
}
```

## Files That MUST Stay In Sync

1. `server/journey/journey-registry.ts` - Journey definitions
2. `client/src/pages/strategic-consultant/ResearchPage.tsx` - Journey type detection
3. `client/src/components/research-experience/*.tsx` - Module-specific UIs
4. `server/routes/strategic-consultant.ts` - SSE events and routing

## Before Merging ANY Journey Changes

```bash
npm run test:journeys
```

## Common Mistakes That Break Things

| Mistake | Why It Breaks | Fix |
|---------|---------------|-----|
| Hardcoding categories in ResearchExperience | BMC shows Porter's UI | Use separate components per framework |
| Hardcoding nextUrl in routes | Wrong page after research | Use getNextPage() |
| Sharing state between modules | Data doesn't flow correctly | Use context accumulator |
