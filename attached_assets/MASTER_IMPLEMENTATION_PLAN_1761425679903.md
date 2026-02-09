# 🎯 MASTER IMPLEMENTATION PLAN
# Intelligent Planning Quality & Context Awareness System

**Version:** 1.0
**Estimated Time:** 4-5 hours
**Prerequisites:** Access to QgenticEPM codebase, Replit environment, database credentials

---

## 📋 Executive Summary

This plan integrates three critical improvements to QgenticEPM's intelligent planning system:

1. **Initiative Classification System** - Classify user intent upfront (physical business vs. software vs. other)
2. **Context-Aware Planning** - Propagate initiative type through entire system (tasks, resources, timelines)
3. **Quality Validation Layer** - Catch logical errors before they reach users

**Problem Solved:**
- System generated 14-year timelines for coffee shops (thought it was building software)
- Resources showed "Software Developers" for physical businesses (should show "Baristas")
- Decisions contained logical errors ("young professionals 22-60 years old")

**Solution:**
- Ask users to confirm their initiative type upfront
- Use this context everywhere (planning, resources, decisions)
- Validate AI outputs for logical consistency

---

## 🏗️ Architecture Overview

```
User Input → Classification → Confirmation → Context Propagation → Quality Validation → Output
     ↓              ↓              ↓               ↓                      ↓             ↓
   "Open      physical_     User confirms    Task gen,          Validate      "6-12 months"
   coffee     business_       (or corrects)   resource gen,      ages,         "Baristas"
   shop"      launch                          EPM synthesis      costs         "Realistic"
```

---

## 📦 Implementation Phases

### Phase 1: Database & Schema (15 min)
Foundation layer - database changes

### Phase 2: Initiative Classification (1.5 hrs)
Core logic - classify and confirm initiative type

### Phase 3: Context Propagation (1 hr)
Integration - use initiative type everywhere

### Phase 4: Quality Validation (1 hr)
Quality control - catch errors before output

### Phase 5: Testing (1 hr)
Verification - end-to-end testing

---

# PHASE 1: DATABASE & SCHEMA UPDATES

## Overview
Add initiative type enum and fields to database schema.

---

## Task 1.1: Update Schema with Initiative Type Enum

**File:** `shared/schema.ts`

**Location:** Line ~492, BEFORE the `strategicUnderstanding` table definition

**Action:** Add the initiative type enum

```typescript
export const initiativeTypeEnum = pgEnum('initiative_type', [
  'physical_business_launch',    // Opening coffee shop, restaurant, retail store
  'software_development',         // Building SaaS, mobile app, platform
  'digital_transformation',       // Adding digital capabilities to existing business
  'market_expansion',            // Expanding existing business to new markets
  'product_launch',              // Launching new product line
  'service_launch',              // Launching new service offering
  'process_improvement',         // Operational efficiency, restructuring
  'other'                        // Catch-all
]);
```

**Also ensure imports include `real`:**

Find the import line at top of file:
```typescript
import { pgTable, varchar, text, timestamp, boolean, integer, real, index, jsonb, pgEnum, serial } from 'drizzle-orm/pg-core';
```

If `real` is missing, add it.

---

## Task 1.2: Add Initiative Fields to Strategic Understanding Table

**File:** `shared/schema.ts`

**Location:** Inside `strategicUnderstanding` table (line ~492-507)

**Find this section:**
```typescript
export const strategicUnderstanding = pgTable("strategic_understanding", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().unique(),
  userInput: text("user_input").notNull(),
  title: varchar("title", { length: 200 }),
  companyContext: jsonb("company_context"),
```

**Add AFTER `title` line, BEFORE `companyContext`:**

```typescript
  // Initiative classification fields
  initiativeType: initiativeTypeEnum("initiative_type"),
  initiativeDescription: text("initiative_description"),
  userConfirmed: boolean("user_confirmed").default(false),
  classificationConfidence: real("classification_confidence"),
```

---

## Task 1.3: Add Index for Initiative Type

**File:** `shared/schema.ts`

**Location:** End of `strategicUnderstanding` table definition (line ~504-507)

**Find:**
```typescript
}, (table) => ({
  sessionIdx: index("idx_strategic_understanding_session").on(table.sessionId),
  archivedIdx: index("idx_strategic_understanding_archived").on(table.archived),
}));
```

