# Premisia: Marketing Consultant - Segment Discovery

## Overview

Add a new **Marketing Consultant** section to Premisia, separate from Strategic Consultant. The first (and for now, only) journey available is **Segment Discovery** - a systematic approach to finding target customer segments.

**Long-term vision:** Marketing Consultant outputs (segment definitions) will feed into Strategic Consultant's business planning work. For now, they're separate tools.

---

## Navigation Change

Add to the left nav (below Strategic Consultant):

```
📊 Marketing Consultant
```

Clicking it opens a page similar to Strategic Consultant's entry point.

---

## UI Flow (Mirror Strategic Consultant Pattern)

### Screen 1: Marketing Input

**Header:**
- **Marketing Consultant Agent**
- *Transform your offering into targeted market segments*

**Body:**
```
Marketing Input
Describe what you're building or selling. Include what problem it solves and who you think might need it.

[Text Input]
e.g., We built a tool that helps knowledge workers organize their documents 
and find information using AI. It refuses to hallucinate and shows sources. 
We're a 2-person team, no funding yet, trying to find our first 50 users...

Upload Document (Optional)
[Choose File] No file chosen
Supported: PDF, DOCX, Excel, Images (max 50MB)

[Start Segment Discovery]
```

### Screen 2: Checking for Ambiguities

Same pattern as Strategic Consultant:
```
Checking for ambiguities...
```

### Screen 3: Clarification Modal

**Header:** 
```
⚠ Just a Quick Clarification
Your input could be interpreted in a few ways. Help us understand exactly 
what you mean so we can find your best target segments.
```

**Questions (dynamically generated based on input, but typically include):**

**1. What type of offering is this?**
- [ ] Software product (SaaS, app, tool)
- [ ] Service or consulting
- [ ] Physical product
- [ ] Content, media, or education
- [ ] Marketplace or platform
- [ ] Other

**2. What's your current stage?**
- [ ] Idea stage (no product yet)
- [ ] Built but no users
- [ ] Early users (< 100)
- [ ] Growing (100-1000 users)
- [ ] Scaling (1000+ users)

**3. What's your go-to-market constraint?**
- [ ] Solo founder / nights & weekends
- [ ] Small team (2-5 people)
- [ ] Funded startup with runway
- [ ] Established company with resources

**4. What sales motion can you support?**
- [ ] Self-serve only (no sales calls)
- [ ] Light-touch sales (demos, short cycles)
- [ ] Enterprise sales (procurement, long cycles)
- [ ] Partner/channel sales

**5. Who do you think your customer is today?** (optional, free text)
```
[Text field]
We'll use this to challenge assumptions, not confirm them.
```

### Screen 4: Confirm Offering Classification

Same pattern as "Confirm Initiative Type":

**Header:**
- **Confirm Offering Type**
- *Review and confirm the AI classification*

**Body:**
```
AI Classification                                    [95% confidence]

Development of an AI-powered document organization and information 
retrieval tool for knowledge workers

Detected Offering Type:
B2B Software Product

Confirm or Correct Offering Type
[Dropdown: B2B Software Product ▼]
- B2B Software Product
- B2C Software Product
- Professional Services
- Physical Product
- Marketplace/Platform
- Content/Education
- Other

[Confirm and Continue →]
```

### Screen 5: Select Journey

**Header:**
- **Select Your Journey**
- *Choose the marketing analysis approach that fits your challenge*

**Body:**
```
Your Offering
[Shows the confirmed offering description]

┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│ Segment Discovery        ✓ Available│  │ Messaging Framework      ◷ Soon    │
│                                     │  │                                     │
│ Systematically explore and rank     │  │ Develop positioning, value props,   │
│ potential customer segments using   │  │ and messaging for your target       │
│ first-principles combinatorics.     │  │ segments.                           │
│                                     │  │                                     │
│ Methodology:                        │  │ Frameworks:                         │
│ [gene_library] [genome_scoring]     │  │ [positioning] [value_prop]          │
│                                     │  │                                     │
│ Duration: 5-10 minutes              │  │ Duration: 15-20 minutes             │
│                                     │  │                                     │
│ [Start Journey →]                   │  │ [Start Journey →] (disabled)        │
└─────────────────────────────────────┘  └─────────────────────────────────────┘
```

### Screen 6: Generating Analysis

```
Segment Discovery
Generating analysis...

○ Generating Segment Analysis

Step 1 of 5: Building gene library...

This may take a moment...
```

**Progress steps to show:**
1. Building gene library...
2. Generating segment combinations...
3. Scoring segments against constraints...
4. Stress testing top candidates...
5. Synthesizing recommendations...

---

## The Segment Discovery Methodology

This is the core logic that runs during generation.

### Step 1: Build Gene Library

Generate building blocks across 8 dimensions, customized to the user's offering:

