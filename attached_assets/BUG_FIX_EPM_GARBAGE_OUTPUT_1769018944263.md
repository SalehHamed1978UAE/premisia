# CRITICAL BUG FIX: EPM Generating Garbage Output

**Date:** January 21, 2026
**Priority:** CRITICAL - Blocks all EPM generation
**Reported By:** Claude (Code Audit)

---

## Summary

EPM generation produces garbage template output instead of business-specific workstreams. The root cause is that `LegacyEPMGenerator` creates `EPMSynthesizer` without passing an LLM provider, causing WBS Builder to fail and fall back to generic templates.

---

## Symptoms

1. Workstreams have generic names like "Strategic Initiative 1" instead of business-specific names like "Location Scouting & Lease Negotiation"

2. Every workstream has the same 3 template deliverables:
   - "Initiative Charter"
   - "Implementation Plan"
   - "Progress Report Template"

3. Console shows:
   ```
   [EPM Synthesis] ⚠️ Generating template deliverables for workstreams (WBS Builder unavailable)
   ```

---

## Root Cause

**File:** `server/services/epm-generator/legacy-generator.ts`
**Line:** 64

```typescript
// CURRENT CODE - BUG:
const synthesizer = new EPMSynthesizer();  // NO LLM PASSED!
```

When `EPMSynthesizer` is instantiated without an LLM:
1. `this.llm` is `undefined` inside EPMSynthesizer
2. `createWBSBuilder(this.llm, ...)` passes `undefined` to WBS Builder
3. WBS Builder tries `this.llm.generateStructured()` which crashes
4. Error is caught, code falls back to garbage template generation

---

## The Fix

### Step 1: Modify `server/services/epm-generator/legacy-generator.ts`

**Replace lines 62-64:**

```typescript
// OLD CODE (lines 62-64):
      // Create synthesizer and generate
      const synthesizer = new EPMSynthesizer();
```

**With:**

```typescript
      // Create LLM provider that matches ILLMProvider interface for WBS Builder
      const { aiClients } = await import('../../ai-clients');

      const llmProvider = {
        async generateStructured<T>(request: { prompt: string; schema: any }): Promise<T> {
          const response = await aiClients.callWithFallback({
            systemPrompt: `You are a strategic business analyst helping create work breakdown structures.
Return valid JSON that exactly matches the requested schema.
Be specific and actionable - use real business terminology, not generic placeholders.
For a pizzeria, use terms like "Location Scouting", "Kitchen Equipment Procurement", "Staff Hiring".
For software, use terms like "Architecture Design", "MVP Development", "Beta Testing".`,
            userMessage: request.prompt,
          });

          try {
            return JSON.parse(response.content) as T;
          } catch (parseError) {
            console.error('[LegacyEPMGenerator] Failed to parse LLM response as JSON:', parseError);
            console.error('[LegacyEPMGenerator] Raw response:', response.content);
            throw new Error('LLM returned invalid JSON');
          }
        }
      };

      // Create synthesizer WITH LLM provider
      const synthesizer = new EPMSynthesizer(llmProvider);
```

### Step 2: Verify the Fix

After making the change, run an EPM generation and verify:

1. Console should show:
   ```
   [EPM Synthesis] Step 3: Calling WBS Builder to generate workstreams...
   [WBS Builder] ✓ WBS generation complete
   ```

   NOT:
   ```
   [EPM Synthesis] ⚠️ Generating template deliverables for workstreams (WBS Builder unavailable)
   ```

2. Output should have business-specific workstreams like:
   - "Location Scouting & Lease Negotiation"
   - "Kitchen Equipment Procurement & Installation"
   - "Staff Recruitment & Training"
   - "Menu Development & Supplier Setup"

   NOT:
   - "Strategic Initiative 1"
   - "Develop Initiative Charter for Strategic Initiative 1"

3. Deliverables should be specific like:
   - "Signed commercial lease agreement"
   - "Kitchen equipment installed and operational"
   - "Staff training program completed"

   NOT:
   - "Initiative Charter"
   - "Implementation Plan"
   - "Progress Report Template"

---

## Full Diff

```diff
--- a/server/services/epm-generator/legacy-generator.ts
+++ b/server/services/epm-generator/legacy-generator.ts
@@ -59,8 +59,30 @@ export class LegacyEPMGenerator implements IEPMGenerator {
         }
       }

-      // Create synthesizer and generate
-      const synthesizer = new EPMSynthesizer();
+      // Create LLM provider that matches ILLMProvider interface for WBS Builder
+      const { aiClients } = await import('../../ai-clients');
+
+      const llmProvider = {
+        async generateStructured<T>(request: { prompt: string; schema: any }): Promise<T> {
+          const response = await aiClients.callWithFallback({
+            systemPrompt: `You are a strategic business analyst helping create work breakdown structures.
+Return valid JSON that exactly matches the requested schema.
+Be specific and actionable - use real business terminology, not generic placeholders.
+For a pizzeria, use terms like "Location Scouting", "Kitchen Equipment Procurement", "Staff Hiring".
+For software, use terms like "Architecture Design", "MVP Development", "Beta Testing".`,
+            userMessage: request.prompt,
+          });
+
+          try {
+            return JSON.parse(response.content) as T;
+          } catch (parseError) {
+            console.error('[LegacyEPMGenerator] Failed to parse LLM response as JSON:', parseError);
+            console.error('[LegacyEPMGenerator] Raw response:', response.content);
+            throw new Error('LLM returned invalid JSON');
+          }
+        }
+      };
+
+      // Create synthesizer WITH LLM provider
+      const synthesizer = new EPMSynthesizer(llmProvider);
       const legacyResult = await synthesizer.synthesize(
         strategyInsights,
         { id: input.userId } as any,
```

---

## Why This Was Missed

1. The routes in `routes.ts` (lines 325, 461) correctly pass an LLM to EPMSynthesizer
2. But `legacy-generator.ts` was written later and didn't follow the same pattern
3. The fallback code silently catches the error and produces output, so it "works" but produces garbage
4. The error message `WBS Builder unavailable` was being logged but not flagged as a critical failure

---

## Additional Recommendation

Consider adding a check in `EPMSynthesizer.generateWorkstreams()` to fail loudly if no LLM is provided:

```typescript
// At the start of generateWorkstreams():
if (!this.llm) {
  throw new Error('EPMSynthesizer requires an LLM provider for WBS generation. Pass an LLM to the constructor.');
}
```

This prevents silent fallback to garbage output.

---

## Test Case

After fix, generate EPM for "open napoli pizzeria abu dhabi" and verify:

- [ ] Workstreams are pizzeria-specific (location, equipment, staff, menu, etc.)
- [ ] Deliverables are actionable (signed lease, equipment installed, staff trained)
- [ ] No "Strategic Initiative 1" or "Initiative Charter" garbage
- [ ] Console shows WBS Builder success, not fallback warning
