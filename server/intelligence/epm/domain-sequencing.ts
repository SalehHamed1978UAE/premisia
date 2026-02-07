import type { Workstream } from '../types';

const RESTAURANT_DOMAIN_RE = /restaurant|cafe|café|kitchen|food|hospitality/i;
const CONSTRUCTION_RE = /construction|design|build|fit[\s-]?out|infrastructure|kitchen|renovat|site\s*prep|site\s*preparation/i;
const COMPLIANCE_RE = /regulatory|compliance|license|licensing|permit|food safety|health/i;
const TECHNOLOGY_RE = /technology|digital|pos|ordering|system/i;
const STAFF_RE = /staff|hr|training|recruit|talent|onboarding/i;
const MARKETING_RE = /marketing|brand|campaign|sales|promotion|audience/i;

function clampDueMonth(dueMonth: number, startMonth: number, endMonth: number): number {
  if (!Number.isFinite(dueMonth)) return endMonth;
  return Math.min(endMonth, Math.max(startMonth, dueMonth));
}

function findWindow(workstreams: Workstream[], pattern: RegExp): { ids: Set<string>; start: number; end: number } | null {
  const matches = workstreams.filter((ws) => pattern.test(ws.name));
  if (matches.length === 0) return null;

  return {
    ids: new Set(matches.map((ws) => ws.id)),
    start: Math.min(...matches.map((ws) => ws.startMonth)),
    end: Math.max(...matches.map((ws) => ws.endMonth)),
  };
}

function isRestaurantLike(contextText: string, workstreams: Workstream[]): boolean {
  if (RESTAURANT_DOMAIN_RE.test(contextText)) return true;
  return workstreams.some((ws) => RESTAURANT_DOMAIN_RE.test(ws.name));
}

export function enforceDomainSequencing(
  workstreams: Workstream[],
  contextText = ''
): Workstream[] {
  if (!Array.isArray(workstreams) || workstreams.length === 0) return workstreams;
  if (!isRestaurantLike(contextText, workstreams)) return workstreams;

  const construction = findWindow(workstreams, CONSTRUCTION_RE);
  if (!construction) return workstreams;

  const constructionStart = construction.start;
  const constructionEnd = construction.end;
  const constructionIds = construction.ids;

  return workstreams.map((ws) => {
    const name = ws.name || '';
    const duration = Math.max(1, ws.endMonth - ws.startMonth);
    let startMonth = ws.startMonth;
    let endMonth = ws.endMonth;
    let dependencies = Array.isArray(ws.dependencies) ? [...ws.dependencies] : [];

    if (COMPLIANCE_RE.test(name) && startMonth > constructionEnd) {
      // Compliance must start no later than construction completion.
      startMonth = constructionEnd;
      endMonth = startMonth + duration;
      dependencies = dependencies.filter((depId) => !constructionIds.has(depId));
    }

    if (TECHNOLOGY_RE.test(name) && startMonth < constructionStart) {
      startMonth = constructionStart;
      endMonth = startMonth + duration;
    }

    if (STAFF_RE.test(name) && startMonth < constructionStart) {
      startMonth = constructionStart;
      endMonth = startMonth + duration;
    }

    if (MARKETING_RE.test(name) && startMonth < constructionStart) {
      startMonth = constructionStart;
      endMonth = startMonth + duration;
    }

    if (startMonth === ws.startMonth && endMonth === ws.endMonth && dependencies.length === ws.dependencies.length) {
      return ws;
    }

    return {
      ...ws,
      startMonth,
      endMonth,
      dependencies,
      deliverables: Array.isArray(ws.deliverables)
        ? ws.deliverables.map((deliverable) => ({
            ...deliverable,
            dueMonth: clampDueMonth(deliverable.dueMonth, startMonth, endMonth),
          }))
        : [],
    };
  });
}
