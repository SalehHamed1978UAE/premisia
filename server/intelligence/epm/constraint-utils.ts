export type UserConstraints = {
  budget?: { min: number; max: number };
  timeline?: { min: number; max: number };
};

const TIMELINE_CONTEXT_PATTERN =
  /(?:timeline|runway|over|within|for\s+first|for)\s*[^\n]{0,60}?(\d+)(?:\s*(?:-|to)\s*(\d+))?\s*(months?|mo|years?|yrs?|quarters?|qtrs?)/i;
const CURRENCY_BUDGET_PATTERN =
  /(?:budget|funding|investment|spend|allocation|runway)[^$\n]{0,80}\$\s*\d+(?:\.\d+)?\s*(?:million|mil|m|k|thousand)?(?:\s*(?:-|to)\s*\$\s*\d+(?:\.\d+)?\s*(?:million|mil|m|k|thousand)?)?/i;
const PLAIN_BUDGET_PATTERN =
  /(?:budget|funding|investment|spend|allocation|runway)[^$\n]{0,80}\b\d+(?:\.\d+)?\s*(?:million|mil|k|thousand)\b(?:\s*(?:-|to)\s*\b\d+(?:\.\d+)?\s*(?:million|mil|k|thousand)\b)?/i;
const BUDGET_SIGNAL_PATTERN =
  /(?:budget|funding|investment|spend|allocation|runway|cost\s*cap|max(?:imum)?|cap|limit)[^$\n]{0,80}\$?\s*\d+(?:\.\d+)?\s*(?:million|mil|m|k|thousand|billion|bn)?/i;
const DOLLAR_TIMELINE_SIGNAL_PATTERN =
  /\$\s*\d+(?:\.\d+)?\s*(?:million|mil|m|k|thousand|billion|bn)?\s*(?:over|within|for)\s*\d+\s*(?:months?|mo|years?|yrs?|quarters?|qtrs?)/i;
const DISCOVERY_OPT_OUT_PATTERN =
  /\b(no\s+budget|without\s+budget|help\s+me\s+discover\s+costs|discover\s+costs|cost\s+discovery)\b/i;
const EXPLICIT_LIMIT_SIGNAL_PATTERN =
  /(?:max(?:imum)?|cap|limit|ceiling|at\s+most|up\s+to)[^$\n]{0,40}\$?\s*\d+(?:\.\d+)?\s*(?:million|mil|m|k|thousand|billion|bn)?|\$\s*\d+(?:\.\d+)?\s*(?:million|mil|m|k|thousand|billion|bn)?[^$\n]{0,40}(?:max(?:imum)?|cap|limit|ceiling|at\s+most|up\s+to)/i;

function findTimelineInput(rawInput: string): string | undefined {
  return rawInput.match(TIMELINE_CONTEXT_PATTERN)?.[0];
}

function findBudgetInput(
  rawInput: string,
  timelineInput?: string,
  fallbackBudget?: string
): string | undefined {
  const budgetSearchInput = timelineInput ? rawInput.replace(timelineInput, '') : rawInput;
  const budgetContextMatch = budgetSearchInput.match(CURRENCY_BUDGET_PATTERN)
    || budgetSearchInput.match(PLAIN_BUDGET_PATTERN);
  return budgetContextMatch?.[0] || fallbackBudget;
}

export function hasBudgetConstraintSignal(
  rawInput: string,
  fallbackBudget?: string
): boolean {
  const input = rawInput || '';
  const timelineInput = findTimelineInput(input);
  const budgetInput = findBudgetInput(input, timelineInput, fallbackBudget);
  const hasDiscoveryOptOut = DISCOVERY_OPT_OUT_PATTERN.test(input);
  const hasExplicitLimitSignal = EXPLICIT_LIMIT_SIGNAL_PATTERN.test(input);

  if (hasDiscoveryOptOut && !hasExplicitLimitSignal) {
    return false;
  }

  if (budgetInput) return true;
  return BUDGET_SIGNAL_PATTERN.test(input) || DOLLAR_TIMELINE_SIGNAL_PATTERN.test(input);
}

