# GANTT RENDERING - ULTRA FIXES

## For Replit

The Gantt chart is still showing overlapping labels and cut-off text. Replace with these ULTRA-FIXED versions that have:
- 40% larger left margin (350px vs 250px)
- 88% larger top margin (150px vs 80px)  
- Multi-line adaptive labels for phases/gates
- Aggressive text truncation

---

## Instructions

```
GANTT CHART ULTRA FIXES:

Replace 2 files:

1. gantt-utils-ULTRA-FIXED.ts → client/src/lib/gantt-utils.ts
2. GanttChart-ULTRA-FIXED.tsx → client/src/components/epm/GanttChart.tsx

Test: EPM program → Timeline tab → Should see:
✓ All task names visible (no cut-off)
✓ Phase labels on 2 lines, readable
✓ Gate labels on 2 lines, no overlap
✓ Comfortable spacing everywhere
```

---

## What Changed

**Margins:**
- Left: 250px → 350px (more room for task names)
- Top: 80px → 150px (room for multi-line labels)

**Phase Labels:**
- Now split across 2 lines
- "Phase 1" on line 1
- "Planning..." on line 2
- Adaptive truncation based on width

**Gate Labels:**
- Now split across 2 lines  
- "Gate 2" on line 1
- "Developme.." on line 2 (max 12 chars)

**Task Names:**
- Max 45 characters (was 35)
- "Key activities for the centralized data..." instead of "Key activities for the centra..."

---

## Expected Result

Clean, spacious Gantt chart with no overlapping text anywhere.