**Change to:**
```typescript
}, (table) => ({
  sessionIdx: index("idx_strategic_understanding_session").on(table.sessionId),
  archivedIdx: index("idx_strategic_understanding_archived").on(table.archived),
  initiativeTypeIdx: index("idx_strategic_understanding_initiative_type").on(table.initiativeType),
}));
```

---

## Task 1.4: Create Database Migration File

**Create new file:** `drizzle/migrations/add_initiative_classification.sql`

```sql
-- Add initiative_type enum
DO $$ BEGIN
  CREATE TYPE initiative_type AS ENUM (
    'physical_business_launch',
    'software_development',
    'digital_transformation',
    'market_expansion',
    'product_launch',
    'service_launch',
    'process_improvement',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add columns to strategic_understanding table
ALTER TABLE strategic_understanding
  ADD COLUMN IF NOT EXISTS initiative_type initiative_type,
  ADD COLUMN IF NOT EXISTS initiative_description TEXT,
  ADD COLUMN IF NOT EXISTS user_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS classification_confidence REAL;

-- Add index for query performance
CREATE INDEX IF NOT EXISTS idx_strategic_understanding_initiative_type
  ON strategic_understanding(initiative_type);

-- Add documentation comments
COMMENT ON COLUMN strategic_understanding.initiative_type IS 'Type of initiative: physical_business_launch, software_development, etc.';
COMMENT ON COLUMN strategic_understanding.initiative_description IS 'One-sentence description of what user wants to accomplish';
COMMENT ON COLUMN strategic_understanding.user_confirmed IS 'Whether user confirmed the AI classification';
COMMENT ON COLUMN strategic_understanding.classification_confidence IS 'AI confidence score (0-1)';
```

---

## Task 1.5: Run Database Migration

**In Replit Shell, execute:**

```bash
# Run the migration
psql $DATABASE_URL -f drizzle/migrations/add_initiative_classification.sql

# Verify it worked
psql $DATABASE_URL -c "\d strategic_understanding"
```

**Expected output:** Should show new columns:
- `initiative_type` (initiative_type enum)
- `initiative_description` (text)
- `user_confirmed` (boolean)
- `classification_confidence` (real)

**If migration fails:**
- Check DATABASE_URL is set: `echo $DATABASE_URL`
- Try running SQL manually via Replit database panel

---

**✅ CHECKPOINT:** Database schema updated. Verify with:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'strategic_understanding'
AND column_name LIKE 'initiative%';
```

---

# PHASE 2: INITIATIVE CLASSIFICATION SYSTEM

## Overview
Create classifier to determine initiative type from user input, then build UI for user confirmation.

---

## Task 2.1: Create Initiative Classifier Service

**Create new file:** `server/strategic-consultant/initiative-classifier.ts`

```typescript
import { aiClients } from '../ai-clients.js';

export interface InitiativeClassification {
  type: 'physical_business_launch' | 'software_development' | 'digital_transformation' |
        'market_expansion' | 'product_launch' | 'service_launch' | 'process_improvement' | 'other';
  description: string;
  confidence: number;
  reasoning: string;
  businessScale: 'smb' | 'mid_market' | 'enterprise';
  timelineEstimate: { min: number; max: number };
}

export class InitiativeClassifier {