export function extractUserConstraintsFromText(
  rawInput: string,
  fallbackBudget?: string
): UserConstraints {
  const constraints: UserConstraints = {};
  const input = rawInput || '';
  const hasDiscoveryOptOut = DISCOVERY_OPT_OUT_PATTERN.test(input);
  const hasExplicitLimitSignal = EXPLICIT_LIMIT_SIGNAL_PATTERN.test(input);

  console.log('[Constraints] Parsing USER constraints from input...');

  const timelineInput = findTimelineInput(input);
  let budgetInput = findBudgetInput(input, timelineInput, fallbackBudget);
  if (hasDiscoveryOptOut && !hasExplicitLimitSignal) {
    budgetInput = undefined;
  }
  if (!budgetInput && hasBudgetConstraintSignal(input, fallbackBudget)) {
    // Fallback to full text parsing when a budget signal exists but doesn't match strict context extraction.
    budgetInput = input;
  }

  if (budgetInput) {
    console.log(`[Constraints] Found user budget input: "${budgetInput}"`);

    const rangeWithDollar = /\$\s*(\d+(?:\.\d+)?)\s*(million|mil|m|k|thousand)?\s*(?:-|to)\s*\$\s*(\d+(?:\.\d+)?)\s*(million|mil|m|k|thousand)?/i;
    const singleWithDollar = /\$\s*(\d+(?:\.\d+)?)\s*(million|mil|m|k|thousand)?/i;
    const rangeWithUnit = /\b(\d+(?:\.\d+)?)\s*(million|mil|k|thousand)\b\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(million|mil|k|thousand)\b/i;
    const singleWithUnit = /\b(\d+(?:\.\d+)?)\s*(million|mil|k|thousand)\b/i;

    const match = budgetInput.match(rangeWithDollar)
      || budgetInput.match(rangeWithUnit)
      || budgetInput.match(singleWithDollar)
      || budgetInput.match(singleWithUnit);

    if (match) {
      const hasDollar = match[0].includes('$');
      let minBudget = parseFloat(match[1]);
      let maxBudget = match[3] ? parseFloat(match[3]) : minBudget;
      const unitToken = (match[2] || match[4] || '').toLowerCase();

      const isMillions = unitToken === 'million' || unitToken === 'mil' || (hasDollar && unitToken === 'm');
      const isThousands = unitToken === 'k' || unitToken === 'thousand';

      if (isMillions) {
        minBudget *= 1_000_000;
        maxBudget *= 1_000_000;
      } else if (isThousands) {
        minBudget *= 1_000;
        maxBudget *= 1_000;
      }

      constraints.budget = { min: minBudget, max: maxBudget };
      console.log(`[Constraints] ✓ Parsed user budget: $${minBudget.toLocaleString()} - $${maxBudget.toLocaleString()}`);
    } else {
      console.warn(`[Constraints] ⚠️  Could not parse budget from: "${budgetInput}"`);
    }
  } else {
    console.log('[Constraints] No budget constraint in user input');
  }

  if (timelineInput) {
    console.log(`[Constraints] Found user timeline input: "${timelineInput}"`);
    const timelinePattern = /(\d+)(?:\s*(?:-|to)\s*(\d+))?\s*(months?|mo|years?|yrs?|quarters?|qtrs?)/i;
    const timelineMatch = timelineInput.match(timelinePattern);

    if (timelineMatch) {
      let minMonths = parseInt(timelineMatch[1], 10);
      let maxMonths = timelineMatch[2] ? parseInt(timelineMatch[2], 10) : minMonths;
      const unit = timelineMatch[3].toLowerCase();

      if (unit.startsWith('year') || unit.startsWith('yr')) {
        minMonths *= 12;
        maxMonths *= 12;
      } else if (unit.startsWith('quarter') || unit.startsWith('qtr')) {
        minMonths *= 3;
        maxMonths *= 3;
      }

      constraints.timeline = { min: minMonths, max: maxMonths };
      console.log(`[Constraints] ✓ Parsed user timeline: ${minMonths}-${maxMonths} months`);
    } else {
      console.warn(`[Constraints] ⚠️  Could not parse timeline from: "${timelineInput}"`);
    }
  } else {
    console.log('[Constraints] No explicit timeline constraint found in user input');
  }

  return constraints;
}

export function deriveTeamSizeFromBudget(budget: { min: number; max: number }): { min: number; max: number } {
  const avgCost = (budget.min + budget.max) / 2;
  const teamSizeMin = Math.ceil(avgCost / 200_000);
  const teamSizeMax = Math.ceil(avgCost / 120_000);
  return { min: teamSizeMin, max: teamSizeMax };
}