| Dimension | Count | Description |
|-----------|-------|-------------|
| Roles | 50+ | Job titles, life roles, expertise levels, underserved groups |
| Information Problems | 30+ | Finding, recalling, connecting, verifying, synthesizing |
| Contexts | 20+ | Work, life transitions, crises, regulated environments |
| Data Types | 30+ | What information do they accumulate? |
| Current Workarounds | 20+ | How do they solve this today? Painful vs "good enough" |
| Triggers | 20+ | Events that create urgency (positive and negative) |
| Barriers | 15+ | What stops adoption even with need? |
| Value Signals | 15+ | How would they know it's working? |

**Important:** The gene library should be tailored to the offering type. A B2B SaaS tool gets different roles than a physical product.

### Step 2: Generate Genomes

Create 100 "user genomes" by combining genes:

```
GENOME #X
- Role: [from Roles]
- Problem: [from Information Problems]
- Context: [from Contexts]
- Data: [from Data Types]
- Workaround: [from Current Workarounds]
- Trigger: [from Triggers]
- Barrier: [from Barriers]
- Value Signal: [from Value Signals]
```

**Rules:**
- No more than 3 genomes can share the same Role (forces diversity)
- Every 10th genome is a [MUTANT] - implausible/contradictory combination
- Every 20th genome is a [HYBRID] - combines elements of two previous genomes
- Actively avoid combinations that "feel right" immediately

### Step 3: Fitness Scoring

Score each genome (1-5) against the user's specific constraints:

| Criterion | What it measures |
|-----------|------------------|
| Capability fit | Does our product solve their core problem? |
| Data readiness | Do they already have what they need to start? |
| Pain intensity | How much does this problem hurt them? |
| Willingness to experiment | Will they try an early-stage product? |
| Feedback quality | Can they articulate what's working/not? |
| Reachability | Can we find and access these users? |
| Expansion potential | Does success here lead somewhere bigger? |
| Competitive vacuum | Are they underserved by existing solutions? |

**Total score: X/40**

Flag each as:
- [HIGH POTENTIAL] - 32+
- [WORTH EXPLORING] - 24-31
- [DEPRIORITIZE] - Below 24

### Step 4: Stress Testing

For the top 10 genomes:
- Strongest argument AGAINST pursuing this segment
- What would have to be true for this to fail?
- What competitor or substitute are we underestimating?

Review bottom 20 for:
- Contrarian cases (everyone ignores them, but...)
- Timing plays (not ready now, but will be in 12 months)
- Trojan horses (small segment that unlocks larger ones)

### Step 5: Final Synthesis

Produce:
- **Primary Beachhead** (1 segment) - who, why, how to reach, the risk
- **Secondary Option** (1 segment) - the backup, what triggers a pivot
- **Not Now But Later** (3-5 segments) - attractive but need capabilities we don't have
- **Never List** (3-5 segments) - traps to avoid
- **2-Week Validation Plan** - how to test the hypothesis

---

## Output Display

### Results Screen

**Header:**
- **Segment Discovery Results**
- *Your systematically generated target segments*

**Body - Tab 1: Top Segments**

Show top 10 ranked segments as expandable cards:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ #1  Compliance Officer at Mid-Size Financial Firm          Score: 36/40    │
│     [HIGH POTENTIAL]                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Role: Compliance Officer                                                    │
│ Problem: Can't quickly verify if internal docs match current regulations    │
│ Context: Regulated industry with audit pressure                             │
│ Trigger: Failed audit or new regulation announcement                        │
│ Barrier: Security/compliance concerns about cloud tools                     │
│ Value Signal: Audit prep time drops from days to hours                      │
│                                                                             │
│ FITNESS SCORES                                                              │
│ Capability fit      ████░ 4    Pain intensity       █████ 5                │
│ Data readiness      ████░ 4    Experiment willing   ███░░ 3                │
│ Feedback quality    █████ 5    Reachability         ████░ 4                │
│ Expansion potential ████░ 4    Competitive vacuum   █████ 5                │
│                                                                             │
│ WHY THIS SEGMENT                                                            │
│ High pain (audit failures are career-ending), existing doc corpus ready     │
│ to upload, measurable ROI, and compliance tools are notoriously bad.        │
│                                                                             │
│ RISKS                                                                       │
│ Long sales cycles, security review requirements, may need SOC2.             │
│                                                                             │
│ HOW TO REACH                                                                │
│ LinkedIn (job title targeting), compliance conferences, RegTech forums.     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Body - Tab 2: Strategic Synthesis**

