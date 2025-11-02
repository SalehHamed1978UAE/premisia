# Journey Registry V2 - QA Checklist

This document provides a comprehensive manual QA checklist for verifying the FEATURE_JOURNEY_REGISTRY_V2 feature flag implementation.

## Overview

The Journey Registry V2 feature includes:
- Journey summaries saved/loaded from completed runs
- Dynamic readiness thresholds from journey registry
- Summary display in Journey Launcher modal
- Baseline summary reuse for follow-on journeys

## Prerequisites

- Access to `.env` file to toggle feature flag
- Ability to restart the application
- Test user account with existing strategic understanding
- Access to browser developer tools

## Test Environment Setup

1. Ensure you have a test database with clean state
2. Have at least one completed journey session for testing baseline loading
3. Clear browser cache between flag state changes

---

## Part 1: Feature Flag OFF (Legacy Behavior)

### Setup
- [ ] Set `FEATURE_JOURNEY_REGISTRY_V2=false` in `.env`
- [ ] Restart the application
- [ ] Verify server logs show "Journey Registry V2 disabled" messages

### Test 1.1: Journey Execution Works Without Summaries

**Steps:**
1. Create a new strategic understanding (Input Page)
2. Navigate through Business Model Innovation journey:
   - Complete Five Whys analysis
   - Complete BMC research
   - Complete analysis
   - Make decisions
3. Verify journey completes successfully

**Expected Results:**
- [ ] No runtime errors in browser console
- [ ] No runtime errors in server logs
- [ ] Journey completes successfully through all steps
- [ ] Server logs show "Journey Registry V2 disabled, skipping summary save"
- [ ] No summary saved to database (check `journey_sessions.summary` is null)

### Test 1.2: Summary Endpoint Returns Empty

**Steps:**
1. Using browser developer tools, make a POST request to `/api/strategic-consultant/journeys/summary`
   ```json
   {
     "understandingId": "<your-understanding-id>",
     "journeyType": "business_model_innovation"
   }
   ```

**Expected Results:**
- [ ] Response status: 200 OK
- [ ] Response body: `{ "success": true, "summary": null }`
- [ ] Server logs show "Journey Registry V2 disabled, returning empty summary"

### Test 1.3: Readiness Check Uses Legacy Thresholds

**Steps:**
1. Using browser developer tools, make a POST request to `/api/strategic-consultant/journeys/check-readiness`
   ```json
   {
     "understandingId": "<your-understanding-id>",
     "journeyType": "business_model_innovation"
   }
   ```

**Expected Results:**
- [ ] Response status: 200 OK
- [ ] Server logs show "Using legacy thresholds: { minReferences: 0, minEntities: 0 }"
- [ ] Response indicates readiness based on legacy thresholds

### Test 1.4: Journey Launcher Modal - No Summary Display

**Steps:**
1. Navigate to Strategy Hub
2. Click "Start New Journey" on any strategy
3. Select "Business Model Innovation" journey