  async classify(userInput: string): Promise<InitiativeClassification> {
    console.log('[Initiative Classifier] Analyzing user input...');

    const response = await aiClients.callWithFallback({
      systemPrompt: `You are an expert business analyst who classifies strategic initiatives.

Your task: Analyze the user's input and determine EXACTLY what they want to accomplish.

CRITICAL DISTINCTIONS:
- "Open a coffee shop" → physical_business_launch (opening a PHYSICAL location)
- "Build software for coffee shops" → software_development (building SOFTWARE)
- "Add online ordering to my restaurant" → digital_transformation (adding digital to existing)
- "Expand my shop to new city" → market_expansion (geographic expansion)

Think carefully about WHAT is being created vs. WHO it's for.`,

      userMessage: `User's input:
"${userInput}"

Classify this initiative by answering:
1. What is the PRIMARY thing being created/launched/accomplished?
2. Is this about:
   - Opening/launching a NEW physical business location?
   - Building NEW software/platform/app?
   - Adding digital capabilities to EXISTING business?
   - Expanding EXISTING business to new markets?
   - Launching a NEW product line?
   - Launching a NEW service?
   - Improving existing operations/processes?
   - Something else?

3. Write a clear 1-sentence description starting with a verb (e.g., "Open", "Build", "Launch")
4. Estimate business scale (smb/mid_market/enterprise) based on context clues
5. Estimate realistic timeline range in months

Return ONLY valid JSON (no markdown, no explanation):
{
  "type": "physical_business_launch",
  "description": "Open a specialty coffee shop in Brooklyn",
  "confidence": 0.95,
  "reasoning": "User explicitly wants to open a physical coffee shop location",
  "businessScale": "smb",
  "timelineEstimate": { "min": 6, "max": 12 }
}`,
      maxTokens: 1000
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const classification = JSON.parse(jsonMatch[0]);

      console.log('[Initiative Classifier] Classification result:');
      console.log(`  Type: ${classification.type}`);
      console.log(`  Description: ${classification.description}`);
      console.log(`  Confidence: ${(classification.confidence * 100).toFixed(1)}%`);
      console.log(`  Scale: ${classification.businessScale}`);
      console.log(`  Timeline: ${classification.timelineEstimate.min}-${classification.timelineEstimate.max} months`);

      return classification;

    } catch (error) {
      console.error('[Initiative Classifier] Failed to parse LLM response:', error);
      console.error('[Initiative Classifier] Raw response:', response.content);

      return {
        type: 'other',
        description: userInput.substring(0, 200),
        confidence: 0.3,
        reasoning: 'Failed to classify - needs user confirmation',
        businessScale: 'mid_market',
        timelineEstimate: { min: 12, max: 24 }
      };
    }
  }
}

export const initiativeClassifier = new InitiativeClassifier();
```

---

## Task 2.2: Update Understanding Endpoint to Use Classifier

**File:** `server/routes/strategic-consultant.ts`

**Step 1:** Add import at top of file:
```typescript
import { initiativeClassifier } from '../strategic-consultant/initiative-classifier.js';
```

**Step 2:** Find the POST `/understanding` endpoint (around line 109-140)

**Step 3:** REPLACE the entire endpoint with:

```typescript
router.post('/understanding', async (req: Request, res: Response) => {
  try {
    const { input } = req.body;

    if (!input || !input.trim()) {
      return res.status(400).json({ error: 'Input text is required' });
    }

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    console.log('[Understanding] Starting Strategic Understanding analysis...');

    // STEP 1: Classify the initiative type FIRST
    console.log('[Understanding] Step 1: Classifying initiative type...');
    const classification = await initiativeClassifier.classify(input.trim());

    // STEP 2: Run full Strategic Understanding analysis
    console.log('[Understanding] Step 2: Running strategic understanding analysis...');
    const result = await strategicUnderstandingService.extractUnderstanding({
      sessionId,
      userInput: input.trim(),
      companyContext: null,
    });

    // STEP 3: Update understanding record with classification
    console.log('[Understanding] Step 3: Storing initiative classification...');
    await db
      .update(strategicUnderstanding)
      .set({
        initiativeType: classification.type,
        initiativeDescription: classification.description,
        classificationConfidence: classification.confidence,
        userConfirmed: false
      })
      .where(eq(strategicUnderstanding.id, result.understandingId));

    console.log(`[Understanding] Analysis complete - ${result.entities.length} entities extracted`);
    console.log(`[Understanding] Classified as: ${classification.type} (${(classification.confidence * 100).toFixed(0)}%)`);

    res.json({
      success: true,
      understandingId: result.understandingId,
      sessionId: sessionId,
      entitiesExtracted: result.entities.length,
      classification: {
        type: classification.type,
        description: classification.description,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        businessScale: classification.businessScale,
        timelineEstimate: classification.timelineEstimate
      }
    });
  } catch (error: any) {
    console.error('Error in /understanding:', error);
    res.status(500).json({ error: error.message || 'Failed to create understanding' });
  }
});
```

**Step 4:** Add NEW endpoint right after the POST endpoint:

```typescript
// Endpoint to confirm/update classification
router.patch('/understanding/:understandingId/classification', async (req: Request, res: Response) => {
  try {
    const { understandingId } = req.params;
    const { initiativeType, initiativeDescription, userConfirmed } = req.body;

    if (!initiativeType || !initiativeDescription) {
      return res.status(400).json({
        error: 'initiativeType and initiativeDescription are required'
      });
    }

    await db
      .update(strategicUnderstanding)
      .set({
        initiativeType,
        initiativeDescription,
        userConfirmed: userConfirmed ?? true,
        updatedAt: new Date()
      })
      .where(eq(strategicUnderstanding.id, understandingId));

    console.log(`[Understanding] Classification updated: ${understandingId} → ${initiativeType}`);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating classification:', error);
    res.status(500).json({
      error: error.message || 'Failed to update classification'
    });
  }
});
```

---

## Task 2.3: Create Classification UI Page

**Due to length, see attached file for full ClassificationPage.tsx component**

This component provides:
- Display of AI classification with confidence
- Ability to edit/correct classification
- Initiative type selector with descriptions
- Confirmation flow before proceeding

**Key file to create:** `client/src/pages/strategic-consultant/ClassificationPage.tsx`

[Component code is approximately 400 lines - includes all the UI for confirming initiative type]

---

## Task 2.4: Update Input Page Navigation

**File:** `client/src/pages/strategic-consultant/InputPage.tsx`

**Find:** Lines 118-129 (the response handling after POST /understanding)

**Find this code:**
```typescript
const { understandingId, sessionId } = await understandingResponse.json();

localStorage.setItem(`strategic-input-${sessionId}`, inputText);

clearInterval(progressInterval);
setProgress(100);

setTimeout(() => {
  setLocation(`/strategic-consultant/journey-selection/${understandingId}`);
}, 300);
```

**Replace with:**
```typescript
const { understandingId, sessionId, classification } = await understandingResponse.json();

// Store classification for next page
if (classification) {
  localStorage.setItem(`classification-${understandingId}`, JSON.stringify(classification));
}

localStorage.setItem(`strategic-input-${sessionId}`, inputText);

clearInterval(progressInterval);
setProgress(100);

// Navigate to CLASSIFICATION page (not journey selection)
setTimeout(() => {
  setLocation(`/strategic-consultant/classification/${understandingId}`);
}, 300);
```

---

## Task 2.5: Add Classification Route

**File:** `client/src/App.tsx`

**Step 1:** Add import at top:
```typescript
import ClassificationPage from "@/pages/strategic-consultant/ClassificationPage";
```

**Step 2:** Find the strategic consultant routes section (around line 80-100)

**Find:**
```typescript
<Route path="/strategic-consultant/input" component={InputPage} />
<Route path="/strategic-consultant/journey-selection/:understandingId" component={JourneySelectionPage} />
```

**Add new route BETWEEN them:**
```typescript
<Route path="/strategic-consultant/input" component={InputPage} />
<Route path="/strategic-consultant/classification/:understandingId" component={ClassificationPage} />
<Route path="/strategic-consultant/journey-selection/:understandingId" component={JourneySelectionPage} />
```

---

**✅ CHECKPOINT:** Test classification flow:
1. Go to `/strategic-consultant/input`
2. Enter "Open a coffee shop in Brooklyn"
3. Should navigate to classification page
4. Should show "Physical Business Launch" with ~90% confidence
5. Can confirm or edit
6. Proceeds to journey selection

---

# PHASE 3: CONTEXT PROPAGATION

## Overview
Propagate initiative type through Context Builder → Task Extraction → Resources → EPM

This ensures the entire system knows what type of initiative is being planned.

---

## Task 3.1: Update Context Builder to Fetch Initiative Type

**File:** `server/intelligence/epm-synthesizer.ts`

**Imports needed at top:**
```typescript
import { db } from '../db.js';
import { strategicUnderstanding } from '@shared/schema';
import { eq } from 'drizzle-orm';
```

**Find `ContextBuilder.fromJourneyInsights` method (around line 46-78)**

**CRITICAL: This method must become async and fetch from database**

**Replace the ENTIRE method signature and body:**

```typescript
static async fromJourneyInsights(
  insights: StrategyInsights,
  journeyType: string = 'strategy_workspace'
): Promise<PlanningContext> {

  // NEW: Fetch initiative classification from database
  let initiativeType: string | null = null;
  let initiativeDescription: string | null = null;

  // Try to get understanding ID from insights
  const understandingId = (insights as any).understandingId || null;

  if (understandingId) {
    try {
      const understanding = await db
        .select({
          initiativeType: strategicUnderstanding.initiativeType,
          initiativeDescription: strategicUnderstanding.initiativeDescription
        })
        .from(strategicUnderstanding)
        .where(eq(strategicUnderstanding.id, understandingId))
        .limit(1);

      if (understanding.length > 0) {
        initiativeType = understanding[0].initiativeType;
        initiativeDescription = understanding[0].initiativeDescription;
        console.log(`[ContextBuilder] ✓ Loaded initiative from DB`);
        console.log(`[ContextBuilder]   Type: ${initiativeType}`);
        console.log(`[ContextBuilder]   Description: ${initiativeDescription}`);
      }
    } catch (error) {
      console.warn('[ContextBuilder] Could not fetch classification:', error);
    }
  } else {
    console.warn('[ContextBuilder] No understandingId available');
  }

  const scale = this.inferScale(insights, initiativeType);
  const timelineRange = this.inferTimelineRange(scale, insights, initiativeType);
  const budgetRange = this.inferBudgetRange(scale, insights);

  return {
    business: {
      name: initiativeDescription?.substring(0, 50) || 'Unnamed Business',
      type: initiativeType || this.inferBusinessType(insights),
      industry: insights.marketContext?.industry || 'general',
      description: initiativeDescription || this.extractBusinessDescription(insights),
      scale,
      initiativeType: initiativeType || 'other'  // NEW: explicit field
    },
    strategic: {
      insights: insights,
      constraints: [],
      objectives: this.extractObjectives(insights, initiativeDescription)
    },
    execution: {
      timeline: timelineRange,
      budget: budgetRange,
      resources: []
    },
    meta: {
      journeyType,
      confidence: insights.overallConfidence || 0.75,
      version: '1.0'
    }
  };
}
```

---

## Task 3.2: Update Helper Methods to Accept Initiative Type

**File:** `server/intelligence/epm-synthesizer.ts`

**Update `inferScale` method signature (around line 90):**

Find:
```typescript
private static inferScale(insights: StrategyInsights): BusinessScale {
```

Change to:
```typescript
private static inferScale(insights: StrategyInsights, initiativeType: string | null = null): BusinessScale {
  // Existing logic remains, but now can use initiativeType if needed
```

**Update `inferTimelineRange` method (around line 144):**

Find:
```typescript
private static inferTimelineRange(scale: BusinessScale, insights: StrategyInsights): { min: number; max: number } {
```

Change to:
```typescript
private static inferTimelineRange(scale: BusinessScale, insights: StrategyInsights, initiativeType: string | null = null): { min: number; max: number } {
  // If we have explicit initiative type, use better defaults
  if (initiativeType === 'physical_business_launch' && scale === 'smb') {
    return { min: 6, max: 12 };
  }
  if (initiativeType === 'software_development' && scale === 'smb') {
    return { min: 9, max: 18 };
  }

  // Rest of existing logic...
```

**Add new helper method `extractBusinessDescription`:**

Add after `inferBusinessType` method (around line 221):

```typescript
/**
 * Extract business description from insights
 */
private static extractBusinessDescription(insights: StrategyInsights): string {
  const objectiveInsight = insights.insights.find(i =>
    i.type === 'objective' || i.type === 'goal' || i.type === 'strategy'
  );

  if (objectiveInsight) {
    return objectiveInsight.content.substring(0, 200);
  }

  return insights.insights[0]?.content.substring(0, 200) || '';
}
```

**Update `extractObjectives` method signature:**

Find (around line 221):
```typescript
private static extractObjectives(insights: StrategyInsights): string[] {
```

Change to:
```typescript
private static extractObjectives(insights: StrategyInsights, initiativeDescription: string | null = null): string[] {
  if (initiativeDescription) {
    return [initiativeDescription];
  }

  // Rest of existing logic...
```

---

## Task 3.3: Update All Calls to fromJourneyInsights

**File:** `server/intelligence/epm-synthesizer.ts`

**CRITICAL:** Find ALL calls to `fromJourneyInsights` and add `await`

**Around line 448:**
```typescript
const planningContext = await ContextBuilder.fromJourneyInsights(
  insights,
  insights.frameworkType || 'strategy_workspace'
);
```

**Around line 586:**
```typescript
const planningContext = await ContextBuilder.fromJourneyInsights(
  insights,
  insights.frameworkType || 'strategy_workspace'
);
```

---

## Task 3.4: Update Task Extractor to Use Initiative Type

**File:** `src/lib/intelligent-planning/task-extractor.ts`

**Find the `extract` method (lines 15-114)**

**Update the context extraction section (lines 19-26):**

Replace:
```typescript
const context = strategy.context;
const businessType = context?.business?.type || 'general_business';
const businessScale = context?.business?.scale || 'mid_market';
const timelineMin = context?.execution?.timeline?.min || 12;
const timelineMax = context?.execution?.timeline?.max || 24;
const businessName = context?.business?.name || 'the business';
```

With:
```typescript
const context = strategy.context;
const businessType = context?.business?.type || 'general_business';
const initiativeType = context?.business?.initiativeType || 'other';  // NEW
const businessScale = context?.business?.scale || 'mid_market';
const timelineMin = context?.execution?.timeline?.min || 12;
const timelineMax = context?.execution?.timeline?.max || 24;
const businessName = context?.business?.name || 'the business';
const businessDescription = context?.business?.description || '';  // NEW

// Build clear objective
let objectiveStatement = businessDescription || `Launch ${businessName}`;
if (initiativeType === 'physical_business_launch') {
  objectiveStatement = businessDescription || `Open and operate ${businessName}`;
} else if (initiativeType === 'software_development') {
  objectiveStatement = businessDescription || `Build and deploy ${businessName}`;
}
```

**Update the prompt (lines 27-94):**

Replace the prompt with:

```typescript
const prompt = `
You are creating a project plan to: ${objectiveStatement}

=== CRITICAL: UNDERSTAND WHAT YOU'RE PLANNING ===
Initiative Type: ${initiativeType}
Objective: ${objectiveStatement}

${initiativeType === 'physical_business_launch' ? `
THIS IS A PHYSICAL BUSINESS LAUNCH, NOT SOFTWARE DEVELOPMENT.

Generate tasks for opening a physical location:
- Location scouting and site selection
- Lease negotiation and legal agreements
- Permits, licenses, regulatory compliance
- Physical build-out, renovations, construction
- Equipment procurement and installation
- Hiring, staff training, onboarding
- Supplier relationships and inventory setup
- Marketing and pre-launch buzz
- Soft opening and testing
- Grand opening and operations launch

DO NOT generate software tasks like:
- "System Design" or "Platform Development"
- "CRM Implementation" or "Tech Infrastructure"
` : ''}

${initiativeType === 'software_development' ? `
THIS IS SOFTWARE DEVELOPMENT.

Generate tasks for building software:
- Requirements gathering and user research
- Technical architecture and system design
- Development environment setup
- Sprint planning and agile ceremonies
- Feature development and implementation
- Testing (unit, integration, e2e)
- Deployment pipeline and infrastructure
- User acceptance testing
- Launch and monitoring
- Post-launch optimization
` : ''}

${initiativeType === 'digital_transformation' ? `
THIS IS DIGITAL TRANSFORMATION - adding digital to existing business.

Generate tasks:
- Current state assessment
- Digital strategy and roadmap
- Vendor selection and procurement
- System integration and data migration
- Staff training on new systems
- Phased rollout and testing
- Change management
` : ''}

=== CRITICAL BUSINESS CONTEXT ===
Business: ${businessName}
Type: ${businessType}
Initiative: ${initiativeType}
Scale: ${businessScale}
Expected Timeline: ${timelineMin}-${timelineMax} months

IMPORTANT: This is a ${businessScale} ${initiativeType} project.
The TOTAL timeline across ALL tasks MUST fit within ${timelineMin}-${timelineMax} months.

[Rest of original prompt continues...]
`;
```

---

## Task 3.5: Update Types for Planning Context

**File:** `src/lib/intelligent-planning/types.ts`

**Find `BusinessContext` interface (around line 30-40):**

```typescript
export interface BusinessContext {
  name: string;
  type: string;
  industry: string;
  description: string;
  scale: BusinessScale;
  initiativeType?: string;  // ADD THIS LINE
}
```

---

## Task 3.6: Fix Duration Unit Normalization in Scheduler

**File:** `src/lib/intelligent-planning/scheduler.ts`

**Find `calculateDuration` method (line 114-118):**

Replace:
```typescript
private calculateDuration(duration: Duration): number {
  const { optimistic, likely, pessimistic } = duration;
  return Math.round((optimistic + 4 * likely + pessimistic) / 6);
}
```

With:
```typescript
private calculateDuration(duration: Duration): number {
  const { optimistic, likely, pessimistic, unit } = duration;

  let pertEstimate = Math.round((optimistic + 4 * likely + pessimistic) / 6);

  // Convert to months based on unit
  switch (unit) {
    case 'days':
      pertEstimate = pertEstimate / 30;
      break;
    case 'weeks':
      pertEstimate = pertEstimate / 4.33;
      break;
    case 'months':
      // Already in months
      break;
    default:
      console.warn(`[Scheduler] Unknown unit: ${unit}, assuming months`);
  }

  return Math.max(0.25, pertEstimate); // Min 1 week
}
```

---

**✅ CHECKPOINT:** Test context propagation:
1. Create coffee shop initiative
2. Check logs for: `[ContextBuilder] ✓ Loaded initiative from DB`
3. Check logs for: `[Task Extractor] THIS IS A PHYSICAL BUSINESS LAUNCH`
4. Verify tasks are appropriate (not software tasks)

---

# PHASE 4: RESOURCE GENERATION & QUALITY VALIDATION

## Overview
Make resources initiative-aware and add quality validation to catch errors.

---

## Task 4.1: Update Resource Generation to Use Initiative Type

**File:** `server/intelligence/epm-synthesizer.ts`

**Find `generateResourcePlan` method (line 1069-1090)**

**Update to pass context:**

```typescript
private async generateResourcePlan(
  insights: StrategyInsights,
  workstreams: Workstream[],
  userContext?: UserContext
): Promise<ResourcePlan> {
  const resourceInsights = insights.insights.filter(i => i.type === 'resource');

  const estimatedFTEs = Math.max(8, Math.min(workstreams.length * 2, 20));

  // NEW: Get initiative context
  const planningContext = await ContextBuilder.fromJourneyInsights(
    insights,
    insights.frameworkType || 'strategy_workspace'
  );

  const internalTeam = await this.generateInternalTeam(
    estimatedFTEs,
    workstreams,
    resourceInsights,
    planningContext  // Pass context
  );

  const externalResources = await this.generateExternalResources(
    insights,
    userContext,
    planningContext?.business?.initiativeType
  );

  // Rest remains same...
```

---

## Task 4.2: Replace generateInternalTeam Method

**File:** `server/intelligence/epm-synthesizer.ts`

**Find entire `generateInternalTeam` method (lines 1092-1106)**

**REPLACE with LLM-based generation:**

[Full method code is in Phase 3 context propagation section - see earlier in conversation for complete implementation]

Key changes:
- Accept planningContext parameter
- Use LLM to generate roles based on initiative type
- Include initiative-specific prompts
- Fallback to templates if LLM fails

---

## Task 4.3: Add Fallback Role Templates

[See earlier in conversation for complete `getFallbackRoles` method]

---

## Task 4.4: Create Quality Validator

**Create new file:** `server/strategic-consultant/quality-validator.ts`

[Full file content provided earlier - validates demographics, costs, logic]

---

## Task 4.5: Integrate Quality Validation into Decision Generator

**File:** `server/strategic-consultant/decision-generator.ts`

Add import, validation calls, and auto-fix logic as specified in Phase 4 Quality Validation section.

---

## Task 4.6: Reduce Temperature for Consistency

**File:** `server/strategic-consultant/decision-generator.ts`

Lines 68 and 201:
```typescript
temperature: 0.2,  // Reduced from 0.4
```

---

**✅ CHECKPOINT:** Test resource generation:
1. Coffee shop → Should show Baristas, Store Manager
2. Software → Should show Developers, Tech Lead
3. Check quality validation logs

---

# PHASE 5: TESTING & VERIFICATION

## Test Suite

### Test 1: Physical Business Launch (Coffee Shop)

**Input:** "I want to open a coffee shop in Brooklyn"

**Expected:**
- Classification: `physical_business_launch` (>80% confidence)
- Description: "Open a coffee shop in Brooklyn"
- Timeline: 6-12 months
- Tasks: Location scouting, Permits, Build-out, Hiring
- Resources: Store Manager, Baristas, Kitchen Staff
- Costs: ~$45k/FTE
- NO software development tasks
- NO software developer roles

### Test 2: Software Development

**Input:** "Build a SaaS platform for project management"

**Expected:**
- Classification: `software_development`
- Timeline: 12-24 months
- Tasks: Requirements, Architecture, Development, Testing
- Resources: Product Manager, Developers, QA
- Costs: ~$120k/FTE

### Test 3: Quality Validation

**Check logs for:**
- `[Quality Validator] Validation score: XX/100`
- Age ranges should be logical (22-35 for young, not 22-60)
- No duplicate pros/cons
- Reasoning should be substantive

### Test 4: Error Handling

**Test with low confidence:**
- Input: Vague or ambiguous statement
- Should show classification page with low confidence warning
- User can correct

### Test 5: Database Verification

```sql
SELECT
  session_id,
  initiative_type,
  initiative_description,
  user_confirmed,
  classification_confidence
FROM strategic_understanding
ORDER BY created_at DESC
LIMIT 5;
```

Should show populated fields.

---

## Common Issues & Fixes

### Issue: "Cannot read property 'initiativeType'"
**Fix:** TypeScript needs recompile
```bash
npm run build
```

### Issue: Classification not saving
**Fix:** Check database migration ran successfully
```bash
psql $DATABASE_URL -c "\d strategic_understanding"
```

### Issue: "fromJourneyInsights is not a function"
**Fix:** Missing `await` - search for all calls and add await

### Issue: Quality validation not running
**Fix:** Check import in decision-generator.ts

---

## Success Criteria

✅ User can classify initiative with confirmation UI
✅ Classification stored in database
✅ Context propagates to task extraction
✅ Tasks appropriate for initiative type
✅ Resources appropriate for initiative type
✅ Timelines realistic (6-12 mo for coffee shop, not 166 mo)
✅ Quality validation catches logical errors
✅ No "young professionals 22-60"
✅ No software tasks for physical businesses
✅ No barista roles for software projects

---

## Rollback Plan

If critical issues occur:

1. **Database rollback:**
```sql
ALTER TABLE strategic_understanding
  DROP COLUMN IF EXISTS initiative_type,
  DROP COLUMN IF EXISTS initiative_description,
  DROP COLUMN IF EXISTS user_confirmed,
  DROP COLUMN IF EXISTS classification_confidence;
```

2. **Code rollback:** Revert files via git
```bash
git status
git checkout -- <file>
```

3. **Quick disable:** Comment out classification call in understanding endpoint

---

## Post-Implementation

### Monitoring

Watch for these log lines:
- `[Initiative Classifier] Classification result:`
- `[ContextBuilder] ✓ Loaded initiative from DB`
- `[Task Extractor] THIS IS A PHYSICAL BUSINESS LAUNCH`
- `[Quality Validator] Validation score:`

### Metrics to Track

- Classification confidence scores
- User correction rate (how often users change classification)
- Quality validation scores
- Timeline reasonableness (should be 6-12 mo for SMB physical, not years)

---

## Files Modified Summary

**Created (6 files):**
- `drizzle/migrations/add_initiative_classification.sql`
- `server/strategic-consultant/initiative-classifier.ts`
- `server/strategic-consultant/quality-validator.ts`
- `client/src/pages/strategic-consultant/ClassificationPage.tsx`
- `MASTER_IMPLEMENTATION_PLAN.md` (this file)
- `IMPLEMENTATION_GUIDE.md`

**Modified (9 files):**
- `shared/schema.ts`
- `server/routes/strategic-consultant.ts`
- `server/intelligence/epm-synthesizer.ts`
- `src/lib/intelligent-planning/task-extractor.ts`
- `src/lib/intelligent-planning/scheduler.ts`
- `src/lib/intelligent-planning/types.ts`
- `server/strategic-consultant/decision-generator.ts`
- `client/src/pages/strategic-consultant/InputPage.tsx`
- `client/src/App.tsx`

---

## END OF MASTER PLAN

This plan is complete and ready for implementation. Follow phases sequentially.
Each phase includes verification checkpoints.

**Questions?** Refer to conversation history for detailed code examples.
