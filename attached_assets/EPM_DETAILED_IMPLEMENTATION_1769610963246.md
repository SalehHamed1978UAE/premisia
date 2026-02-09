# EPM IMPROVEMENT IMPLEMENTATION GUIDE
## Autonomous Execution for Replit

**CRITICAL: Read this entire section before writing any code.**

---

## EXECUTION MODEL

This document is a sequential task list. Execute tasks in order. Each task has:
1. **TASK**: What to build
2. **TEST**: How to verify it works
3. **GATE**: Pass/fail criteria

**Rules:**
- Complete each task fully before moving to the next
- Run the TEST after completing each TASK
- If TEST fails, fix the code and re-run TEST
- Do NOT proceed to next task until GATE passes
- After every 3 tasks, run the full regression suite
- Log all test output to `/logs/task-{N}-output.txt`

---

## PROJECT CONTEXT

**What we're fixing:** The current EPM (Enterprise Program Management) output has quality bugs:
- Template contamination (sneaker store gets "Food Safety Compliance")
- Invalid dependencies (workstreams depend on others that start same time)
- Generic risk mitigations (all say "Monitor and implement controls")
- Wrong FTE units (shows "100" instead of "1.0")
- Unmeasurable KPIs (target is "Improvement")
- Benefits just copy SWOT opportunities verbatim

**Key files:**
- `/server/intelligence/epm-synthesizer.ts` - Core generation (main bugs here)
- `/server/intelligence/wbs-builder.ts` - Workstream generation
- `/server/services/export-service.ts` - Output generation
- `/shared/schema.ts` line 684 - `epmPrograms` table

**Goal:** Fix these bugs and add Excel/PDF export that's import-ready for MS Project, Jira, Monday.com.

---

## SETUP TASK

### TASK 0: Create Test Infrastructure

Create the test runner and logging infrastructure.

```bash
# Create directories
mkdir -p logs
mkdir -p server/intelligence/validators
mkdir -p server/intelligence/normalizers
mkdir -p server/intelligence/prompts
mkdir -p tests/validators
mkdir -p tests/normalizers
mkdir -p tests/integration
```

Create `/scripts/run-task-test.sh`:
```bash
#!/bin/bash
TASK_NUM=$1
TEST_FILE=$2
LOG_FILE="logs/task-${TASK_NUM}-output.txt"

echo "=== Running test for Task ${TASK_NUM} ===" | tee $LOG_FILE
echo "Test file: ${TEST_FILE}" | tee -a $LOG_FILE
echo "Timestamp: $(date)" | tee -a $LOG_FILE
echo "---" | tee -a $LOG_FILE

npx vitest run $TEST_FILE --reporter=verbose 2>&1 | tee -a $LOG_FILE

EXIT_CODE=${PIPESTATUS[0]}

echo "---" | tee -a $LOG_FILE
echo "Exit code: $EXIT_CODE" | tee -a $LOG_FILE

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ GATE PASSED" | tee -a $LOG_FILE
else
    echo "❌ GATE FAILED - Fix and retry" | tee -a $LOG_FILE
fi

exit $EXIT_CODE
```

```bash
chmod +x scripts/run-task-test.sh
```

Create `/scripts/run-regression.sh`:
```bash
#!/bin/bash
LOG_FILE="logs/regression-$(date +%Y%m%d-%H%M%S).txt"

echo "=== Full Regression Suite ===" | tee $LOG_FILE
echo "Timestamp: $(date)" | tee -a $LOG_FILE
echo "---" | tee -a $LOG_FILE

npx vitest run tests/ --reporter=verbose 2>&1 | tee -a $LOG_FILE

EXIT_CODE=${PIPESTATUS[0]}

echo "---" | tee -a $LOG_FILE
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ ALL TESTS PASSED" | tee -a $LOG_FILE
else
    echo "❌ REGRESSION FAILED" | tee -a $LOG_FILE
fi

exit $EXIT_CODE
```

```bash
chmod +x scripts/run-regression.sh
```

### TEST 0:
```bash
./scripts/run-task-test.sh 0 "tests/setup.test.ts"
```

Create minimal test file `/tests/setup.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('Setup', () => {
  it('directories exist', () => {
    expect(true).toBe(true);
  });
});
```

### GATE 0:
- [ ] Script runs without error
- [ ] Log file created at `logs/task-0-output.txt`

---

## PHASE 1: VALIDATORS

---

### TASK 1.1: Dependency Validator

Create `/server/intelligence/validators/dependency-validator.ts`:

```typescript
export interface Dependency {
  workstreamId: string;
  type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish';
  lagDays?: number;
}

export interface WorkstreamForValidation {
  id: string;
  name: string;
  startMonth: number;
  endMonth: number;
  dependencies: Dependency[];
}

export interface DependencyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateDependencies(
  workstreams: WorkstreamForValidation[]
): DependencyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Build lookup maps
  const wsMap = new Map<string, WorkstreamForValidation>();
  for (const ws of workstreams) {
    wsMap.set(ws.id, ws);
  }

  // Check 1: Detect circular dependencies using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function detectCycle(wsId: string, path: string[]): boolean {
    visited.add(wsId);
    recursionStack.add(wsId);

    const ws = wsMap.get(wsId);
    if (!ws) return false;

    for (const dep of ws.dependencies) {
      if (!visited.has(dep.workstreamId)) {
        if (detectCycle(dep.workstreamId, [...path, wsId])) {
          return true;
        }
      } else if (recursionStack.has(dep.workstreamId)) {
        errors.push(
          `Circular dependency: ${[...path, wsId, dep.workstreamId].join(' → ')}`
        );
        return true;
      }
    }

    recursionStack.delete(wsId);
    return false;
  }

  for (const ws of workstreams) {
    if (!visited.has(ws.id)) {
      detectCycle(ws.id, []);
    }
  }

  // Check 2: Validate finish-to-start timing
  for (const ws of workstreams) {
    for (const dep of ws.dependencies) {
      const predecessor = wsMap.get(dep.workstreamId);
      if (!predecessor) {
        errors.push(`${ws.id}: Depends on non-existent ${dep.workstreamId}`);
        continue;
      }

      if (dep.type === 'finish-to-start') {
        if (predecessor.endMonth > ws.startMonth) {
          errors.push(
            `${ws.id} starts Month ${ws.startMonth} but depends on ` +
            `${dep.workstreamId} which ends Month ${predecessor.endMonth}`
          );
        } else if (predecessor.endMonth === ws.startMonth) {
          warnings.push(
            `${ws.id} starts same month ${dep.workstreamId} ends - tight coupling`
          );
        }
      }
    }
  }

  // Check 3: Verify all referenced dependencies exist
  const allIds = new Set(workstreams.map(w => w.id));
  for (const ws of workstreams) {
    for (const dep of ws.dependencies) {
      if (!allIds.has(dep.workstreamId)) {
        errors.push(`${ws.id}: References non-existent dependency ${dep.workstreamId}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function fixDependencyChain(
  workstreams: WorkstreamForValidation[]
): WorkstreamForValidation[] {
  // Topological sort to determine valid order
  const sorted = topologicalSort(workstreams);
  
  // Adjust timing based on sorted order
  let currentMonth = 1;
  const fixed: WorkstreamForValidation[] = [];

  for (const ws of sorted) {
    // Find latest end month of all dependencies
    let earliestStart = currentMonth;
    for (const dep of ws.dependencies) {
      const predecessor = fixed.find(w => w.id === dep.workstreamId);
      if (predecessor && dep.type === 'finish-to-start') {
        earliestStart = Math.max(earliestStart, predecessor.endMonth + 1);
      }
    }

    const duration = ws.endMonth - ws.startMonth;
    fixed.push({
      ...ws,
      startMonth: earliestStart,
      endMonth: earliestStart + duration
    });
  }

  return fixed;
}

function topologicalSort(
  workstreams: WorkstreamForValidation[]
): WorkstreamForValidation[] {
  const inDegree = new Map<string, number>();
  const wsMap = new Map<string, WorkstreamForValidation>();
  
  for (const ws of workstreams) {
    wsMap.set(ws.id, ws);
    inDegree.set(ws.id, 0);
  }

  // Calculate in-degrees
  for (const ws of workstreams) {
    for (const dep of ws.dependencies) {
      const current = inDegree.get(ws.id) || 0;
      inDegree.set(ws.id, current + 1);
    }
  }

  // Process nodes with in-degree 0
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: WorkstreamForValidation[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const ws = wsMap.get(id)!;
    sorted.push(ws);

    // Find workstreams that depend on this one
    for (const other of workstreams) {
      if (other.dependencies.some(d => d.workstreamId === id)) {
        const newDegree = (inDegree.get(other.id) || 1) - 1;
        inDegree.set(other.id, newDegree);
        if (newDegree === 0) queue.push(other.id);
      }
    }
  }

  // If not all sorted, there's a cycle - return original order
  if (sorted.length !== workstreams.length) {
    return workstreams;
  }

  return sorted;
}
```

### TEST 1.1:

Create `/tests/validators/dependency-validator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { 
  validateDependencies, 
  fixDependencyChain,
  WorkstreamForValidation 
} from '../../server/intelligence/validators/dependency-validator';

