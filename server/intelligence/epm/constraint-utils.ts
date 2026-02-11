export type UserConstraints = {
  budget?: { min: number; max: number };
  timeline?: { min: number; max: number };
};

export function extractUserConstraintsFromText(
  rawInput: string,
  fallbackBudget?: string
): UserConstraints {
  const constraints: UserConstraints = {};
  const input = rawInput || '';

  console.log('[Constraints] Parsing USER constraints from input...');

  const timelineContextPattern =
    /(?:timeline|runway|over|within|for\s+first)[^\n]{0,60}?(\d+)(?:\s*(?:-|to)\s*(\d+))?\s*(months?|mo|years?|yrs?|quarters?|qtrs?)/i;
  const timelineContextMatch = input.match(timelineContextPattern);
  const timelineInput = timelineContextMatch?.[0];

  const currencyBudgetPattern =
    /(?:budget|funding|investment|spend|allocation|runway)[^$\n]{0,80}\$\s*\d+(?:\.\d+)?\s*(?:million|mil|m|k|thousand)?(?:\s*(?:-|to)\s*\$\s*\d+(?:\.\d+)?\s*(?:million|mil|m|k|thousand)?)?/i;
  const plainBudgetPattern =
    /(?:budget|funding|investment|spend|allocation|runway)[^$\n]{0,80}\b\d+(?:\.\d+)?\s*(?:million|mil|k|thousand)\b(?:\s*(?:-|to)\s*\b\d+(?:\.\d+)?\s*(?:million|mil|k|thousand)\b)?/i;

  const budgetSearchInput = timelineInput ? input.replace(timelineInput, '') : input;
  const budgetContextMatch = budgetSearchInput.match(currencyBudgetPattern)
    || budgetSearchInput.match(plainBudgetPattern);
  const budgetInput = budgetContextMatch?.[0] || fallbackBudget;

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