**Expected Results:**
- [ ] Modal opens without errors
- [ ] No summary section appears (even if you've completed BMI before)
- [ ] "Run Now" button still appears and functions
- [ ] No API calls to `/api/strategic-consultant/journeys/summary` in network tab

### Test 1.5: Config Endpoint Returns Flag State

**Steps:**
1. Make a GET request to `/api/strategic-consultant/config/features`

**Expected Results:**
- [ ] Response status: 200 OK
- [ ] Response body: `{ "journeyRegistryV2": false }`

---

## Part 2: Feature Flag ON (New Behavior)

### Setup
- [ ] Set `FEATURE_JOURNEY_REGISTRY_V2=true` in `.env`
- [ ] Restart the application
- [ ] Verify no "Journey Registry V2 disabled" messages in server logs

### Test 2.1: Journey Saves Summary on Completion

**Steps:**
1. Create a new strategic understanding
2. Complete a Business Model Innovation journey
3. Check database after completion

**Expected Results:**
- [ ] Journey completes successfully without errors
- [ ] Server logs show "✓ Journey summary saved for version X"
- [ ] Database `journey_sessions.summary` contains encrypted summary data
- [ ] Summary includes keyInsights, strategicImplications, and frameworks

### Test 2.2: New Journey Loads Baseline Summary

**Steps:**
1. Using an understandingId that has a completed BMI journey
2. Start a NEW BMI journey (version 2)
3. Check server logs during journey initialization

**Expected Results:**
- [ ] Server logs show "Loaded baseline summary from previous business_model_innovation run (version 1)"
- [ ] No errors during journey initialization
- [ ] New journey starts with context from previous run

### Test 2.3: Summary Endpoint Returns Data

**Steps:**
1. Complete a BMI journey (if not already done)
2. Make a POST request to `/api/strategic-consultant/journeys/summary`
   ```json
   {
     "understandingId": "<understanding-with-completed-journey>",
     "journeyType": "business_model_innovation"
   }
   ```

**Expected Results:**
- [ ] Response status: 200 OK
- [ ] Response contains summary data:
  ```json
  {
    "success": true,
    "summary": {
      "completedAt": "...",
      "versionNumber": 1,
      "keyInsights": [...],
      "strategicImplications": [...]
    }
  }
  ```

### Test 2.4: Readiness Check Uses Registry Thresholds

**Steps:**
1. Make a POST request to `/api/strategic-consultant/journeys/check-readiness`
   ```json
   {
     "understandingId": "<your-understanding-id>",
     "journeyType": "business_model_innovation"
   }
   ```

**Expected Results:**
- [ ] Response status: 200 OK
- [ ] Server logs show "Using registry thresholds: { minReferences: 0, minEntities: 0 }"
  (BMI journey has minReferences: 0, minEntities: 0 in journey-registry.ts)
- [ ] Response uses values from journey registry definition

### Test 2.5: Journey Launcher Modal Shows Summary

**Steps:**
1. Complete a BMI journey (if not already done)
2. Navigate to Strategy Hub
3. Click "Start New Journey" on the same strategy
4. Select "Business Model Innovation" journey

**Expected Results:**
- [ ] Modal opens without errors
- [ ] "Previous Analysis" summary card appears
- [ ] Summary shows version number, completion date
- [ ] Summary displays key insights (up to 3)
- [ ] Summary displays strategic implications (up to 2)
- [ ] Can expand/collapse summary using chevron icon
- [ ] Network tab shows successful API call to `/api/strategic-consultant/journeys/summary`

### Test 2.6: Config Endpoint Returns Flag State

**Steps:**
1. Make a GET request to `/api/strategic-consultant/config/features`

**Expected Results:**
- [ ] Response status: 200 OK
- [ ] Response body: `{ "journeyRegistryV2": true }`

---

## Part 3: Regression Testing

### Test 3.1: Existing Journeys Not Affected (Flag OFF)

**Steps:**
1. Set flag to `false`
2. Access an existing strategy with completed journey data
3. Navigate through various pages (Strategy Hub, EPM, Decisions)

**Expected Results:**
- [ ] All existing data displays correctly
- [ ] No errors in console or server logs
- [ ] EPM programs still accessible
- [ ] Strategic decisions still visible
- [ ] No data loss

### Test 3.2: Existing Journeys Not Affected (Flag ON)

**Steps:**
1. Set flag to `true`
2. Access an existing strategy with completed journey data
3. Navigate through various pages

**Expected Results:**
- [ ] All existing data displays correctly
- [ ] Summary data enhances the experience (if available)
- [ ] No errors in console or server logs
- [ ] EPM programs still accessible
- [ ] Strategic decisions still visible
- [ ] No data loss

### Test 3.3: Multiple Journey Versions

**Steps:**
1. Set flag to `true`
2. Complete BMI journey (version 1)
3. Start and complete another BMI journey (version 2)
4. Start a third BMI journey (version 3)

**Expected Results:**
- [ ] Each version saves its own summary
- [ ] Version 3 loads baseline from version 2 (most recent)
- [ ] No conflicts between versions
- [ ] All version histories remain intact

---

## Part 4: Error Handling

### Test 4.1: Graceful Handling When Summary Doesn't Exist (Flag ON)

**Steps:**
1. Set flag to `true`
2. Create a brand new strategic understanding
3. Try to fetch summary (should not exist)

**Expected Results:**
- [ ] Summary endpoint returns `{ "success": true, "summary": null }`
- [ ] No errors logged
- [ ] Journey Launcher modal shows no summary section
- [ ] Journey can still be started successfully

### Test 4.2: Invalid Journey Type

**Steps:**
1. Set flag to `true`
2. Make request to `/journeys/summary` with invalid journey type

**Expected Results:**
- [ ] Returns empty summary gracefully
- [ ] No server crashes
- [ ] Appropriate error handling

---

## Part 5: Performance Testing

### Test 5.1: Summary Query Performance (Flag ON)

**Steps:**
1. Create 10+ completed journey sessions
2. Fetch summary for latest journey
3. Monitor query time

**Expected Results:**
- [ ] Query completes in < 500ms
- [ ] Database indexes are used efficiently
- [ ] No N+1 query issues

### Test 5.2: Page Load Performance

**Steps:**
1. Toggle flag OFF and ON
2. Measure Strategy Hub page load time for both states

**Expected Results:**
- [ ] Flag OFF: Page loads normally (baseline)
- [ ] Flag ON: Page load time increase < 200ms
- [ ] No significant performance degradation

---

## Part 6: TypeScript/LSP Verification

### Test 6.1: No TypeScript Errors

**Steps:**
1. Run `npx tsc --noEmit` in project root
2. Check editor for TypeScript errors

**Expected Results:**
- [ ] No TypeScript compilation errors
- [ ] All imports resolve correctly
- [ ] No type mismatches

### Test 6.2: LSP Diagnostics Clean

**Steps:**
1. Open modified files in editor
2. Check for LSP warnings/errors

**Expected Results:**
- [ ] No LSP errors in `server/config.ts`
- [ ] No LSP errors in `server/journey/journey-orchestrator.ts`
- [ ] No LSP errors in `server/routes/strategic-consultant.ts`
- [ ] No LSP errors in `client/src/hooks/use-feature-flags.ts`
- [ ] No LSP errors in `client/src/components/JourneyLauncherModal.tsx`

---

## Part 7: Documentation Verification

### Test 7.1: Environment Documentation

**Expected Results:**
- [ ] `.env.example` includes `FEATURE_JOURNEY_REGISTRY_V2=false`
- [ ] Comment in `.env.example` explains the flag (if applicable)

### Test 7.2: Code Documentation

**Expected Results:**
- [ ] `server/config.ts` has JSDoc comments explaining the flag
- [ ] Inline comments in gated sections explain the behavior
- [ ] QA checklist exists and is comprehensive

---

## Sign-Off

### Flag OFF Testing
- [ ] All Part 1 tests passed
- [ ] All regression tests passed (Flag OFF)
- [ ] No runtime errors observed
- [ ] Tester name: _________________
- [ ] Date: _________________

### Flag ON Testing
- [ ] All Part 2 tests passed
- [ ] All regression tests passed (Flag ON)
- [ ] Summary feature works as expected
- [ ] Baseline loading verified
- [ ] Tester name: _________________
- [ ] Date: _________________

### Final Verification
- [ ] All error handling tests passed
- [ ] Performance tests passed
- [ ] TypeScript/LSP verification passed
- [ ] Documentation complete
- [ ] Ready for production deployment
- [ ] Tester name: _________________
- [ ] Date: _________________

---

## Known Limitations

1. Smoke tests in `tests/journey-registry.smoke.spec.ts` are structural only - full test implementation requires test framework setup
2. Summary feature only works for journeys with `summaryBuilder` defined in registry
3. Legacy hardcoded thresholds only defined for BMI and BMC journey types

## Troubleshooting

### Issue: "Journey Registry V2 disabled" not appearing in logs
**Solution:** Verify `.env` file is being read, check `process.env.FEATURE_JOURNEY_REGISTRY_V2` value

### Issue: Summary always returns null even with flag ON
**Solution:** Verify journey completed successfully, check `journey_sessions.summary` column in database

### Issue: TypeScript errors after implementation
**Solution:** Run `npm install` to ensure dependencies are up to date, check import paths

### Issue: Hot reload not picking up .env changes
**Solution:** Restart the application completely (not just hot reload)