describe('DependencyValidator', () => {
  
  it('passes valid dependency chain', () => {
    const workstreams: WorkstreamForValidation[] = [
      { id: 'WS001', name: 'First', startMonth: 1, endMonth: 2, dependencies: [] },
      { id: 'WS002', name: 'Second', startMonth: 3, endMonth: 4, 
        dependencies: [{ workstreamId: 'WS001', type: 'finish-to-start' }] },
    ];
    
    const result = validateDependencies(workstreams);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects circular dependency', () => {
    const workstreams: WorkstreamForValidation[] = [
      { id: 'WS001', name: 'First', startMonth: 1, endMonth: 2, 
        dependencies: [{ workstreamId: 'WS002', type: 'finish-to-start' }] },
      { id: 'WS002', name: 'Second', startMonth: 2, endMonth: 3, 
        dependencies: [{ workstreamId: 'WS001', type: 'finish-to-start' }] },
    ];
    
    const result = validateDependencies(workstreams);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Circular'))).toBe(true);
  });

  it('detects invalid finish-to-start timing', () => {
    const workstreams: WorkstreamForValidation[] = [
      { id: 'WS001', name: 'First', startMonth: 1, endMonth: 3, dependencies: [] },
      { id: 'WS002', name: 'Second', startMonth: 2, endMonth: 4, 
        dependencies: [{ workstreamId: 'WS001', type: 'finish-to-start' }] },
    ];
    
    const result = validateDependencies(workstreams);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('starts Month 2') && e.includes('ends Month 3'))).toBe(true);
  });

  it('warns on tight coupling (same month)', () => {
    const workstreams: WorkstreamForValidation[] = [
      { id: 'WS001', name: 'First', startMonth: 1, endMonth: 2, dependencies: [] },
      { id: 'WS002', name: 'Second', startMonth: 2, endMonth: 4, 
        dependencies: [{ workstreamId: 'WS001', type: 'finish-to-start' }] },
    ];
    
    const result = validateDependencies(workstreams);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('tight coupling'))).toBe(true);
  });

  it('detects reference to non-existent workstream', () => {
    const workstreams: WorkstreamForValidation[] = [
      { id: 'WS001', name: 'First', startMonth: 1, endMonth: 2, 
        dependencies: [{ workstreamId: 'WS999', type: 'finish-to-start' }] },
    ];
    
    const result = validateDependencies(workstreams);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('non-existent'))).toBe(true);
  });

  it('fixes invalid dependency timing', () => {
    const workstreams: WorkstreamForValidation[] = [
      { id: 'WS001', name: 'First', startMonth: 1, endMonth: 2, dependencies: [] },
      { id: 'WS002', name: 'Second', startMonth: 1, endMonth: 2, 
        dependencies: [{ workstreamId: 'WS001', type: 'finish-to-start' }] },
    ];
    
    const fixed = fixDependencyChain(workstreams);
    const ws2 = fixed.find(w => w.id === 'WS002')!;
    
    // WS002 should now start after WS001 ends
    expect(ws2.startMonth).toBeGreaterThan(1);
  });
});
```

Run test:
```bash
./scripts/run-task-test.sh 1.1 tests/validators/dependency-validator.test.ts
```

### GATE 1.1:
- [ ] All 6 tests pass
- [ ] Log file shows "GATE PASSED"

**If GATE fails:** Fix the validator code and re-run test. Do NOT proceed until all tests pass.

---

### TASK 1.2: Industry Validator

Create `/server/intelligence/validators/industry-validator.ts`:

```typescript
export const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  food_service: [
    'food safety', 'health inspection', 'kitchen', 'menu', 'chef', 
    'FDA', 'food handling', 'recipe', 'sous chef', 'restaurant',
    'dining', 'catering', 'food prep', 'culinary'
  ],
  retail: [
    'inventory', 'POS', 'merchandising', 'store layout', 'foot traffic',
    'retail', 'shopping', 'checkout', 'display', 'storefront'
  ],
  fashion: [
    'collection', 'runway', 'fabric', 'sizing', 'seasonal',
    'apparel', 'garment', 'textile', 'fashion week', 'lookbook'
  ],
  technology: [
    'sprint', 'deployment', 'architecture', 'API', 'database',
    'software', 'agile', 'DevOps', 'cloud', 'microservice'
  ],
  healthcare: [
    'HIPAA', 'patient', 'clinical', 'medical', 'diagnosis',
    'treatment', 'healthcare', 'physician', 'nursing', 'pharmacy'
  ],
  marine: [
    'vessel', 'fishing', 'maritime', 'boat', 'harbor',
    'catch', 'seafood', 'dock', 'marine', 'nautical'
  ],
  sneaker: [
    'sneaker', 'footwear', 'shoe', 'athletic', 'streetwear',
    'sole', 'lacing', 'drop', 'limited edition', 'resale'
  ]
};

export interface IndustryValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  contaminationScore: number;
  contaminatedWorkstreams: { id: string; keyword: string; fromIndustry: string }[];
}

export interface WorkstreamForIndustryValidation {
  id: string;
  name: string;
  description: string;
  deliverables?: { name: string }[];
}

export function validateIndustryRelevance(
  workstreams: WorkstreamForIndustryValidation[],
  declaredIndustry: string
): IndustryValidationResult {
  const warnings: string[] = [];
  const contaminated: { id: string; keyword: string; fromIndustry: string }[] = [];

  const normalizedIndustry = declaredIndustry.toLowerCase().replace(/[^a-z]/g, '_');
  const expectedKeywords = INDUSTRY_KEYWORDS[normalizedIndustry] || [];

  for (const ws of workstreams) {
    const text = [
      ws.name,
      ws.description,
      ...(ws.deliverables?.map(d => d.name) || [])
    ].join(' ').toLowerCase();

    // Check for keywords from OTHER industries
    for (const [otherIndustry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
      if (otherIndustry === normalizedIndustry) continue;

      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();
        if (text.includes(keywordLower)) {
          // Check if it's also in our expected keywords (overlap is OK)
          if (!expectedKeywords.some(k => k.toLowerCase() === keywordLower)) {
            contaminated.push({
              id: ws.id,
              keyword: keyword,
              fromIndustry: otherIndustry
            });
            warnings.push(
              `${ws.id} "${ws.name}" contains "${keyword}" (typical for ${otherIndustry}, not ${declaredIndustry})`
            );
          }
        }
      }
    }
  }

  const contaminationScore = workstreams.length > 0 
    ? Math.min(100, (contaminated.length / workstreams.length) * 50)
    : 0;

  return {
    valid: contaminationScore < 30,
    errors: contaminationScore >= 50 
      ? [`High template contamination: ${contaminationScore.toFixed(0)}%`] 
      : [],
    warnings,
    contaminationScore,
    contaminatedWorkstreams: contaminated
  };
}
```

### TEST 1.2:

Create `/tests/validators/industry-validator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { 
  validateIndustryRelevance,
  WorkstreamForIndustryValidation 
} from '../../server/intelligence/validators/industry-validator';

describe('IndustryValidator', () => {

  it('passes clean industry-appropriate workstreams', () => {
    const workstreams: WorkstreamForIndustryValidation[] = [
      { id: 'WS001', name: 'Menu Development', description: 'Create cafe menu with pricing' },
      { id: 'WS002', name: 'Kitchen Setup', description: 'Install kitchen equipment' },
    ];
    
    const result = validateIndustryRelevance(workstreams, 'food_service');
    expect(result.valid).toBe(true);
    expect(result.contaminationScore).toBeLessThan(30);
  });

  it('detects food keywords in sneaker business', () => {
    const workstreams: WorkstreamForIndustryValidation[] = [
      { id: 'WS001', name: 'Food Safety Compliance', description: 'Ensure health inspection readiness' },
      { id: 'WS002', name: 'Store Layout', description: 'Design sneaker display areas' },
    ];
    
    const result = validateIndustryRelevance(workstreams, 'sneaker');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('Food Safety') || w.includes('health inspection'))).toBe(true);
    expect(result.contaminatedWorkstreams.some(c => c.fromIndustry === 'food_service')).toBe(true);
  });

  it('detects healthcare keywords in retail business', () => {
    const workstreams: WorkstreamForIndustryValidation[] = [
      { id: 'WS001', name: 'HIPAA Compliance', description: 'Patient data protection' },
      { id: 'WS002', name: 'Inventory Management', description: 'Track store inventory' },
    ];
    
    const result = validateIndustryRelevance(workstreams, 'retail');
    expect(result.contaminatedWorkstreams.some(c => c.fromIndustry === 'healthcare')).toBe(true);
  });

  it('fails validation when contamination is high', () => {
    const workstreams: WorkstreamForIndustryValidation[] = [
      { id: 'WS001', name: 'Food Safety', description: 'Kitchen compliance' },
      { id: 'WS002', name: 'Menu Planning', description: 'Chef recipes' },
      { id: 'WS003', name: 'Health Inspection', description: 'FDA requirements' },
    ];
    
    const result = validateIndustryRelevance(workstreams, 'technology');
    expect(result.contaminationScore).toBeGreaterThan(30);
  });

  it('handles unknown industry gracefully', () => {
    const workstreams: WorkstreamForIndustryValidation[] = [
      { id: 'WS001', name: 'General Operations', description: 'Business operations' },
    ];
    
    const result = validateIndustryRelevance(workstreams, 'unknown_industry');
    expect(result.valid).toBe(true);
  });

  it('includes deliverables in text analysis', () => {
    const workstreams: WorkstreamForIndustryValidation[] = [
      { 
        id: 'WS001', 
        name: 'Setup Phase', 
        description: 'Initial setup',
        deliverables: [{ name: 'Food Safety Certificate' }]
      },
    ];
    
    const result = validateIndustryRelevance(workstreams, 'sneaker');
    expect(result.contaminatedWorkstreams.length).toBeGreaterThan(0);
  });
});
```

Run test:
```bash
./scripts/run-task-test.sh 1.2 tests/validators/industry-validator.test.ts
```

### GATE 1.2:
- [ ] All 6 tests pass
- [ ] Log file shows "GATE PASSED"

---

### TASK 1.3: FTE Normalizer

Create `/server/intelligence/normalizers/fte-normalizer.ts`:

```typescript
export interface ResourceForNormalization {
  role: string;
  fteAllocation: number;
}

export interface FTENormalizationResult {
  normalized: ResourceForNormalization[];
  fixes: string[];
  hasIssues: boolean;
}

export function normalizeFTE(value: number): number {
  // If value > 10, assume it's percentage and convert
  if (value > 10) {
    return Math.round((value / 100) * 100) / 100; // Round to 2 decimal places
  }
  // If value > 1.0 but <= 10, might be headcount or error - cap at 1.0
  if (value > 1.0) {
    return 1.0;
  }
  // If negative, return 0
  if (value < 0) {
    return 0;
  }
  return Math.round(value * 100) / 100; // Round to 2 decimal places
}

export function validateAndNormalizeResources(
  resources: ResourceForNormalization[]
): FTENormalizationResult {
  const fixes: string[] = [];
  const normalized: ResourceForNormalization[] = [];

  for (const r of resources) {
    const original = r.fteAllocation;
    const fixed = normalizeFTE(original);

    if (original !== fixed) {
      fixes.push(`${r.role}: ${original} → ${fixed}`);
    }

    normalized.push({
      ...r,
      fteAllocation: fixed
    });
  }

  return {
    normalized,
    fixes,
    hasIssues: fixes.length > 0
  };
}

