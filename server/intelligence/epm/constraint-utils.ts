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
    /(?:budget|funding|investment|spend|allocation|runway)[^$\n]{0,60}\$\s*\d+(?:\.\d+)?\s*(?:million|mil|k|thousand)?(?:\s*(?:-|to)\s*\$\s*\d+(?:\.\d+)?\s*(?:million|mil|k|thousand)?)?/i;
  const plainBudgetPattern =
    /(?:budget|funding|investment|spend|allocation|runway)[^$\n]{0,60}\b\d+(?:\.\d+)?\s*(?:million|mil|k|thousand)\b(?:\s*(?:-|to)\s*\b\d+(?:\.\d+)?\s*(?:million|mil|k|thousand)\b)?/i;

  const budgetSearchInput = timelineInput ? input.replace(timelineInput, '') : input;
  const budgetContextMatch = budgetSearchInput.match(currencyBudgetPattern)
    || budgetSearchInput.match(plainBudgetPattern);
  const budgetInput = budgetContextMatch?.[0] || fallbackBudget;

  if (budgetInput) {
    console.log(`[Constraints] Found user budget input: "${budgetInput}"`);

    const budgetPattern =
      /\$?(\d+(?:\.\d+)?)\s*(?:million|mil|k|thousand)?\s*(?:-|to)?\s*(?:\$?(\d+(?:\.\d+)?))?\s*(?:million|mil|k|thousand)?/i;
    const budgetMatch = budgetInput.match(budgetPattern);

    if (budgetMatch) {
      let minBudget = parseFloat(budgetMatch[1]);
      let maxBudget = budgetMatch[2] ? parseFloat(budgetMatch[2]) : minBudget;

      const unitSegment = budgetInput.toLowerCase().substring(
        budgetMatch.index || 0,
        (budgetMatch.index || 0) + budgetMatch[0].length
      );
      const isMillions = /\b(million|mil)\b/.test(unitSegment);
      const isThousands = /\b(k|thousand)\b/.test(unitSegment);

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
