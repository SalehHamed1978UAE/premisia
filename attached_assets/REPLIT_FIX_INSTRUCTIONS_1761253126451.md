# GANTT CHART RENDERING FIXES - For Replit

## Issue
Gantt chart displaying with overlapping elements and truncated text as shown in screenshot.

## Solution
Replace 2 files with fixed versions that have proper spacing and label positioning.

---

## Replit Instructions

```
GANTT CHART DISPLAY FIXES:

Replace these 2 files:

1. gantt-utils-FIXED.ts → client/src/lib/gantt-utils.ts
   (Fixed chart dimensions and spacing)

2. GanttChart-FIXED.tsx → client/src/components/epm/GanttChart.tsx
   (Fixed label positioning and text truncation)

DO NOT change:
- GanttChartView.tsx (unchanged)
- EPMProgramView.tsx (unchanged)

Test: Navigate to EPM program → Timeline tab → Verify:
✓ Task names fully visible or truncated with "..."
✓ Phase labels readable, centered, not overlapping
✓ Stage gate labels centered under markers
✓ Month headers properly aligned
✓ Task bars have comfortable spacing
```

---

## What Was Fixed

### Chart Dimensions (gantt-utils.ts)
- **Left margin**: 250px → 300px (more space for task names)
- **Top margin**: 80px → 120px (more space for phase labels)
- **Right margin**: 50px → 100px (cleaner right edge)
- **Task height**: 40px → 50px (better visibility)
- **Task spacing**: 16px → 20px (prevent overlap)

### Label Rendering (GanttChart.tsx)
- **Phase labels**: Now centered within phase width, no overlap
- **Task names**: Truncate to 35 chars if needed (add "...")
- **Gate labels**: Centered under gate marker circles
- **Month headers**: Better vertical alignment

---

## Expected Result

**Before:**
```
Phase 1Phase 2Phase 3      ← Overlapping
Intral control with dom...   ← Cut off
████ ████ ████              ← Too tight
```

**After:**
```
    Phase 1: Foundation        Phase 2: Build
    ─────────────────────     ─────────────────
         ①                         ②
    Gate 1: Review            Gate 2: Approve

M0   M1   M2   M3   M4   M5   M6   M7   M8   M9

Intral control with domain autonomy...  ← Proper truncation
██████████████  [85%]  John D.         ← Good spacing
```

---

## Verification Checklist

After integration:
- [ ] All text readable (no cut-off)
- [ ] Phase labels don't overlap
- [ ] Task names truncated properly with "..."
- [ ] Gate labels centered
- [ ] Comfortable spacing between tasks
- [ ] Dependencies still render
- [ ] Tooltips work
- [ ] Export functions

---

## File Details

**gantt-utils-FIXED.ts** (11KB)
- calculateChartDimensions() updated
- Increased margins and spacing
- No breaking changes

**GanttChart-FIXED.tsx** (19KB)
- renderPhases() updated (centered labels)
- renderTask() updated (text truncation)
- renderStageGates() updated (centered labels)
- renderMonthHeaders() updated (alignment)
- No breaking changes

---

## Testing

Use the Brooklyn coffee shop EPM program to verify:
1. Navigate to Timeline tab
2. Check all text is readable
3. Verify no overlapping labels
4. Test hover tooltips
5. Try export to image
6. Toggle controls work

---

**Estimated Time:** 2 minutes to copy files, 1 minute to test.