export function validateFTECaps(
  resources: ResourceForNormalization[],
  maxFTEPerRole: number = 5.0
): { valid: boolean; warnings: string[] } {
  const fteByRole = new Map<string, number>();
  const warnings: string[] = [];

  for (const r of resources) {
    const current = fteByRole.get(r.role) || 0;
    fteByRole.set(r.role, current + r.fteAllocation);
  }

  for (const [role, totalFTE] of fteByRole) {
    if (totalFTE > maxFTEPerRole) {
      warnings.push(`${role}: Total FTE ${totalFTE.toFixed(2)} exceeds cap of ${maxFTEPerRole}`);
    }
  }

  return {
    valid: warnings.length === 0,
    warnings
  };
}
```

### TEST 1.3:

Create `/tests/normalizers/fte-normalizer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { 
  normalizeFTE,
  validateAndNormalizeResources,
  validateFTECaps 
} from '../../server/intelligence/normalizers/fte-normalizer';

describe('FTENormalizer', () => {

  describe('normalizeFTE', () => {
    it('converts 100 to 1.0', () => {
      expect(normalizeFTE(100)).toBe(1.0);
    });

    it('converts 80 to 0.8', () => {
      expect(normalizeFTE(80)).toBe(0.8);
    });

    it('converts 50 to 0.5', () => {
      expect(normalizeFTE(50)).toBe(0.5);
    });

    it('caps values between 1 and 10 at 1.0', () => {
      expect(normalizeFTE(1.5)).toBe(1.0);
      expect(normalizeFTE(5)).toBe(1.0);
    });

    it('leaves valid values unchanged', () => {
      expect(normalizeFTE(0.75)).toBe(0.75);
      expect(normalizeFTE(1.0)).toBe(1.0);
      expect(normalizeFTE(0.25)).toBe(0.25);
    });

    it('handles zero', () => {
      expect(normalizeFTE(0)).toBe(0);
    });

    it('handles negative values', () => {
      expect(normalizeFTE(-5)).toBe(0);
    });
  });

  describe('validateAndNormalizeResources', () => {
    it('normalizes array of resources', () => {
      const resources = [
        { role: 'PM', fteAllocation: 100 },
        { role: 'Dev', fteAllocation: 80 },
        { role: 'QA', fteAllocation: 0.5 }
      ];

      const result = validateAndNormalizeResources(resources);
      
      expect(result.normalized[0].fteAllocation).toBe(1.0);
      expect(result.normalized[1].fteAllocation).toBe(0.8);
      expect(result.normalized[2].fteAllocation).toBe(0.5);
      expect(result.fixes).toHaveLength(2);
      expect(result.hasIssues).toBe(true);
    });

    it('reports no issues for clean data', () => {
      const resources = [
        { role: 'PM', fteAllocation: 1.0 },
        { role: 'Dev', fteAllocation: 0.5 }
      ];

      const result = validateAndNormalizeResources(resources);
      expect(result.hasIssues).toBe(false);
      expect(result.fixes).toHaveLength(0);
    });
  });

  describe('validateFTECaps', () => {
    it('passes when under cap', () => {
      const resources = [
        { role: 'PM', fteAllocation: 1.0 },
        { role: 'PM', fteAllocation: 1.0 },
        { role: 'Dev', fteAllocation: 0.5 }
      ];

      const result = validateFTECaps(resources);
      expect(result.valid).toBe(true);
    });

    it('warns when over cap', () => {
      const resources = [
        { role: 'PM', fteAllocation: 1.0 },
        { role: 'PM', fteAllocation: 1.0 },
        { role: 'PM', fteAllocation: 1.0 },
        { role: 'PM', fteAllocation: 1.0 },
        { role: 'PM', fteAllocation: 1.0 },
        { role: 'PM', fteAllocation: 1.0 }, // 6.0 total
      ];

      const result = validateFTECaps(resources, 5.0);
      expect(result.valid).toBe(false);
      expect(result.warnings.some(w => w.includes('PM') && w.includes('exceeds'))).toBe(true);
    });
  });
});
```

Run test:
```bash
./scripts/run-task-test.sh 1.3 tests/normalizers/fte-normalizer.test.ts
```

### GATE 1.3:
- [ ] All tests pass
- [ ] Log file shows "GATE PASSED"

---

### TASK 1.4: Completeness Validator

Create `/server/intelligence/validators/completeness-validator.ts`:

```typescript
export interface WorkstreamForCompleteness {
  id: string;
  name: string;
  deliverables?: { name: string; acceptanceCriteria?: string[] }[];
  resources?: { role: string; fteAllocation: number }[];
  durationDays?: number;
}

export interface RiskForCompleteness {
  id: string;
  description: string;
  mitigation?: string;
  probability?: string;
  impact?: string;
}

export interface KPIForCompleteness {
  name: string;
  target?: string | number;
}

export interface ProgramForCompleteness {
  workstreams: WorkstreamForCompleteness[];
  riskRegister?: RiskForCompleteness[];
  kpis?: KPIForCompleteness[];
}

export interface CompletenessResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  completenessScore: number;
}

const GENERIC_MITIGATION_PHRASES = [
  'monitor and implement controls',
  'develop contingency plans',
  'establish governance',
  'implement appropriate measures',
  'track and monitor',
  'manage risk appropriately'
];

export function validateCompleteness(program: ProgramForCompleteness): CompletenessResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  // Check 1: Workstreams have deliverables
  for (const ws of program.workstreams) {
    totalChecks++;
    if (!ws.deliverables || ws.deliverables.length === 0) {
      errors.push(`${ws.id}: No deliverables defined`);
    } else {
      passedChecks++;
      
      // Check deliverable quality
      for (const d of ws.deliverables) {
        if (!d.acceptanceCriteria || d.acceptanceCriteria.length === 0) {
          warnings.push(`${ws.id}/${d.name}: No acceptance criteria`);
        }
      }
    }
  }

  // Check 2: Workstreams have resources
  for (const ws of program.workstreams) {
    totalChecks++;
    if (!ws.resources || ws.resources.length === 0) {
      errors.push(`${ws.id}: No resources assigned`);
    } else {
      passedChecks++;
    }
  }

  // Check 3: Duration bounds
  for (const ws of program.workstreams) {
    if (ws.durationDays !== undefined) {
      if (ws.durationDays < 7) {
        warnings.push(`${ws.id}: Duration ${ws.durationDays} days seems too short`);
      }
      if (ws.durationDays > 60) {
        warnings.push(`${ws.id}: Duration ${ws.durationDays} days seems too long for single workstream`);
      }
    }
  }

  // Check 4: Minimum risk count
  totalChecks++;
  const riskCount = program.riskRegister?.length || 0;
  if (riskCount < 5) {
    errors.push(`Risk register has only ${riskCount} risks (minimum 5 required)`);
  } else {
    passedChecks++;
  }

  // Check 5: No generic risk mitigations
  for (const risk of program.riskRegister || []) {
    const mitigationLower = (risk.mitigation || '').toLowerCase();
    for (const phrase of GENERIC_MITIGATION_PHRASES) {
      if (mitigationLower.includes(phrase)) {
        errors.push(`${risk.id}: Generic mitigation detected - "${phrase}"`);
        break;
      }
    }
  }

  // Check 6: KPIs have measurable targets
  for (const kpi of program.kpis || []) {
    totalChecks++;
    if (!kpi.target || kpi.target === 'Improvement' || kpi.target === '') {
      errors.push(`KPI "${kpi.name}": Target must be measurable, got "${kpi.target || 'undefined'}"`);
    } else {
      passedChecks++;
    }
  }

  const completenessScore = totalChecks > 0 
    ? Math.round((passedChecks / totalChecks) * 100) 
    : 0;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    completenessScore
  };
}
```

### TEST 1.4:

Create `/tests/validators/completeness-validator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { 
  validateCompleteness,
  ProgramForCompleteness 
} from '../../server/intelligence/validators/completeness-validator';

