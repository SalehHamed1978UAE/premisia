# QData EPM System - Design Guidelines

## Design Approach: Modern Enterprise Dashboard System
**Selected Framework:** Linear-inspired data-focused design with Material Design principles for information density
**Justification:** Enterprise program management requires clarity, efficiency, and data visibility over visual flair. Linear's clean aesthetics combined with robust data visualization patterns.

## Core Design Elements

### A. Color Palette
**Dark Mode Primary (Default):**
- Background: 222 15% 6% (deep charcoal)
- Surface: 222 13% 10% (elevated panels)
- Surface Elevated: 222 13% 14% (cards, modals)
- Border: 217 10% 20% (subtle dividers)
- Text Primary: 210 20% 98%
- Text Secondary: 215 15% 70%

**Accent & Status Colors:**
- Primary: 217 91% 60% (corporate blue)
- Success: 142 76% 45% (KPI positive)
- Warning: 38 92% 50% (risks, alerts)
- Danger: 0 84% 60% (critical items)
- Info: 199 89% 48% (neutral highlights)

### B. Typography
**Font Stack:** Inter (via Google Fonts CDN)
- Display: 24px/32px, weight 600 (module headers)
- Heading: 18px/28px, weight 600 (section titles)
- Body: 14px/20px, weight 400 (content)
- Caption: 12px/16px, weight 500 (metadata, labels)
- Code/Data: 13px/18px, weight 500, monospace (metrics, IDs)

### C. Layout System
**Spacing Primitives:** Tailwind units of 1, 2, 4, 6, 8, 12, 16
- Component padding: p-4 to p-6
- Section spacing: space-y-6 to space-y-8
- Card gaps: gap-4
- Page margins: mx-6 to mx-8

**Grid Structure:**
- Sidebar: 280px fixed width
- Main content: flex-1 with max-w-7xl container
- Data tables: full-width with horizontal scroll
- Module cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3

### D. Component Library

**SessionContext Panel (New Feature):**
- Fixed right sidebar: w-80, right-0, top-16, h-[calc(100vh-4rem)]
- Collapsible with slide-in animation
- Sections: Current Goals (list), Success Criteria (checklist), Progress Indicator (radial chart)
- Sticky header with session timer and "End Session" button
- Semi-transparent backdrop-blur-md when overlaying content on mobile

**Navigation:**
- Top bar: h-16, border-b, with logo, module switcher, user menu
- Module tabs: horizontal scroll on mobile, fixed on desktop
- Breadcrumbs: text-sm with chevron separators

**Data Tables:**
- Sticky headers with sort indicators
- Row hover: bg-surface-elevated
- Alternating row subtle shading for readability
- Action buttons: ghost variant, revealed on row hover
- Pagination: bottom-aligned with items-per-page selector

**KPI Cards:**
- Metric value: text-3xl font-bold
- Trend indicator: small arrow with percentage (↑ 12%)
- Sparkline chart: 100px width, subtle line graph
- Status badge: top-right corner (On Track/At Risk/Critical)

**Stage Gate Timeline:**
- Horizontal stepper with connecting lines
- Completed: primary color fill
- Current: primary border with pulse animation
- Upcoming: muted gray
- Gate labels below with dates

**Risk Matrix:**
- 3x3 or 5x5 grid with color-coded cells
- Items positioned by probability/impact
- Tooltip on hover with full risk details

**Funding Dashboard:**
- Donut chart: allocated vs. available
- Line chart: burn rate over time
- Budget breakdown table with progress bars

**Resource Allocation:**
- Gantt-style timeline view
- Resource cards with utilization percentage (horizontal bar)
- Conflict indicators (overlapping assignments in red)

**Benefits Tracker:**
- Cards with realized vs. projected values
- Timeline with milestone markers
- Categorization tags (Financial/Operational/Strategic)

### E. Interactions & States
**Minimal Animations:**
- Page transitions: 150ms ease-in-out
- Dropdown/modal: slide-fade 200ms
- Data refresh: subtle skeleton loading states
- No decorative animations

**Focus States:**
- 2px ring-primary on keyboard navigation
- Clear visual hierarchy for accessibility

## Images
**No hero images required.** This is a data-focused enterprise application.

**Icon Usage:** Lucide React icons (already in Shadcn/ui)
- Module icons: 20px size in navigation
- Action icons: 16px in buttons/tables
- Status indicators: 12px filled circles

**Data Visualizations:** Use Recharts library
- Line/bar charts for trends
- Donut charts for distributions
- Radial progress for completion metrics

## Critical Layout Notes
- No viewport-height constraints on scrollable content areas
- SessionContext panel toggleable on screens < 1280px (overlays main content)
- All 7 modules accessible via persistent top navigation
- Role-based UI: show/hide admin features via conditional rendering, not separate layouts