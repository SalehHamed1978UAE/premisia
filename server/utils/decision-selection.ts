/**
 * Decision selection normalization helpers.
 *
 * Normalizes strategic decision payloads coming from mixed sources:
 * - legacy `selectedDecisions` maps
 * - journey outputs with `value`
 * - decision options with `recommended=true`
 *
 * Goal: produce one canonical selected option id per decision.
 */

type DecisionOption = Record<string, any> & {
  id?: string;
  label?: string;
  name?: string;
  recommended?: boolean;
};

type DecisionItem = Record<string, any> & {
  id?: string;
  options?: DecisionOption[];
  selectedOptionId?: string;
  value?: any;
};

export interface DecisionSelectionMismatch {
  decisionId: string;
  fallbackOptionId?: string;
  resolvedOptionId?: string;
  reason: string;
}

export interface NormalizedDecisionSelection {
  decisions: DecisionItem[];
  selectedDecisions: Record<string, string>;
  mismatches: DecisionSelectionMismatch[];
  unresolvedDecisionIds: string[];
}

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .replace(/[\u2026…]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asDecisionArray(input: any): DecisionItem[] {
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return asDecisionArray(parsed);
    } catch {
      return [];
    }
  }
  if (Array.isArray(input)) return input as DecisionItem[];
  if (input && typeof input === 'object' && Array.isArray(input.decisions)) {
    return input.decisions as DecisionItem[];
  }
  return [];
}

function asSelectionMap(input: any): Record<string, string> {
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return asSelectionMap(parsed);
    } catch {
      return {};
    }
  }
  if (!input || typeof input !== 'object') return {};
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      map[key] = value;
    }
  }
  return map;
}

function ensureOptionIds(options: DecisionOption[]): DecisionOption[] {
  return options.map((option, index) => ({
    ...option,
    id: typeof option.id === 'string' && option.id.trim().length > 0
      ? option.id
      : `option_${index + 1}`,
  }));
}

function findOptionIdByValue(value: any, options: DecisionOption[]): string | undefined {
  if (!options.length) return undefined;

  if (value && typeof value === 'object') {
    if (typeof value.id === 'string' && options.some((opt) => opt.id === value.id)) {
      return value.id;
    }
    if (typeof value.label === 'string') {
      const labelNorm = normalizeText(value.label);
      const byLabel = options.find((opt) => normalizeText(opt.label || opt.name || '') === labelNorm);
      if (byLabel?.id) return byLabel.id;
    }
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const valueNorm = normalizeText(value);
  if (!valueNorm) return undefined;

  const exactById = options.find((opt) => normalizeText(opt.id || '') === valueNorm);
  if (exactById?.id) return exactById.id;

  const exactByLabel = options.find((opt) => normalizeText(opt.label || opt.name || '') === valueNorm);
  if (exactByLabel?.id) return exactByLabel.id;

  const looseByLabel = options.find((opt) => {
    const labelNorm = normalizeText(opt.label || opt.name || '');
    return labelNorm && (labelNorm.includes(valueNorm) || valueNorm.includes(labelNorm));
  });
  return looseByLabel?.id;
}

function resolveOptionId(
  decision: DecisionItem,
  options: DecisionOption[],
  fallbackSelectedId?: string
): { selectedOptionId?: string; reason?: string } {
  // Highest priority: explicit semantic value chosen for the decision.
  const fromValue = findOptionIdByValue(decision.value, options);
  if (fromValue) {
    return { selectedOptionId: fromValue, reason: 'value' };
  }

  // Next: explicit option id fields on the decision object.
  const explicitIds = [
    decision.selectedOptionId,
    decision.selected_option_id,
    decision.selectedOption?.id,
  ].filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  for (const explicitId of explicitIds) {
    if (options.some((opt) => opt.id === explicitId)) {
      return { selectedOptionId: explicitId, reason: 'explicit' };
    }
  }

  // Next: recommended flag from option list.
  const recommended = options.find((opt) => opt.recommended === true);
  if (recommended?.id) {
    return { selectedOptionId: recommended.id, reason: 'recommended' };
  }

  // Lowest priority: legacy fallback map.
  if (fallbackSelectedId && options.some((opt) => opt.id === fallbackSelectedId)) {
    return { selectedOptionId: fallbackSelectedId, reason: 'fallback' };
  }

  return {};
}

export function normalizeStrategicDecisions(
  decisionsInput: any,
  selectedDecisionsInput?: any
): NormalizedDecisionSelection {
  const decisions = asDecisionArray(decisionsInput);
  const fallbackMap = asSelectionMap(selectedDecisionsInput);

  const selectedDecisions: Record<string, string> = {};
  const mismatches: DecisionSelectionMismatch[] = [];
  const unresolvedDecisionIds: string[] = [];

  const normalizedDecisions = decisions.map((decision, index) => {
    const decisionId = typeof decision.id === 'string' && decision.id.trim().length > 0
      ? decision.id
      : `decision_${index + 1}`;
    const options = ensureOptionIds(Array.isArray(decision.options) ? decision.options : []);
    const fallbackSelectedId = fallbackMap[decisionId];
    const { selectedOptionId, reason } = resolveOptionId(decision, options, fallbackSelectedId);

    if (fallbackSelectedId && selectedOptionId && fallbackSelectedId !== selectedOptionId) {
      mismatches.push({
        decisionId,
        fallbackOptionId: fallbackSelectedId,
        resolvedOptionId: selectedOptionId,
        reason: `fallback overridden by ${reason || 'canonical resolution'}`,
      });
    }

    if (selectedOptionId) {
      selectedDecisions[decisionId] = selectedOptionId;
    } else {
      unresolvedDecisionIds.push(decisionId);
    }

    return {
      ...decision,
      id: decisionId,
      options,
      selectedOptionId,
    };
  });

  return {
    decisions: normalizedDecisions,
    selectedDecisions,
    mismatches,
    unresolvedDecisionIds,
  };
}