describe('CompletenessValidator', () => {

  it('passes complete program', () => {
    const program: ProgramForCompleteness = {
      workstreams: [
        {
          id: 'WS001',
          name: 'Test',
          deliverables: [{ name: 'Doc', acceptanceCriteria: ['Reviewed'] }],
          resources: [{ role: 'PM', fteAllocation: 1.0 }],
          durationDays: 30
        }
      ],
      riskRegister: [
        { id: 'R001', description: 'Risk 1', mitigation: 'Specific action to take', probability: 'High', impact: 'High' },
        { id: 'R002', description: 'Risk 2', mitigation: 'Another specific action', probability: 'Medium', impact: 'Medium' },
        { id: 'R003', description: 'Risk 3', mitigation: 'Third action item', probability: 'Low', impact: 'High' },
        { id: 'R004', description: 'Risk 4', mitigation: 'Fourth specific step', probability: 'High', impact: 'Low' },
        { id: 'R005', description: 'Risk 5', mitigation: 'Fifth mitigation step', probability: 'Medium', impact: 'Medium' },
      ],
      kpis: [
        { name: 'Revenue', target: '$100,000' },
        { name: 'NPS', target: 50 }
      ]
    };

    const result = validateCompleteness(program);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails on missing deliverables', () => {
    const program: ProgramForCompleteness = {
      workstreams: [
        { id: 'WS001', name: 'Test', deliverables: [], resources: [{ role: 'PM', fteAllocation: 1.0 }] }
      ],
      riskRegister: Array(5).fill({ id: 'R', description: 'R', mitigation: 'Action' }),
      kpis: [{ name: 'KPI', target: '10' }]
    };

    const result = validateCompleteness(program);
    expect(result.errors.some(e => e.includes('No deliverables'))).toBe(true);
  });

  it('fails on missing resources', () => {
    const program: ProgramForCompleteness = {
      workstreams: [
        { id: 'WS001', name: 'Test', deliverables: [{ name: 'Doc' }], resources: [] }
      ],
      riskRegister: Array(5).fill({ id: 'R', description: 'R', mitigation: 'Action' }),
      kpis: [{ name: 'KPI', target: '10' }]
    };

    const result = validateCompleteness(program);
    expect(result.errors.some(e => e.includes('No resources'))).toBe(true);
  });

  it('fails on insufficient risks', () => {
    const program: ProgramForCompleteness = {
      workstreams: [
        { id: 'WS001', name: 'Test', deliverables: [{ name: 'Doc' }], resources: [{ role: 'PM', fteAllocation: 1.0 }] }
      ],
      riskRegister: [
        { id: 'R001', description: 'Only one risk', mitigation: 'Action' }
      ],
      kpis: [{ name: 'KPI', target: '10' }]
    };

    const result = validateCompleteness(program);
    expect(result.errors.some(e => e.includes('minimum 5'))).toBe(true);
  });

  it('detects generic risk mitigation "monitor and implement controls"', () => {
    const program: ProgramForCompleteness = {
      workstreams: [
        { id: 'WS001', name: 'Test', deliverables: [{ name: 'Doc' }], resources: [{ role: 'PM', fteAllocation: 1.0 }] }
      ],
      riskRegister: [
        { id: 'R001', description: 'Risk', mitigation: 'Monitor and implement controls to reduce impact' },
        { id: 'R002', description: 'Risk', mitigation: 'Action 2' },
        { id: 'R003', description: 'Risk', mitigation: 'Action 3' },
        { id: 'R004', description: 'Risk', mitigation: 'Action 4' },
        { id: 'R005', description: 'Risk', mitigation: 'Action 5' },
      ],
      kpis: [{ name: 'KPI', target: '10' }]
    };

    const result = validateCompleteness(program);
    expect(result.errors.some(e => e.includes('Generic mitigation'))).toBe(true);
  });

  it('detects unmeasurable KPI target "Improvement"', () => {
    const program: ProgramForCompleteness = {
      workstreams: [
        { id: 'WS001', name: 'Test', deliverables: [{ name: 'Doc' }], resources: [{ role: 'PM', fteAllocation: 1.0 }] }
      ],
      riskRegister: Array(5).fill({ id: 'R', description: 'R', mitigation: 'Specific action' }),
      kpis: [
        { name: 'Bad KPI', target: 'Improvement' }
      ]
    };

    const result = validateCompleteness(program);
    expect(result.errors.some(e => e.includes('measurable') && e.includes('Improvement'))).toBe(true);
  });

  it('warns on short duration', () => {
    const program: ProgramForCompleteness = {
      workstreams: [
        { id: 'WS001', name: 'Test', deliverables: [{ name: 'Doc' }], resources: [{ role: 'PM', fteAllocation: 1.0 }], durationDays: 3 }
      ],
      riskRegister: Array(5).fill({ id: 'R', description: 'R', mitigation: 'Action' }),
      kpis: [{ name: 'KPI', target: '10' }]
    };

    const result = validateCompleteness(program);
    expect(result.warnings.some(w => w.includes('too short'))).toBe(true);
  });

  it('warns on long duration', () => {
    const program: ProgramForCompleteness = {
      workstreams: [
        { id: 'WS001', name: 'Test', deliverables: [{ name: 'Doc' }], resources: [{ role: 'PM', fteAllocation: 1.0 }], durationDays: 100 }
      ],
      riskRegister: Array(5).fill({ id: 'R', description: 'R', mitigation: 'Action' }),
      kpis: [{ name: 'KPI', target: '10' }]
    };

    const result = validateCompleteness(program);
    expect(result.warnings.some(w => w.includes('too long'))).toBe(true);
  });
});
```

Run test:
```bash
./scripts/run-task-test.sh 1.4 tests/validators/completeness-validator.test.ts
```

### GATE 1.4:
- [ ] All 8 tests pass
- [ ] Log file shows "GATE PASSED"

---

### REGRESSION CHECKPOINT 1

After completing Tasks 1.1-1.4, run full regression:

```bash
./scripts/run-regression.sh
```

### GATE RC1:
- [ ] All validator tests pass
- [ ] All normalizer tests pass
- [ ] Regression log shows "ALL TESTS PASSED"

**If GATE fails:** Fix failing tests before proceeding to Phase 2.

---

## PHASE 2: INTEGRATION INTO EPM SYNTHESIZER

---

### TASK 2.1: Create Quality Gate Runner

Create `/server/intelligence/quality-gates.ts`:

```typescript
import { validateDependencies, WorkstreamForValidation } from './validators/dependency-validator';
import { validateIndustryRelevance, WorkstreamForIndustryValidation } from './validators/industry-validator';
import { validateAndNormalizeResources, validateFTECaps } from './normalizers/fte-normalizer';
import { validateCompleteness, ProgramForCompleteness } from './validators/completeness-validator';

export interface QualityGateResult {
  passed: boolean;
  blockers: string[];
  warnings: string[];
  fixes: string[];
}

export interface EPMProgramForValidation {
  workstreams: Array<{
    id: string;
    name: string;
    description: string;
    startMonth: number;
    endMonth: number;
    durationDays?: number;
    dependencies: Array<{
      workstreamId: string;
      type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish';
      lagDays?: number;
    }>;
    deliverables?: Array<{ name: string; acceptanceCriteria?: string[] }>;
    resources?: Array<{ role: string; fteAllocation: number }>;
  }>;
  riskRegister?: Array<{
    id: string;
    description: string;
    mitigation?: string;
    probability?: string;
    impact?: string;
  }>;
  kpis?: Array<{
    name: string;
    target?: string | number;
  }>;
  industry: string;
}

export function runQualityGates(program: EPMProgramForValidation): QualityGateResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const fixes: string[] = [];

  // Gate 1: Dependency validation
  const depResult = validateDependencies(program.workstreams);
  blockers.push(...depResult.errors);
  warnings.push(...depResult.warnings);

  // Gate 2: Industry relevance
  const industryResult = validateIndustryRelevance(program.workstreams, program.industry);
  if (!industryResult.valid) {
    blockers.push(...industryResult.errors);
  }
  warnings.push(...industryResult.warnings);

  // Gate 3: FTE normalization
  for (const ws of program.workstreams) {
    if (ws.resources) {
      const fteResult = validateAndNormalizeResources(ws.resources);
      if (fteResult.hasIssues) {
        fixes.push(...fteResult.fixes.map(f => `${ws.id}: ${f}`));
        // Apply fixes
        ws.resources = fteResult.normalized;
      }
    }
  }

  // Gate 4: FTE caps
  const allResources = program.workstreams.flatMap(ws => ws.resources || []);
  const capsResult = validateFTECaps(allResources);
  warnings.push(...capsResult.warnings);

  // Gate 5: Completeness
  const completenessResult = validateCompleteness({
    workstreams: program.workstreams,
    riskRegister: program.riskRegister,
    kpis: program.kpis
  });
  blockers.push(...completenessResult.errors);
  warnings.push(...completenessResult.warnings);

  return {
    passed: blockers.length === 0,
    blockers,
    warnings,
    fixes
  };
}
```

### TEST 2.1:

Create `/tests/integration/quality-gates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runQualityGates, EPMProgramForValidation } from '../../server/intelligence/quality-gates';

