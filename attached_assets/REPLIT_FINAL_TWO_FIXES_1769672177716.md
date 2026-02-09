# Replit: Fix These Two Remaining Issues

## Issue 1: "Unnamed Business" Still Appearing (6 occurrences)

### Step 1: Find the source

Run this in your terminal:
```bash
grep -rn "Unnamed Business" --include="*.ts" .
```

This will show you every file where "Unnamed Business" appears as a default/fallback.

### Step 2: Add debug logging to context-builder.ts

In `server/intelligence/epm/context-builder.ts`, find the function that builds context (likely `buildContext()` or similar).

Add this at the START of the function:
```typescript
console.log('[ContextBuilder] INPUT:', {
  sessionId,
  userInput: userInput?.substring(0, 100),
  title,
  initiativeType
});
```

Add this at the END, right before the return statement:
```typescript
console.log('[ContextBuilder] OUTPUT:', {
  businessName: context.business.name,
  industry: context.business.industry
});
```

### Step 3: Find where business.name is set

Look for code like this:
```typescript
business: {
  name: 'Unnamed Business',  // ← THIS IS THE PROBLEM
  ...
}
```

Change it to:
```typescript
business: {
  name: extractedBusinessName || title || userInput?.split(' ').slice(0, 5).join(' ') || 'the business',
  ...
}
```

### Step 4: Check your extractBusinessName function

You said you added this function. Find it and add a log:
```typescript
function extractBusinessName(userInput: string, title?: string): string {
  console.log('[extractBusinessName] Input:', { userInput: userInput?.substring(0, 50), title });
  
  // Your existing extraction logic...
  const result = /* your logic */;
  
  console.log('[extractBusinessName] Result:', result);
  return result;
}
```

### Step 5: Ensure the extracted name is USED in the return object

The extraction might work, but if you don't assign it to `business.name`, it's lost:

```typescript
// WRONG - extraction works but value not used:
const extractedName = extractBusinessName(userInput, title);
return {
  business: {
    name: 'Unnamed Business',  // ← STILL HARDCODED!
    ...
  }
};

// CORRECT - use the extracted value:
const extractedName = extractBusinessName(userInput, title);
return {
  business: {
    name: extractedName || 'the business',
    ...
  }
};
```

### Step 6: Run test and check logs

Run "Basketball Sneaker Store in Abu Dhabi" and check server console for:
```
[ContextBuilder] INPUT: { sessionId: '...', userInput: 'Basketball Sneaker Store...', title: '...' }
[extractBusinessName] Input: { userInput: 'Basketball Sneaker...', title: '...' }
[extractBusinessName] Result: 'Basketball Sneaker Store'
[ContextBuilder] OUTPUT: { businessName: 'Basketball Sneaker Store', industry: 'Specialty Retail' }
```

If `businessName` shows `'Unnamed Business'` in OUTPUT but extraction shows a value, the assignment is broken.
If extraction shows `undefined`, the regex/extraction logic is broken.

---

## Issue 2: Benefit Responsible Party Still "-"

### Step 1: Find where benefits are created

```bash
grep -rn "responsibleParty\|responsible_party\|Responsible Party" --include="*.ts" .
```

### Step 2: Copy the pattern that works for workstreams

You already have `assignWorkstreamOwners()` working. Look at that function and copy the pattern:

```typescript
// Add this function near assignWorkstreamOwners()
function assignBenefitOwners(benefits: Benefit[], resources: ResourceAllocation[]): Benefit[] {
  return benefits.map(benefit => {
    let owner = '-';
    
    if (benefit.category === 'Financial') {
      const match = resources.find(r => 
        r.role.toLowerCase().includes('financial') || 
        r.role.toLowerCase().includes('finance') ||
        r.role.toLowerCase().includes('performance')
      );
      owner = match?.role || resources[0]?.role || '-';
    } 
    else if (benefit.category === 'Strategic') {
      const match = resources.find(r => 
        r.role.toLowerCase().includes('strategy') || 
        r.role.toLowerCase().includes('lead') ||
        r.role.toLowerCase().includes('director')
      );
      owner = match?.role || resources[0]?.role || '-';
    }
    else if (benefit.category === 'Operational') {
      const match = resources.find(r => 
        r.role.toLowerCase().includes('operations') || 
        r.role.toLowerCase().includes('manager')
      );
      owner = match?.role || resources[0]?.role || '-';
    }
    else {
      // Default to first resource
      owner = resources[0]?.role || '-';
    }
    
    return {
      ...benefit,
      responsibleParty: owner
    };
  });
}
```

### Step 3: Call the function after benefits are created

In EPMSynthesizer or wherever benefits are generated:
```typescript
// After benefits are created and resources are allocated:
const benefitsWithOwners = assignBenefitOwners(benefits, allocatedResources);
```

### Step 4: Update the Benefit interface if needed

In your types file, ensure Benefit has:
```typescript
interface Benefit {
  id: string;
  name: string;
  description: string;
  category: string;
  metric?: string;
  target?: string;
  timeframe?: string;
  responsibleParty?: string;  // ← ADD THIS IF MISSING
}
```

### Step 5: Update CSV exporter

In `server/services/export/csv-exporter.ts`, find the benefits export section and ensure it uses:
```typescript
benefit.responsibleParty || '-'
```

---

## Verification Checklist

After making changes, restart server and run "Basketball Sneaker Store in Abu Dhabi":

### Check Server Logs:
- [ ] `[ContextBuilder] OUTPUT: { businessName: 'Basketball Sneaker Store', ... }`
- [ ] No errors in console

### Check workstreams.csv:
```bash
grep -i "unnamed business" workstreams.csv
# Should return: nothing (0 matches)
```

### Check benefits.csv:
- [ ] Responsible Party column has values (not all "-")
- [ ] At least one benefit shows a role like "Omnichannel Retail Strategy Lead"

### Export ZIP and send for verification

---

## Do NOT Touch (These Are Working)

- ✅ Food contamination fix
- ✅ FTE decimals
- ✅ Confidence variation  
- ✅ Workstream owners
- ✅ Resource skills
- ✅ Generic industry language fix

---

*End of Instructions*