```
PRIMARY BEACHHEAD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Segment: Compliance Officers at mid-size financial services firms (50-500 employees)

Why first: 
- Existing document corpus (policies, procedures, regulations)
- Measurable pain point (audit prep time, compliance gaps)
- Budget authority for tools
- Underserved by current solutions

The "in": 
- LinkedIn outreach to "Compliance Officer" + "Chief Compliance Officer"
- Content on compliance forums about AI-assisted audit prep
- Partner with compliance consultants

The "wow" moment:
- User asks "Does our policy X comply with regulation Y?" 
- Tool answers with specific citations from their uploaded docs + flags gaps

The risk:
- Security/SOC2 requirements may slow adoption
- Long evaluation cycles


BACKUP OPTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Segment: Solo consultants managing multiple client knowledge bases

Why backup:
- Faster sales cycle, lower stakes
- Self-serve friendly
- But: lower willingness to pay, less expansion potential

Pivot trigger:
- If compliance officers require SOC2 and we can't get it in 6 months


NOT NOW BUT LATER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Enterprise legal teams - need on-prem/private cloud option
2. Healthcare compliance - need HIPAA, adds 6+ months
3. Academic researchers - need collaborative features


NEVER LIST (TRAPS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. "Everyone" - too broad, no positioning possible
2. Students - low willingness to pay, high support burden
3. Enterprise IT departments - 12+ month sales cycles, need you don't have


2-WEEK VALIDATION PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Week 1:
- Post in 3 compliance-focused LinkedIn groups about audit prep pain
- Send 20 cold outreach messages to Compliance Officers
- Book 5 discovery calls

Week 2:
- Run discovery calls, validate pain points
- Offer free pilot to 2-3 prospects
- Document objections and requirements

Success signal: 
- 3+ compliance officers say "I would pay for this"
- Clear use case emerges from conversations

Failure signal:
- <10% response rate to outreach
- Consistent objection we can't overcome (e.g., "need on-prem")
- Pain exists but not urgent enough to try new tool

Who to talk to first:
- [Specific LinkedIn search: Compliance Officer + Financial Services + 50-500 employees]
```

**Body - Tab 3: Full Gene Library** (collapsible)

Show the complete gene library generated for reference/export.

**Body - Tab 4: All 100 Genomes** (collapsible)

Show all genomes with scores for users who want to explore beyond top 10.

---

## Data Model

Store the results so they can be:
1. Referenced later by the user
2. Consumed by Strategic Consultant in future integration

```
SegmentDiscoveryResult {
  id: uuid
  user_id: uuid
  created_at: timestamp
  
  // Input
  offering_description: text
  offering_type: enum
  stage: enum
  gtm_constraint: enum
  sales_motion: enum
  existing_hypothesis: text (nullable)
  
  // Generated
  gene_library: jsonb {
    roles: [],
    problems: [],
    contexts: [],
    data_types: [],
    workarounds: [],
    triggers: [],
    barriers: [],
    value_signals: []
  }
  
  genomes: jsonb [] {
    id: number,
    role: string,
    problem: string,
    context: string,
    data_type: string,
    workaround: string,
    trigger: string,
    barrier: string,
    value_signal: string,
    scores: {
      capability_fit: 1-5,
      data_readiness: 1-5,
      pain_intensity: 1-5,
      experiment_willing: 1-5,
      feedback_quality: 1-5,
      reachability: 1-5,
      expansion_potential: 1-5,
      competitive_vacuum: 1-5
    },
    total_score: number,
    flag: enum [HIGH_POTENTIAL, WORTH_EXPLORING, DEPRIORITIZE],
    is_mutant: boolean,
    is_hybrid: boolean,
    stress_test: {
      argument_against: string,
      failure_condition: string,
      underestimated_competitor: string
    } (nullable, only for top 10)
  }
  
  synthesis: jsonb {
    primary_beachhead: {
      segment_id: number,
      why_first: string,
      the_in: string,
      the_wow: string,
      the_risk: string
    },
    secondary_option: {
      segment_id: number,
      why_backup: string,
      pivot_trigger: string
    },
    not_now_but_later: [{
      segment_id: number,
      blocker: string
    }],
    never_list: [{
      description: string,
      why_trap: string
    }],
    validation_plan: {
      week_1: string,
      week_2: string,
      success_signal: string,
      failure_signal: string,
      who_to_talk_to: string
    }
  }
}
```

---

## Export Options

On results screen, include:
- **Download PDF** - formatted report
- **Download JSON** - raw data for processing
- **Copy to Clipboard** - synthesis section as markdown

---

## Home Screen Integration

On Premisia home, add new stat cards:

```
[Analyses Complete: 25] [Strategies Complete: 25] [Programs Complete: 13] [Segments Discovered: X]
```

In Recent Activity, show segment discovery results:
```
Segment Discovery for AI Document Tool                    📊 Jan 15, 2026
Marketing Analysis
```

---

## Questions for Replit

1. **Estimated build time for MVP?**

2. **Should the multi-step LLM process (gene library → genomes → scoring → synthesis) run as a single background job, or break into multiple jobs with intermediate saves?**
   - Recommendation: Single job with progress updates streamed to UI

3. **Any concerns about generation time?** This is ~5 sequential LLM calls. May take 2-3 minutes.
   - Consider showing progress steps to keep user engaged

4. **Database:** Add new table `segment_discovery_results` or extend existing analysis tables?

---

## Future Integration with Strategic Consultant

Later, we'll add:
- "Import Segments" button in Strategic Consultant
- Pulls primary beachhead definition into business planning context
- Segment constraints inform market entry strategy, BMC customer segments, etc.

For now, keep them separate but design the data model to support this.

---

## Beta Limitation (for launch)

For the LinkedIn launch:
- Show "Beta" badge on Marketing Consultant
- Track usage count
- After 50 users, show waitlist signup instead of immediate access

Implementation: Simple counter in database, check before allowing new segment discovery runs.