describe('QualityGates Integration', () => {

  it('passes clean program through all gates', () => {
    const program: EPMProgramForValidation = {
      industry: 'food_service',
      workstreams: [
        {
          id: 'WS001',
          name: 'Menu Development',
          description: 'Create cafe menu',
          startMonth: 1,
          endMonth: 2,
          durationDays: 30,
          dependencies: [],
          deliverables: [{ name: 'Menu', acceptanceCriteria: ['Approved'] }],
          resources: [{ role: 'Chef', fteAllocation: 0.5 }]
        },
        {
          id: 'WS002',
          name: 'Kitchen Setup',
          description: 'Install equipment',
          startMonth: 3,
          endMonth: 4,
          durationDays: 30,
          dependencies: [{ workstreamId: 'WS001', type: 'finish-to-start' }],
          deliverables: [{ name: 'Kitchen', acceptanceCriteria: ['Inspected'] }],
          resources: [{ role: 'Contractor', fteAllocation: 1.0 }]
        }
      ],
      riskRegister: [
        { id: 'R001', description: 'Delay', mitigation: 'Hire backup contractor', probability: 'Medium', impact: 'High' },
        { id: 'R002', description: 'Cost', mitigation: 'Negotiate fixed price', probability: 'Low', impact: 'Medium' },
        { id: 'R003', description: 'Quality', mitigation: 'Daily inspections', probability: 'Medium', impact: 'Medium' },
        { id: 'R004', description: 'Permit', mitigation: 'Start application early', probability: 'Low', impact: 'High' },
        { id: 'R005', description: 'Staff', mitigation: 'Cross-train team', probability: 'Medium', impact: 'Low' },
      ],
      kpis: [
        { name: 'Launch Date', target: 'March 15, 2026' },
        { name: 'Budget Variance', target: '< 10%' }
      ]
    };

    const result = runQualityGates(program);
    expect(result.passed).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it('blocks program with circular dependencies', () => {
    const program: EPMProgramForValidation = {
      industry: 'retail',
      workstreams: [
        {
          id: 'WS001', name: 'A', description: 'A', startMonth: 1, endMonth: 2,
          dependencies: [{ workstreamId: 'WS002', type: 'finish-to-start' }],
          deliverables: [{ name: 'D' }], resources: [{ role: 'PM', fteAllocation: 1.0 }]
        },
        {
          id: 'WS002', name: 'B', description: 'B', startMonth: 2, endMonth: 3,
          dependencies: [{ workstreamId: 'WS001', type: 'finish-to-start' }],
          deliverables: [{ name: 'D' }], resources: [{ role: 'PM', fteAllocation: 1.0 }]
        }
      ],
      riskRegister: Array(5).fill({ id: 'R', description: 'R', mitigation: 'Action' }),
      kpis: [{ name: 'KPI', target: '10' }]
    };

    const result = runQualityGates(program);
    expect(result.passed).toBe(false);
    expect(result.blockers.some(b => b.includes('Circular'))).toBe(true);
  });

  it('auto-fixes FTE values and reports fixes', () => {
    const program: EPMProgramForValidation = {
      industry: 'retail',
      workstreams: [
        {
          id: 'WS001', name: 'A', description: 'A', startMonth: 1, endMonth: 2,
          dependencies: [],
          deliverables: [{ name: 'D' }],
          resources: [{ role: 'PM', fteAllocation: 100 }] // Should be 1.0
        }
      ],
      riskRegister: Array(5).fill({ id: 'R', description: 'R', mitigation: 'Action' }),
      kpis: [{ name: 'KPI', target: '10' }]
    };

    const result = runQualityGates(program);
    expect(result.fixes.some(f => f.includes('100') && f.includes('1'))).toBe(true);
    // Verify the fix was applied
    expect(program.workstreams[0].resources![0].fteAllocation).toBe(1.0);
  });

  it('warns on template contamination', () => {
    const program: EPMProgramForValidation = {
      industry: 'sneaker',
      workstreams: [
        {
          id: 'WS001', name: 'Food Safety Compliance', description: 'Kitchen inspection',
          startMonth: 1, endMonth: 2, dependencies: [],
          deliverables: [{ name: 'D' }], resources: [{ role: 'PM', fteAllocation: 1.0 }]
        }
      ],
      riskRegister: Array(5).fill({ id: 'R', description: 'R', mitigation: 'Action' }),
      kpis: [{ name: 'KPI', target: '10' }]
    };

    const result = runQualityGates(program);
    expect(result.warnings.some(w => w.includes('Food Safety') || w.includes('food_service'))).toBe(true);
  });

  it('blocks on generic risk mitigation', () => {
    const program: EPMProgramForValidation = {
      industry: 'retail',
      workstreams: [
        {
          id: 'WS001', name: 'A', description: 'A', startMonth: 1, endMonth: 2,
          dependencies: [], deliverables: [{ name: 'D' }], resources: [{ role: 'PM', fteAllocation: 1.0 }]
        }
      ],
      riskRegister: [
        { id: 'R001', description: 'Risk', mitigation: 'Monitor and implement controls to reduce impact' },
        { id: 'R002', description: 'Risk', mitigation: 'Action 2' },
        { id: 'R003', description: 'Risk', mitigation: 'Action 3' },
        { id: 'R004', description: 'Risk', mitigation: 'Action 4' },
        { id: 'R005', description: 'Risk', mitigation: 'Action 5' },
      ],
      kpis: [{ name: 'KPI', target: '10' }]
    };

    const result = runQualityGates(program);
    expect(result.passed).toBe(false);
    expect(result.blockers.some(b => b.includes('Generic mitigation'))).toBe(true);
  });

  it('blocks on unmeasurable KPI', () => {
    const program: EPMProgramForValidation = {
      industry: 'retail',
      workstreams: [
        {
          id: 'WS001', name: 'A', description: 'A', startMonth: 1, endMonth: 2,
          dependencies: [], deliverables: [{ name: 'D' }], resources: [{ role: 'PM', fteAllocation: 1.0 }]
        }
      ],
      riskRegister: Array(5).fill({ id: 'R', description: 'R', mitigation: 'Specific action' }),
      kpis: [{ name: 'Bad KPI', target: 'Improvement' }]
    };

    const result = runQualityGates(program);
    expect(result.passed).toBe(false);
    expect(result.blockers.some(b => b.includes('measurable'))).toBe(true);
  });
});
```

Run test:
```bash
./scripts/run-task-test.sh 2.1 tests/integration/quality-gates.test.ts
```

### GATE 2.1:
- [ ] All 6 integration tests pass
- [ ] Log file shows "GATE PASSED"

---

### TASK 2.2: Hook into EPM Synthesizer

**This task modifies existing code. Create a backup first.**

```bash
cp server/intelligence/epm-synthesizer.ts server/intelligence/epm-synthesizer.ts.backup
```

Add to the top of `/server/intelligence/epm-synthesizer.ts`:
```typescript
import { runQualityGates } from './quality-gates';
```

Find the location after workstream generation (search for where workstreams are assembled into the program object) and add:

```typescript
// Quality Gate Check - Add after program object is assembled
const qualityResult = runQualityGates({
  industry: strategicUnderstanding.industry || 'general',
  workstreams: program.workstreams.map(ws => ({
    id: ws.id,
    name: ws.name,
    description: ws.description || '',
    startMonth: ws.startMonth || 1,
    endMonth: ws.endMonth || ws.startMonth + 1,
    durationDays: ws.durationDays,
    dependencies: ws.dependencies || [],
    deliverables: ws.deliverables,
    resources: ws.resources
  })),
  riskRegister: program.riskRegister,
  kpis: program.kpis
});

console.log('[EPM] Quality Gate Results:');
console.log(`  Passed: ${qualityResult.passed}`);
console.log(`  Blockers: ${qualityResult.blockers.length}`);
console.log(`  Warnings: ${qualityResult.warnings.length}`);
console.log(`  Fixes Applied: ${qualityResult.fixes.length}`);

if (qualityResult.blockers.length > 0) {
  console.error('[EPM] Quality Gate Blockers:');
  qualityResult.blockers.forEach(b => console.error(`  - ${b}`));
}

if (qualityResult.warnings.length > 0) {
  console.warn('[EPM] Quality Gate Warnings:');
  qualityResult.warnings.forEach(w => console.warn(`  - ${w}`));
}

if (qualityResult.fixes.length > 0) {
  console.log('[EPM] Applied Fixes:');
  qualityResult.fixes.forEach(f => console.log(`  - ${f}`));
}
```

### TEST 2.2:

This is a manual integration test. Run the application and trigger an EPM generation.

```bash
# Start the dev server
npm run dev

# In another terminal, trigger a test journey or use the UI
# Then check the console logs for quality gate output
```

Create `/tests/integration/epm-synthesizer-hooks.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

// This is a placeholder test to verify the hook exists
// Full integration testing requires running the actual synthesizer

describe('EPM Synthesizer Quality Gate Hook', () => {
  it('import works', async () => {
    // Verify the quality gates module can be imported
    const { runQualityGates } = await import('../../server/intelligence/quality-gates');
    expect(typeof runQualityGates).toBe('function');
  });
});
```

Run test:
```bash
./scripts/run-task-test.sh 2.2 tests/integration/epm-synthesizer-hooks.test.ts
```

### GATE 2.2:
- [ ] Import test passes
- [ ] Dev server starts without errors
- [ ] Console shows quality gate output when EPM runs

---

### REGRESSION CHECKPOINT 2

```bash
./scripts/run-regression.sh
```

### GATE RC2:
- [ ] All tests pass
- [ ] No regressions from Phase 1

---

## PHASE 3: EXCEL EXPORT

---

### TASK 3.1: Install ExcelJS

```bash
npm install exceljs
npm install --save-dev @types/exceljs
```

### TEST 3.1:

```bash
node -e "require('exceljs'); console.log('ExcelJS installed')"
```

### GATE 3.1:
- [ ] ExcelJS loads without error

---

### TASK 3.2: Create Excel Export Service

Create `/server/services/excel-export-service.ts`:

```typescript
import ExcelJS from 'exceljs';

export interface WorkstreamForExport {
  id: string;
  wbsCode?: string;
  name: string;
  description?: string;
  startMonth: number;
  endMonth: number;
  durationWeeks?: number;
  dependencies: Array<{
    workstreamId: string;
    type: string;
    lagDays?: number;
  }>;
  owner?: string;
  deliverables?: Array<{ name: string; acceptanceCriteria?: string[] }>;
  resources?: Array<{ role: string; fteAllocation: number }>;
}

export interface RiskForExport {
  id: string;
  description: string;
  category?: string;
  probability?: string;
  impact?: string;
  mitigation?: string;
  owner?: string;
}

export interface KPIForExport {
  name: string;
  metric?: string;
  baseline?: string | number;
  target?: string | number;
  unit?: string;
  measurementFrequency?: string;
}

export interface BudgetLineForExport {
  workstreamId: string;
  workstreamName?: string;
  category: 'CapEx' | 'OpEx';
  amount: number;
  notes?: string;
}

export interface ProgramForExport {
  name: string;
  objective?: string;
  startDate?: Date;
  endDate?: Date;
  totalBudget?: number;
  workstreams: WorkstreamForExport[];
  riskRegister?: RiskForExport[];
  kpis?: KPIForExport[];
  budget?: BudgetLineForExport[];
  assumptions?: string[];
  constraints?: string[];
}

export async function generateExcelWorkbook(program: ProgramForExport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Premisia';
  workbook.created = new Date();

  // Sheet 1: Executive Summary
  addSummarySheet(workbook, program);

  // Sheet 2: WBS
  addWBSSheet(workbook, program.workstreams);

  // Sheet 3: Schedule
  addScheduleSheet(workbook, program.workstreams);

  // Sheet 4: Resources
  addResourcesSheet(workbook, program.workstreams);

  // Sheet 5: Budget
  addBudgetSheet(workbook, program.budget || []);

  // Sheet 6: RACI
  addRACISheet(workbook, program.workstreams);

  // Sheet 7: Risks
  addRisksSheet(workbook, program.riskRegister || []);

  // Sheet 8: Assumptions
  addAssumptionsSheet(workbook, program.assumptions || [], program.constraints || []);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function addSummarySheet(workbook: ExcelJS.Workbook, program: ProgramForExport): void {
  const sheet = workbook.addWorksheet('Executive Summary');
  
  sheet.columns = [
    { header: 'Field', key: 'field', width: 25 },
    { header: 'Value', key: 'value', width: 50 }
  ];

  sheet.addRow({ field: 'Program Name', value: program.name });
  sheet.addRow({ field: 'Objective', value: program.objective || 'N/A' });
  sheet.addRow({ field: 'Start Date', value: program.startDate?.toISOString().split('T')[0] || 'TBD' });
  sheet.addRow({ field: 'End Date', value: program.endDate?.toISOString().split('T')[0] || 'TBD' });
  sheet.addRow({ field: 'Total Budget', value: program.totalBudget ? `$${program.totalBudget.toLocaleString()}` : 'TBD' });
  sheet.addRow({ field: 'Workstreams', value: program.workstreams.length });
  sheet.addRow({ field: 'Risks Identified', value: program.riskRegister?.length || 0 });
  sheet.addRow({ field: 'KPIs', value: program.kpis?.length || 0 });

  // Style header row
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD5E8F0' }
  };
}

function addWBSSheet(workbook: ExcelJS.Workbook, workstreams: WorkstreamForExport[]): void {
  const sheet = workbook.addWorksheet('WBS');

  sheet.columns = [
    { header: 'WBS Code', key: 'wbs', width: 12 },
    { header: 'Task Name', key: 'name', width: 40 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Duration (weeks)', key: 'duration', width: 15 },
    { header: 'Start Month', key: 'start', width: 12 },
    { header: 'End Month', key: 'end', width: 12 },
    { header: 'Dependencies', key: 'deps', width: 25 },
    { header: 'Owner', key: 'owner', width: 20 },
    { header: 'Status', key: 'status', width: 12 },
    { header: '% Complete', key: 'complete', width: 12 }
  ];

  for (let i = 0; i < workstreams.length; i++) {
    const ws = workstreams[i];
    sheet.addRow({
      wbs: ws.wbsCode || `${i + 1}.0`,
      name: ws.name,
      description: ws.description || '',
      duration: ws.durationWeeks || (ws.endMonth - ws.startMonth) * 4,
      start: ws.startMonth,
      end: ws.endMonth,
      deps: ws.dependencies.map(d => 
        `${d.workstreamId}${d.type === 'finish-to-start' ? 'FS' : 'SS'}${d.lagDays ? `+${d.lagDays}` : ''}`
      ).join(', '),
      owner: ws.owner || 'TBD',
      status: 'Pending',
      complete: 0
    });
  }

  // Style
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD5E8F0' }
  };
}

function addScheduleSheet(workbook: ExcelJS.Workbook, workstreams: WorkstreamForExport[]): void {
  const sheet = workbook.addWorksheet('Schedule');

  // Find max end month for column headers
  const maxMonth = Math.max(...workstreams.map(ws => ws.endMonth), 12);

  const columns: Partial<ExcelJS.Column>[] = [
    { header: 'Task ID', key: 'id', width: 10 },
    { header: 'Task Name', key: 'name', width: 35 },
    { header: 'Start', key: 'start', width: 10 },
    { header: 'End', key: 'end', width: 10 },
    { header: 'Duration', key: 'duration', width: 10 },
    { header: 'Predecessors', key: 'pred', width: 15 }
  ];

  // Add month columns for Gantt
  for (let m = 1; m <= maxMonth; m++) {
    columns.push({ header: `M${m}`, key: `m${m}`, width: 5 });
  }

  sheet.columns = columns;

  for (const ws of workstreams) {
    const row: Record<string, unknown> = {
      id: ws.id,
      name: ws.name,
      start: ws.startMonth,
      end: ws.endMonth,
      duration: ws.endMonth - ws.startMonth + 1,
      pred: ws.dependencies.map(d => d.workstreamId).join(', ')
    };

    // Fill Gantt cells
    for (let m = ws.startMonth; m <= ws.endMonth; m++) {
      row[`m${m}`] = '█';
    }

    sheet.addRow(row);
  }

  // Style
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD5E8F0' }
  };
}

function addResourcesSheet(workbook: ExcelJS.Workbook, workstreams: WorkstreamForExport[]): void {
  const sheet = workbook.addWorksheet('Resources');

  // Collect all unique roles
  const roles = new Set<string>();
  for (const ws of workstreams) {
    for (const r of ws.resources || []) {
      roles.add(r.role);
    }
  }

  const columns: Partial<ExcelJS.Column>[] = [
    { header: 'Role', key: 'role', width: 25 },
    { header: 'Total FTE', key: 'total', width: 12 }
  ];

  for (const ws of workstreams) {
    columns.push({ header: ws.id, key: ws.id, width: 10 });
  }

  sheet.columns = columns;

  for (const role of roles) {
    const row: Record<string, unknown> = { role };
    let total = 0;

    for (const ws of workstreams) {
      const resource = ws.resources?.find(r => r.role === role);
      const fte = resource?.fteAllocation || 0;
      row[ws.id] = fte > 0 ? fte : '';
      total += fte;
    }

    row.total = total;
    sheet.addRow(row);
  }

  // Style
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD5E8F0' }
  };
}

function addBudgetSheet(workbook: ExcelJS.Workbook, budget: BudgetLineForExport[]): void {
  const sheet = workbook.addWorksheet('Budget');

  sheet.columns = [
    { header: 'Workstream', key: 'ws', width: 20 },
    { header: 'Category', key: 'category', width: 12 },
    { header: 'Amount', key: 'amount', width: 15 },
    { header: 'Notes', key: 'notes', width: 40 }
  ];

  for (const line of budget) {
    sheet.addRow({
      ws: line.workstreamName || line.workstreamId,
      category: line.category,
      amount: line.amount,
      notes: line.notes || ''
    });
  }

  // Add total row
  const totalRow = sheet.addRow({
    ws: 'TOTAL',
    category: '',
    amount: budget.reduce((sum, b) => sum + b.amount, 0),
    notes: ''
  });
  totalRow.font = { bold: true };

  // Style
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD5E8F0' }
  };

  // Format amount column as currency
  sheet.getColumn('amount').numFmt = '$#,##0.00';
}

function addRACISheet(workbook: ExcelJS.Workbook, workstreams: WorkstreamForExport[]): void {
  const sheet = workbook.addWorksheet('RACI');

  // Collect all unique roles
  const roles = new Set<string>();
  for (const ws of workstreams) {
    for (const r of ws.resources || []) {
      roles.add(r.role);
    }
  }

  const columns: Partial<ExcelJS.Column>[] = [
    { header: 'Role', key: 'role', width: 25 }
  ];

  for (const ws of workstreams) {
    columns.push({ header: ws.id, key: ws.id, width: 10 });
  }

  sheet.columns = columns;

  // For now, assign R to all allocated resources
  // In a full implementation, this would come from actual RACI data
  for (const role of roles) {
    const row: Record<string, string> = { role };
    for (const ws of workstreams) {
      const hasRole = ws.resources?.some(r => r.role === role);
      row[ws.id] = hasRole ? 'R' : '';
    }
    sheet.addRow(row);
  }

  // Style
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD5E8F0' }
  };
}

function addRisksSheet(workbook: ExcelJS.Workbook, risks: RiskForExport[]): void {
  const sheet = workbook.addWorksheet('Risks');

  sheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Category', key: 'category', width: 15 },
    { header: 'Probability', key: 'probability', width: 12 },
    { header: 'Impact', key: 'impact', width: 12 },
    { header: 'Mitigation', key: 'mitigation', width: 50 },
    { header: 'Owner', key: 'owner', width: 20 }
  ];

  for (const risk of risks) {
    sheet.addRow({
      id: risk.id,
      description: risk.description,
      category: risk.category || 'General',
      probability: risk.probability || 'Medium',
      impact: risk.impact || 'Medium',
      mitigation: risk.mitigation || '',
      owner: risk.owner || 'TBD'
    });
  }

  // Style
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD5E8F0' }
  };
}

function addAssumptionsSheet(
  workbook: ExcelJS.Workbook, 
  assumptions: string[], 
  constraints: string[]
): void {
  const sheet = workbook.addWorksheet('Assumptions');

  sheet.columns = [
    { header: 'Type', key: 'type', width: 15 },
    { header: 'Statement', key: 'statement', width: 80 }
  ];

  for (const a of assumptions) {
    sheet.addRow({ type: 'Assumption', statement: a });
  }

  for (const c of constraints) {
    sheet.addRow({ type: 'Constraint', statement: c });
  }

  // Style
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD5E8F0' }
  };
}
```

### TEST 3.2:

Create `/tests/services/excel-export-service.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateExcelWorkbook, ProgramForExport } from '../../server/services/excel-export-service';
import ExcelJS from 'exceljs';

describe('ExcelExportService', () => {

  const testProgram: ProgramForExport = {
    name: 'Test Program',
    objective: 'Test objective',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-06-30'),
    totalBudget: 500000,
    workstreams: [
      {
        id: 'WS001',
        wbsCode: '1.0',
        name: 'Phase 1',
        description: 'First phase',
        startMonth: 1,
        endMonth: 2,
        durationWeeks: 8,
        dependencies: [],
        owner: 'PM',
        deliverables: [{ name: 'Deliverable 1', acceptanceCriteria: ['Criteria 1'] }],
        resources: [{ role: 'PM', fteAllocation: 1.0 }, { role: 'Dev', fteAllocation: 0.5 }]
      },
      {
        id: 'WS002',
        wbsCode: '2.0',
        name: 'Phase 2',
        description: 'Second phase',
        startMonth: 3,
        endMonth: 4,
        durationWeeks: 8,
        dependencies: [{ workstreamId: 'WS001', type: 'finish-to-start' }],
        owner: 'Tech Lead',
        deliverables: [{ name: 'Deliverable 2' }],
        resources: [{ role: 'Dev', fteAllocation: 1.0 }]
      }
    ],
    riskRegister: [
      { id: 'R001', description: 'Risk 1', category: 'Technical', probability: 'High', impact: 'High', mitigation: 'Mitigation 1', owner: 'PM' },
      { id: 'R002', description: 'Risk 2', category: 'Operational', probability: 'Medium', impact: 'Medium', mitigation: 'Mitigation 2', owner: 'Dev' },
      { id: 'R003', description: 'Risk 3', probability: 'Low', impact: 'Low', mitigation: 'Mitigation 3' },
      { id: 'R004', description: 'Risk 4', mitigation: 'Mitigation 4' },
      { id: 'R005', description: 'Risk 5', mitigation: 'Mitigation 5' },
    ],
    kpis: [
      { name: 'KPI 1', metric: 'Metric 1', baseline: 0, target: 100, unit: '%' },
      { name: 'KPI 2', metric: 'Metric 2', target: '50 days' }
    ],
    budget: [
      { workstreamId: 'WS001', workstreamName: 'Phase 1', category: 'OpEx', amount: 100000, notes: 'Labor' },
      { workstreamId: 'WS001', workstreamName: 'Phase 1', category: 'CapEx', amount: 50000, notes: 'Equipment' },
      { workstreamId: 'WS002', workstreamName: 'Phase 2', category: 'OpEx', amount: 150000, notes: 'Labor' }
    ],
    assumptions: ['Assumption 1', 'Assumption 2', 'Assumption 3'],
    constraints: ['Constraint 1', 'Constraint 2', 'Constraint 3']
  };

  it('generates valid Excel buffer', async () => {
    const buffer = await generateExcelWorkbook(testProgram);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('creates all 8 sheets', async () => {
    const buffer = await generateExcelWorkbook(testProgram);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheetNames = workbook.worksheets.map(s => s.name);
    expect(sheetNames).toContain('Executive Summary');
    expect(sheetNames).toContain('WBS');
    expect(sheetNames).toContain('Schedule');
    expect(sheetNames).toContain('Resources');
    expect(sheetNames).toContain('Budget');
    expect(sheetNames).toContain('RACI');
    expect(sheetNames).toContain('Risks');
    expect(sheetNames).toContain('Assumptions');
    expect(sheetNames.length).toBe(8);
  });

  it('WBS sheet has correct data', async () => {
    const buffer = await generateExcelWorkbook(testProgram);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const wbsSheet = workbook.getWorksheet('WBS')!;
    expect(wbsSheet.rowCount).toBeGreaterThan(1); // Header + data rows

    // Check header
    const header = wbsSheet.getRow(1);
    expect(header.getCell(1).value).toBe('WBS Code');
    expect(header.getCell(2).value).toBe('Task Name');

    // Check first data row
    const firstRow = wbsSheet.getRow(2);
    expect(firstRow.getCell(1).value).toBe('1.0');
    expect(firstRow.getCell(2).value).toBe('Phase 1');
  });

  it('Risks sheet contains all risks', async () => {
    const buffer = await generateExcelWorkbook(testProgram);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const risksSheet = workbook.getWorksheet('Risks')!;
    // Header + 5 risks
    expect(risksSheet.rowCount).toBe(6);
  });

  it('Budget sheet calculates total', async () => {
    const buffer = await generateExcelWorkbook(testProgram);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const budgetSheet = workbook.getWorksheet('Budget')!;
    const lastRow = budgetSheet.getRow(budgetSheet.rowCount);
    expect(lastRow.getCell(1).value).toBe('TOTAL');
    expect(lastRow.getCell(3).value).toBe(300000); // 100k + 50k + 150k
  });

  it('Schedule sheet has Gantt columns', async () => {
    const buffer = await generateExcelWorkbook(testProgram);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const scheduleSheet = workbook.getWorksheet('Schedule')!;
    const header = scheduleSheet.getRow(1);
    
    // Should have month columns
    let hasMonthColumn = false;
    header.eachCell((cell) => {
      if (cell.value?.toString().startsWith('M')) {
        hasMonthColumn = true;
      }
    });
    expect(hasMonthColumn).toBe(true);
  });

  it('Resources sheet shows FTE allocations', async () => {
    const buffer = await generateExcelWorkbook(testProgram);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const resourcesSheet = workbook.getWorksheet('Resources')!;
    expect(resourcesSheet.rowCount).toBeGreaterThan(1);

    // Find PM row and check total
    let pmTotal = 0;
    resourcesSheet.eachRow((row, rowNum) => {
      if (rowNum > 1 && row.getCell(1).value === 'PM') {
        pmTotal = row.getCell(2).value as number;
      }
    });
    expect(pmTotal).toBe(1.0); // PM is only in WS001 at 1.0 FTE
  });

  it('handles empty optional fields', async () => {
    const minimalProgram: ProgramForExport = {
      name: 'Minimal',
      workstreams: [
        {
          id: 'WS001',
          name: 'Only workstream',
          startMonth: 1,
          endMonth: 2,
          dependencies: []
        }
      ]
    };

    const buffer = await generateExcelWorkbook(minimalProgram);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
```

Run test:
```bash
./scripts/run-task-test.sh 3.2 tests/services/excel-export-service.test.ts
```

### GATE 3.2:
- [ ] All 7 tests pass
- [ ] Log file shows "GATE PASSED"

---

### REGRESSION CHECKPOINT 3

```bash
./scripts/run-regression.sh
```

### GATE RC3:
- [ ] All tests pass
- [ ] No regressions

---

## PHASE 4: PDF EXPORT

---

### TASK 4.1: Install PDFKit

```bash
npm install pdfkit
npm install --save-dev @types/pdfkit
```

### TEST 4.1:

```bash
node -e "require('pdfkit'); console.log('PDFKit installed')"
```

### GATE 4.1:
- [ ] PDFKit loads without error

---

### TASK 4.2: Create PDF Export Service

Create `/server/services/pdf-export-service.ts`:

```typescript
import PDFDocument from 'pdfkit';
import { ProgramForExport } from './excel-export-service';

export async function generatePDFSummary(program: ProgramForExport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 50,
      info: {
        Title: `${program.name} - Executive Summary`,
        Author: 'Premisia'
      }
    });
    
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .text(program.name, { align: 'center' });
    doc.moveDown();

    doc.fontSize(14)
       .font('Helvetica')
       .fillColor('#666666')
       .text('Program Planning Starter Kit - Executive Summary', { align: 'center' });
    doc.moveDown(2);

    // Reset color
    doc.fillColor('#000000');

    // Objective Section
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Objective');
    doc.fontSize(11)
       .font('Helvetica')
       .text(program.objective || 'No objective defined');
    doc.moveDown();

    // Timeline Section
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Timeline');
    doc.fontSize(11)
       .font('Helvetica');
    
    const startDate = program.startDate 
      ? program.startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'TBD';
    const endDate = program.endDate
      ? program.endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'TBD';
    
    doc.text(`Start Date: ${startDate}`);
    doc.text(`End Date: ${endDate}`);
    
    if (program.startDate && program.endDate) {
      const months = Math.ceil((program.endDate.getTime() - program.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
      doc.text(`Duration: ${months} months`);
    }
    doc.moveDown();

    // Budget Section
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Budget');
    doc.fontSize(11)
       .font('Helvetica');
    
    if (program.totalBudget) {
      doc.text(`Total Budget: $${program.totalBudget.toLocaleString()}`);
    } else if (program.budget && program.budget.length > 0) {
      const total = program.budget.reduce((sum, b) => sum + b.amount, 0);
      const capex = program.budget.filter(b => b.category === 'CapEx').reduce((sum, b) => sum + b.amount, 0);
      const opex = program.budget.filter(b => b.category === 'OpEx').reduce((sum, b) => sum + b.amount, 0);
      
      doc.text(`Total Budget: $${total.toLocaleString()}`);
      doc.text(`  CapEx: $${capex.toLocaleString()}`);
      doc.text(`  OpEx: $${opex.toLocaleString()}`);
    } else {
      doc.text('Budget: TBD');
    }
    doc.moveDown();

    // Workstreams Section
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Workstreams');
    doc.fontSize(11)
       .font('Helvetica');
    
    for (const ws of program.workstreams) {
      doc.text(`• ${ws.name} (Month ${ws.startMonth} - ${ws.endMonth})`, { indent: 10 });
    }
    doc.moveDown();

    // Top Risks Section
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text('Top Risks');
    doc.fontSize(11)
       .font('Helvetica');
    
    const risks = program.riskRegister || [];
    const topRisks = risks.slice(0, 5);
    
    if (topRisks.length > 0) {
      for (const risk of topRisks) {
        const prob = risk.probability || 'Medium';
        const impact = risk.impact || 'Medium';
        doc.text(`• [${prob}/${impact}] ${risk.description}`, { indent: 10 });
      }
    } else {
      doc.text('No risks identified');
    }
    doc.moveDown();

    // KPIs Section
    if (program.kpis && program.kpis.length > 0) {
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Key Performance Indicators');
      doc.fontSize(11)
         .font('Helvetica');
      
      for (const kpi of program.kpis) {
        const target = kpi.target !== undefined ? kpi.target : 'TBD';
        doc.text(`• ${kpi.name}: Target ${target}${kpi.unit ? ` ${kpi.unit}` : ''}`, { indent: 10 });
      }
      doc.moveDown();
    }

    // Key Assumptions Section
    if (program.assumptions && program.assumptions.length > 0) {
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Key Assumptions');
      doc.fontSize(11)
         .font('Helvetica');
      
      for (const assumption of program.assumptions.slice(0, 5)) {
        doc.text(`• ${assumption}`, { indent: 10 });
      }
      doc.moveDown();
    }

    // Key Constraints Section
    if (program.constraints && program.constraints.length > 0) {
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Key Constraints');
      doc.fontSize(11)
         .font('Helvetica');
      
      for (const constraint of program.constraints.slice(0, 5)) {
        doc.text(`• ${constraint}`, { indent: 10 });
      }
      doc.moveDown();
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(9)
       .fillColor('#999999')
       .text('Generated by Premisia - Program Planning Starter Kit', { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'center' });

    doc.end();
  });
}
```

### TEST 4.2:

Create `/tests/services/pdf-export-service.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generatePDFSummary } from '../../server/services/pdf-export-service';
import { ProgramForExport } from '../../server/services/excel-export-service';

describe('PDFExportService', () => {

  const testProgram: ProgramForExport = {
    name: 'Test Program',
    objective: 'Test objective for PDF generation',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-06-30'),
    totalBudget: 500000,
    workstreams: [
      {
        id: 'WS001',
        name: 'Phase 1 - Setup',
        startMonth: 1,
        endMonth: 2,
        dependencies: []
      },
      {
        id: 'WS002',
        name: 'Phase 2 - Implementation',
        startMonth: 3,
        endMonth: 5,
        dependencies: [{ workstreamId: 'WS001', type: 'finish-to-start' }]
      }
    ],
    riskRegister: [
      { id: 'R001', description: 'Resource availability risk', probability: 'High', impact: 'High', mitigation: 'Hire contractors' },
      { id: 'R002', description: 'Timeline delay risk', probability: 'Medium', impact: 'Medium', mitigation: 'Add buffer time' },
      { id: 'R003', description: 'Budget overrun risk', probability: 'Low', impact: 'High', mitigation: 'Weekly tracking' },
    ],
    kpis: [
      { name: 'On-time Delivery', target: '95', unit: '%' },
      { name: 'Budget Variance', target: '< 10%' }
    ],
    assumptions: [
      'Key resources will be available',
      'Requirements are stable',
      'Stakeholders remain engaged'
    ],
    constraints: [
      'Fixed budget of $500,000',
      'Must complete by June 30, 2026',
      'Limited to existing team'
    ]
  };

  it('generates valid PDF buffer', async () => {
    const buffer = await generatePDFSummary(testProgram);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('PDF starts with correct header bytes', async () => {
    const buffer = await generatePDFSummary(testProgram);
    // PDF files start with %PDF-
    const header = buffer.slice(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('handles minimal program', async () => {
    const minimalProgram: ProgramForExport = {
      name: 'Minimal Program',
      workstreams: [
        {
          id: 'WS001',
          name: 'Only workstream',
          startMonth: 1,
          endMonth: 2,
          dependencies: []
        }
      ]
    };

    const buffer = await generatePDFSummary(minimalProgram);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('handles program without optional fields', async () => {
    const noOptionals: ProgramForExport = {
      name: 'No Optionals',
      workstreams: [
        { id: 'WS001', name: 'WS', startMonth: 1, endMonth: 1, dependencies: [] }
      ],
      // No objective, dates, budget, risks, kpis, assumptions, constraints
    };

    const buffer = await generatePDFSummary(noOptionals);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('handles empty arrays', async () => {
    const emptyArrays: ProgramForExport = {
      name: 'Empty Arrays',
      workstreams: [],
      riskRegister: [],
      kpis: [],
      assumptions: [],
      constraints: []
    };

    const buffer = await generatePDFSummary(emptyArrays);
    expect(buffer).toBeInstanceOf(Buffer);
  });
});
```

Run test:
```bash
./scripts/run-task-test.sh 4.2 tests/services/pdf-export-service.test.ts
```

### GATE 4.2:
- [ ] All 5 tests pass
- [ ] Log file shows "GATE PASSED"

---

### REGRESSION CHECKPOINT 4

```bash
./scripts/run-regression.sh
```

### GATE RC4:
- [ ] All tests pass
- [ ] No regressions

---

## PHASE 5: EXPORT ENDPOINT INTEGRATION

---

### TASK 5.1: Create Export Controller

Create `/server/api/export-controller.ts`:

```typescript
import { generateExcelWorkbook, ProgramForExport } from '../services/excel-export-service';
import { generatePDFSummary } from '../services/pdf-export-service';
import { runQualityGates } from '../intelligence/quality-gates';

export interface ExportResult {
  success: boolean;
  excelBuffer?: Buffer;
  pdfBuffer?: Buffer;
  qualityGatesPassed: boolean;
  blockers: string[];
  warnings: string[];
  fixes: string[];
}

export async function generateStarterKitExports(program: ProgramForExport, industry: string): Promise<ExportResult> {
  // Run quality gates first
  const qualityResult = runQualityGates({
    industry,
    workstreams: program.workstreams.map(ws => ({
      id: ws.id,
      name: ws.name,
      description: ws.description || '',
      startMonth: ws.startMonth,
      endMonth: ws.endMonth,
      durationDays: ws.durationWeeks ? ws.durationWeeks * 7 : undefined,
      dependencies: ws.dependencies,
      deliverables: ws.deliverables,
      resources: ws.resources
    })),
    riskRegister: program.riskRegister,
    kpis: program.kpis
  });

  // Log results
  console.log('[Export] Quality Gates:', {
    passed: qualityResult.passed,
    blockers: qualityResult.blockers.length,
    warnings: qualityResult.warnings.length,
    fixes: qualityResult.fixes.length
  });

  // Generate exports even if quality gates have warnings (but not blockers in strict mode)
  // For now, we generate regardless but include the quality info
  try {
    const [excelBuffer, pdfBuffer] = await Promise.all([
      generateExcelWorkbook(program),
      generatePDFSummary(program)
    ]);

    return {
      success: true,
      excelBuffer,
      pdfBuffer,
      qualityGatesPassed: qualityResult.passed,
      blockers: qualityResult.blockers,
      warnings: qualityResult.warnings,
      fixes: qualityResult.fixes
    };
  } catch (error) {
    console.error('[Export] Generation failed:', error);
    return {
      success: false,
      qualityGatesPassed: qualityResult.passed,
      blockers: qualityResult.blockers,
      warnings: qualityResult.warnings,
      fixes: qualityResult.fixes
    };
  }
}
```

### TEST 5.1:

Create `/tests/api/export-controller.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateStarterKitExports } from '../../server/api/export-controller';
import { ProgramForExport } from '../../server/services/excel-export-service';

describe('ExportController', () => {

  const validProgram: ProgramForExport = {
    name: 'Test Program',
    objective: 'Test objective',
    workstreams: [
      {
        id: 'WS001',
        name: 'Phase 1',
        description: 'First phase',
        startMonth: 1,
        endMonth: 2,
        durationWeeks: 8,
        dependencies: [],
        deliverables: [{ name: 'Deliverable 1', acceptanceCriteria: ['Done'] }],
        resources: [{ role: 'PM', fteAllocation: 1.0 }]
      }
    ],
    riskRegister: [
      { id: 'R001', description: 'Risk 1', mitigation: 'Action 1', probability: 'High', impact: 'High' },
      { id: 'R002', description: 'Risk 2', mitigation: 'Action 2', probability: 'Medium', impact: 'Medium' },
      { id: 'R003', description: 'Risk 3', mitigation: 'Action 3', probability: 'Low', impact: 'Low' },
      { id: 'R004', description: 'Risk 4', mitigation: 'Action 4', probability: 'Medium', impact: 'High' },
      { id: 'R005', description: 'Risk 5', mitigation: 'Action 5', probability: 'High', impact: 'Low' },
    ],
    kpis: [
      { name: 'KPI 1', target: '100%' }
    ]
  };

  it('generates both Excel and PDF', async () => {
    const result = await generateStarterKitExports(validProgram, 'general');
    
    expect(result.success).toBe(true);
    expect(result.excelBuffer).toBeInstanceOf(Buffer);
    expect(result.pdfBuffer).toBeInstanceOf(Buffer);
  });

  it('runs quality gates and reports results', async () => {
    const result = await generateStarterKitExports(validProgram, 'general');
    
    expect(result.qualityGatesPassed).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it('reports quality gate failures but still generates', async () => {
    const badProgram: ProgramForExport = {
      name: 'Bad Program',
      workstreams: [
        {
          id: 'WS001',
          name: 'Phase 1',
          startMonth: 1,
          endMonth: 2,
          dependencies: [],
          // Missing deliverables and resources
        }
      ],
      riskRegister: [
        { id: 'R001', description: 'Risk', mitigation: 'Monitor and implement controls' } // Generic!
      ],
      kpis: [
        { name: 'Bad KPI', target: 'Improvement' } // Unmeasurable!
      ]
    };

    const result = await generateStarterKitExports(badProgram, 'retail');
    
    expect(result.success).toBe(true); // Still generates
    expect(result.qualityGatesPassed).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it('detects industry contamination', async () => {
    const contaminatedProgram: ProgramForExport = {
      name: 'Sneaker Store',
      workstreams: [
        {
          id: 'WS001',
          name: 'Food Safety Compliance',
          description: 'Kitchen health inspection',
          startMonth: 1,
          endMonth: 2,
          dependencies: [],
          deliverables: [{ name: 'D' }],
          resources: [{ role: 'PM', fteAllocation: 1.0 }]
        }
      ],
      riskRegister: Array(5).fill({ id: 'R', description: 'R', mitigation: 'Action' }),
      kpis: [{ name: 'KPI', target: '10' }]
    };

    const result = await generateStarterKitExports(contaminatedProgram, 'sneaker');
    
    expect(result.warnings.some(w => 
      w.toLowerCase().includes('food') || 
      w.toLowerCase().includes('kitchen') ||
      w.toLowerCase().includes('contamination')
    )).toBe(true);
  });

  it('reports FTE fixes', async () => {
    const badFTEProgram: ProgramForExport = {
      name: 'Test',
      workstreams: [
        {
          id: 'WS001',
          name: 'Phase 1',
          startMonth: 1,
          endMonth: 2,
          dependencies: [],
          deliverables: [{ name: 'D' }],
          resources: [{ role: 'PM', fteAllocation: 100 }] // Should be 1.0
        }
      ],
      riskRegister: Array(5).fill({ id: 'R', description: 'R', mitigation: 'Action' }),
      kpis: [{ name: 'KPI', target: '10' }]
    };

    const result = await generateStarterKitExports(badFTEProgram, 'general');
    
    expect(result.fixes.some(f => f.includes('100') || f.includes('1.0') || f.includes('1'))).toBe(true);
  });
});
```

Run test:
```bash
./scripts/run-task-test.sh 5.1 tests/api/export-controller.test.ts
```

### GATE 5.1:
- [ ] All 5 tests pass
- [ ] Log file shows "GATE PASSED"

---

### FINAL REGRESSION

```bash
./scripts/run-regression.sh
```

### GATE FINAL:
- [ ] All tests pass (should be 40+ tests)
- [ ] Log shows "ALL TESTS PASSED"

---

## COMPLETION CHECKLIST

After all gates pass, verify:

- [ ] `logs/` directory contains test outputs for all tasks
- [ ] All validators exist in `/server/intelligence/validators/`
- [ ] All normalizers exist in `/server/intelligence/normalizers/`
- [ ] Export services exist in `/server/services/`
- [ ] Quality gates integrated into EPM synthesizer
- [ ] Export controller ready for API integration

---

## POST-COMPLETION: INTEGRATION INTO EPM FLOW

Once all tests pass, integrate the export into the actual EPM generation flow:

1. After EPM program is generated, call `generateStarterKitExports()`
2. Save Excel/PDF to storage (S3, local, etc.)
3. Return URLs to frontend
4. Add download buttons to UI

This is left as manual integration because it depends on your specific:
- Storage system
- API framework (Express, Fastify, etc.)
- Frontend framework
- SSE/WebSocket setup

---

## TROUBLESHOOTING

### If tests fail:
1. Read the error message carefully
2. Check the specific assertion that failed
3. Fix the code
4. Re-run the test
5. Do NOT proceed until green

### If Replit loses context:
1. Read this document from the beginning
2. Check `logs/` directory to see last passed task
3. Resume from that task

### If imports fail:
1. Verify file paths are correct
2. Run `npm install` again
3. Check tsconfig.json paths

---

*End of Implementation Guide*
