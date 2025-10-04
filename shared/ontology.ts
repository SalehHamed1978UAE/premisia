export interface EntityDefinition {
  name: string;
  definition: string;
  purpose: string;
  requiredAttributes: AttributeDefinition[];
  optionalAttributes: AttributeDefinition[];
  businessRules: BusinessRule[];
  lifecycleStates: LifecycleState[];
  completenessChecks: string[];
}

export interface AttributeDefinition {
  name: string;
  type: string;
  description: string;
  constraints?: string[];
  examples?: string[];
}

export interface BusinessRule {
  rule: string;
  rationale: string;
  validation?: string;
}

export interface LifecycleState {
  state: string;
  description: string;
  allowedTransitions: string[];
  requiredConditions?: string[];
}

export const EPM_ONTOLOGY: Record<string, EntityDefinition> = {
  Program: {
    name: "Program",
    definition: "A strategic initiative consisting of coordinated projects and workstreams designed to achieve specific organizational objectives and deliver measurable benefits over a defined timeframe.",
    purpose: "Top-level container that defines scope, objectives, timeline, and success criteria for all subordinate work. Programs align with organizational strategy and have governance oversight through stage gates.",
    requiredAttributes: [
      {
        name: "name",
        type: "string",
        description: "Unique identifier name for the program",
        constraints: ["Must be unique", "2-200 characters"],
        examples: ["Digital Transformation Initiative", "Customer Experience Improvement Program"]
      },
      {
        name: "status",
        type: "enum",
        description: "Current execution state of the program",
        constraints: ["Must be one of the defined lifecycle states"],
        examples: ["Planning", "Active", "On Hold", "Completed", "Cancelled"]
      },
      {
        name: "startDate",
        type: "date",
        description: "Official program start date",
        constraints: ["Must be present", "Cannot be after endDate"],
        examples: ["2025-01-15"]
      },
      {
        name: "endDate",
        type: "date",
        description: "Planned program completion date",
        constraints: ["Must be present", "Must be after startDate"],
        examples: ["2026-12-31"]
      }
    ],
    optionalAttributes: [
      {
        name: "description",
        type: "text",
        description: "Detailed program objectives, scope, and strategic alignment",
        examples: ["Transform digital customer touchpoints to increase satisfaction by 40%"]
      },
      {
        name: "sponsor",
        type: "string",
        description: "Executive sponsor providing oversight and resources",
        examples: ["Chief Digital Officer", "VP of Operations"]
      },
      {
        name: "budget",
        type: "number",
        description: "Total approved program budget",
        constraints: ["Must be positive"],
        examples: ["5000000"]
      }
    ],
    businessRules: [
      {
        rule: "Every program must have at least one stage gate",
        rationale: "Stage gates provide governance checkpoints and ensure programs can be properly evaluated before progression",
        validation: "Count of associated stage gates >= 1"
      },
      {
        rule: "Program duration must be reasonable (typically 3-36 months)",
        rationale: "Programs shorter than 3 months are usually projects; longer than 36 months should be broken into phases",
        validation: "endDate - startDate between 90 days and 1095 days"
      },
      {
        rule: "Active programs should have at least one workstream or task",
        rationale: "Programs without work breakdown are not executable",
        validation: "If status = 'Active', count of workstreams + tasks > 0"
      }
    ],
    lifecycleStates: [
      {
        state: "Planning",
        description: "Program is being defined, not yet approved for execution",
        allowedTransitions: ["Active", "Cancelled"],
        requiredConditions: ["Has defined objectives", "Has start/end dates"]
      },
      {
        state: "Active",
        description: "Program is currently executing",
        allowedTransitions: ["On Hold", "Completed", "Cancelled"],
        requiredConditions: ["Has approved budget", "Has assigned resources", "Has stage gates defined"]
      },
      {
        state: "On Hold",
        description: "Program execution is temporarily paused",
        allowedTransitions: ["Active", "Cancelled"],
        requiredConditions: ["Has documented hold reason"]
      },
      {
        state: "Completed",
        description: "Program has achieved objectives and closed",
        allowedTransitions: [],
        requiredConditions: ["All stage gates approved", "Benefits realization documented"]
      },
      {
        state: "Cancelled",
        description: "Program terminated before completion",
        allowedTransitions: [],
        requiredConditions: ["Has documented cancellation reason"]
      }
    ],
    completenessChecks: [
      "Has name and description",
      "Has realistic timeline (start < end)",
      "Has defined stage gates (minimum G0-G4)",
      "Has identified benefits to track",
      "Has funding sources defined",
      "Has at least one workstream or task for execution"
    ]
  },

  Workstream: {
    name: "Workstream",
    definition: "A major component of a program representing a distinct area of work with its own objectives, deliverables, and team, contributing to overall program goals.",
    purpose: "Organizes program work into manageable, focused areas allowing parallel execution and specialized ownership while maintaining alignment with program objectives.",
    requiredAttributes: [
      {
        name: "name",
        type: "string",
        description: "Descriptive name for the workstream",
        constraints: ["2-200 characters"],
        examples: ["Technology Implementation", "Change Management", "Process Redesign"]
      },
      {
        name: "programId",
        type: "reference",
        description: "Parent program this workstream belongs to",
        constraints: ["Must reference valid program"],
        examples: ["uuid-123"]
      }
    ],
    optionalAttributes: [
      {
        name: "description",
        type: "text",
        description: "Detailed workstream scope and objectives",
        examples: ["Implement new CRM system and integrate with existing tools"]
      },
      {
        name: "lead",
        type: "string",
        description: "Workstream lead responsible for delivery",
        examples: ["Jane Smith - IT Director"]
      },
      {
        name: "startDate",
        type: "date",
        description: "Workstream start date",
        constraints: ["Should be within program timeline"],
        examples: ["2025-03-01"]
      },
      {
        name: "endDate",
        type: "date",
        description: "Workstream end date",
        constraints: ["Must be after startDate", "Should be within program timeline"],
        examples: ["2025-11-30"]
      }
    ],
    businessRules: [
      {
        rule: "Workstream timeline must fit within parent program timeline",
        rationale: "Workstreams cannot execute outside the program's active period",
        validation: "workstream.startDate >= program.startDate AND workstream.endDate <= program.endDate"
      },
      {
        rule: "Workstreams should have at least one task",
        rationale: "Workstreams without tasks are not executable",
        validation: "Count of associated tasks > 0"
      }
    ],
    lifecycleStates: [
      {
        state: "Not Started",
        description: "Workstream defined but execution has not begun",
        allowedTransitions: ["In Progress"],
        requiredConditions: ["Has assigned lead"]
      },
      {
        state: "In Progress",
        description: "Workstream is actively executing",
        allowedTransitions: ["On Hold", "Completed", "Cancelled"],
        requiredConditions: ["Has active tasks"]
      },
      {
        state: "On Hold",
        description: "Workstream execution temporarily paused",
        allowedTransitions: ["In Progress", "Cancelled"],
        requiredConditions: ["Has hold reason documented"]
      },
      {
        state: "Completed",
        description: "All workstream deliverables achieved",
        allowedTransitions: [],
        requiredConditions: ["All tasks completed"]
      },
      {
        state: "Cancelled",
        description: "Workstream terminated",
        allowedTransitions: [],
        requiredConditions: ["Has cancellation reason"]
      }
    ],
    completenessChecks: [
      "Has name and description",
      "Has assigned workstream lead",
      "Has defined timeline within program bounds",
      "Has decomposed tasks for execution",
      "Has allocated resources"
    ]
  },

  Task: {
    name: "Task",
    definition: "A discrete unit of work with defined start/end dates, deliverables, and accountable owner that contributes to workstream or program objectives.",
    purpose: "Lowest level of work breakdown, representing executable activities that can be scheduled, assigned, tracked, and completed. Tasks form the operational execution layer of the program.",
    requiredAttributes: [
      {
        name: "name",
        type: "string",
        description: "Clear, action-oriented task name",
        constraints: ["2-200 characters", "Should start with verb"],
        examples: ["Conduct stakeholder interviews", "Deploy production environment", "Train end users"]
      },
      {
        name: "programId",
        type: "reference",
        description: "Parent program this task belongs to",
        constraints: ["Must reference valid program"],
        examples: ["uuid-123"]
      },
      {
        name: "startDate",
        type: "date",
        description: "Task start date",
        constraints: ["Must be present"],
        examples: ["2025-04-15"]
      },
      {
        name: "endDate",
        type: "date",
        description: "Task end date",
        constraints: ["Must be after startDate"],
        examples: ["2025-05-30"]
      },
      {
        name: "status",
        type: "enum",
        description: "Current task execution status",
        constraints: ["Must be one of defined states"],
        examples: ["Not Started", "In Progress", "Completed", "Blocked"]
      }
    ],
    optionalAttributes: [
      {
        name: "workstreamId",
        type: "reference",
        description: "Parent workstream if task is part of one",
        examples: ["uuid-456"]
      },
      {
        name: "description",
        type: "text",
        description: "Detailed task scope, deliverables, and acceptance criteria",
        examples: ["Interview 15 key stakeholders to gather requirements for new process"]
      },
      {
        name: "assignee",
        type: "string",
        description: "Person responsible for completing the task",
        examples: ["John Doe", "user-uuid-789"]
      },
      {
        name: "effort",
        type: "number",
        description: "Estimated effort in hours or days",
        constraints: ["Must be positive"],
        examples: ["40", "120"]
      },
      {
        name: "dependencies",
        type: "array",
        description: "Tasks that must complete before this task can start",
        examples: ["['task-uuid-1', 'task-uuid-2']"]
      }
    ],
    businessRules: [
      {
        rule: "Task must have duration of at least 1 day",
        rationale: "Tasks shorter than 1 day should be combined or are too granular",
        validation: "endDate - startDate >= 1 day"
      },
      {
        rule: "Task cannot start before its predecessor tasks complete",
        rationale: "Dependencies must be respected in scheduling",
        validation: "task.startDate >= MAX(predecessor.endDate) for all predecessors"
      },
      {
        rule: "Tasks marked 'Completed' cannot have future end dates",
        rationale: "Completed tasks must have actually finished",
        validation: "IF status = 'Completed' THEN endDate <= current_date"
      },
      {
        rule: "Blocked tasks should have documented blockers",
        rationale: "Blockers need to be tracked and resolved",
        validation: "IF status = 'Blocked' THEN has associated risk or issue"
      }
    ],
    lifecycleStates: [
      {
        state: "Not Started",
        description: "Task is scheduled but work has not begun",
        allowedTransitions: ["In Progress", "Cancelled"],
        requiredConditions: ["Has start date", "Has assignee"]
      },
      {
        state: "In Progress",
        description: "Task is actively being worked on",
        allowedTransitions: ["Completed", "Blocked", "On Hold", "Cancelled"],
        requiredConditions: ["Current date >= start date"]
      },
      {
        state: "Blocked",
        description: "Task cannot proceed due to external dependency or issue",
        allowedTransitions: ["In Progress", "Cancelled"],
        requiredConditions: ["Has documented blocker", "Has resolution plan"]
      },
      {
        state: "On Hold",
        description: "Task work paused temporarily",
        allowedTransitions: ["In Progress", "Cancelled"],
        requiredConditions: ["Has hold reason"]
      },
      {
        state: "Completed",
        description: "Task deliverables achieved and verified",
        allowedTransitions: [],
        requiredConditions: ["Deliverables verified", "End date <= current date"]
      },
      {
        state: "Cancelled",
        description: "Task no longer required",
        allowedTransitions: [],
        requiredConditions: ["Has cancellation reason"]
      }
    ],
    completenessChecks: [
      "Has clear, action-oriented name",
      "Has realistic duration (1 day to 3 months)",
      "Has assigned owner/assignee",
      "Has defined deliverables or success criteria",
      "Dependencies are identified and scheduled accordingly",
      "Fits within program timeline"
    ]
  },

  KPI: {
    name: "KPI (Key Performance Indicator)",
    definition: "A quantifiable metric used to measure progress toward program objectives and evaluate success against targets over time.",
    purpose: "Provides objective, data-driven measurement of program performance, enabling evidence-based decision making and demonstrating value delivery to stakeholders.",
    requiredAttributes: [
      {
        name: "name",
        type: "string",
        description: "Clear, specific KPI name",
        constraints: ["2-200 characters"],
        examples: ["Customer Satisfaction Score", "System Uptime Percentage", "Cost Savings Realized"]
      },
      {
        name: "programId",
        type: "reference",
        description: "Parent program this KPI measures",
        constraints: ["Must reference valid program"],
        examples: ["uuid-123"]
      },
      {
        name: "targetValue",
        type: "string",
        description: "Target value to achieve",
        constraints: ["Must be measurable"],
        examples: ["95", "500000", "80%"]
      },
      {
        name: "unit",
        type: "string",
        description: "Unit of measurement",
        constraints: ["Should be standardized"],
        examples: ["percentage", "dollars", "count", "days", "score"]
      }
    ],
    optionalAttributes: [
      {
        name: "category",
        type: "string",
        description: "KPI category for grouping",
        examples: ["Financial", "Operational", "Customer", "Quality", "Performance"]
      },
      {
        name: "description",
        type: "text",
        description: "Detailed definition of what is being measured and why",
        examples: ["Measures customer satisfaction through quarterly surveys using NPS methodology"]
      },
      {
        name: "frequency",
        type: "enum",
        description: "How often KPI is measured",
        examples: ["Daily", "Weekly", "Monthly", "Quarterly", "Annually"]
      },
      {
        name: "baseline",
        type: "string",
        description: "Starting value before program intervention",
        examples: ["65", "250000"]
      },
      {
        name: "threshold",
        type: "string",
        description: "Minimum acceptable value (below target)",
        examples: ["85", "400000"]
      }
    ],
    businessRules: [
      {
        rule: "KPIs must be SMART: Specific, Measurable, Achievable, Relevant, Time-bound",
        rationale: "Vague KPIs cannot drive effective decision making",
        validation: "Has specific target, measurable unit, relevant to program objectives"
      },
      {
        rule: "Target value should be challenging but achievable",
        rationale: "Unrealistic targets demotivate teams; too-easy targets waste resources",
        validation: "Target is 10-30% improvement over baseline (guideline)"
      },
      {
        rule: "KPIs should have regular measurements",
        rationale: "KPIs without data cannot be monitored or acted upon",
        validation: "Has at least one measurement per measurement frequency period"
      }
    ],
    lifecycleStates: [
      {
        state: "Defined",
        description: "KPI is established but not yet being measured",
        allowedTransitions: ["Active"],
        requiredConditions: ["Has target", "Has measurement frequency"]
      },
      {
        state: "Active",
        description: "KPI is being actively measured and tracked",
        allowedTransitions: ["On Hold", "Achieved", "Retired"],
        requiredConditions: ["Has baseline", "Has regular measurements"]
      },
      {
        state: "On Hold",
        description: "KPI measurement temporarily paused",
        allowedTransitions: ["Active", "Retired"],
        requiredConditions: ["Has hold reason"]
      },
      {
        state: "Achieved",
        description: "Target value has been reached and sustained",
        allowedTransitions: ["Active"],
        requiredConditions: ["Latest measurement >= target"]
      },
      {
        state: "Retired",
        description: "KPI no longer relevant or measured",
        allowedTransitions: [],
        requiredConditions: ["Has retirement reason"]
      }
    ],
    completenessChecks: [
      "Has specific, measurable name",
      "Has numeric target value with units",
      "Has defined measurement frequency",
      "Has baseline for comparison",
      "Is linked to specific program benefit",
      "Has owner responsible for data collection",
      "Has regular measurements (according to frequency)"
    ]
  },

  Risk: {
    name: "Risk",
    definition: "An uncertain event or condition that, if it occurs, would have a positive or negative effect on program objectives, requiring active monitoring and mitigation.",
    purpose: "Identifies potential threats (or opportunities) to program success, enables proactive management, and provides transparency to stakeholders about program uncertainties.",
    requiredAttributes: [
      {
        name: "title",
        type: "string",
        description: "Concise risk statement",
        constraints: ["2-200 characters", "Should describe event, not impact"],
        examples: ["Key vendor may miss delivery deadline", "Regulatory changes could affect scope"]
      },
      {
        name: "programId",
        type: "reference",
        description: "Parent program this risk affects",
        constraints: ["Must reference valid program"],
        examples: ["uuid-123"]
      },
      {
        name: "likelihood",
        type: "enum",
        description: "Probability of risk occurring",
        constraints: ["Must be one of: Rare, Unlikely, Possible, Likely, Certain"],
        examples: ["Likely", "Possible"]
      },
      {
        name: "impact",
        type: "enum",
        description: "Severity of effect if risk occurs",
        constraints: ["Must be one of: Very Low, Low, Medium, High, Very High"],
        examples: ["High", "Medium"]
      },
      {
        name: "status",
        type: "enum",
        description: "Current risk management state",
        constraints: ["Must be one of defined states"],
        examples: ["Open", "Mitigating", "Mitigated", "Occurred", "Closed"]
      }
    ],
    optionalAttributes: [
      {
        name: "description",
        type: "text",
        description: "Detailed risk analysis including causes and potential impacts",
        examples: ["Vendor has history of delays; would push go-live by 6 weeks, affecting revenue realization"]
      },
      {
        name: "category",
        type: "string",
        description: "Risk category for grouping",
        examples: ["Technical", "Resource", "Schedule", "Budget", "External", "Organizational"]
      },
      {
        name: "owner",
        type: "string",
        description: "Person responsible for monitoring and managing the risk",
        examples: ["Sarah Johnson - Program Manager"]
      },
      {
        name: "identifiedDate",
        type: "date",
        description: "When risk was first identified",
        examples: ["2025-03-15"]
      }
    ],
    businessRules: [
      {
        rule: "Risk priority is calculated from likelihood × impact",
        rationale: "Standard risk assessment methodology (risk matrix)",
        validation: "priority = calculatePriority(likelihood, impact)"
      },
      {
        rule: "High and Critical risks must have mitigation actions",
        rationale: "Significant risks require active management",
        validation: "IF priority IN ['High', 'Critical'] THEN count(mitigations) > 0"
      },
      {
        rule: "Risks marked 'Mitigated' should show reduced likelihood or impact",
        rationale: "Mitigation should demonstrably reduce risk exposure",
        validation: "IF status = 'Mitigated' THEN current_likelihood < initial_likelihood OR current_impact < initial_impact"
      },
      {
        rule: "Risks that have occurred should be tracked as issues",
        rationale: "Realized risks become issues requiring different management",
        validation: "IF status = 'Occurred' THEN converted_to_issue = true"
      }
    ],
    lifecycleStates: [
      {
        state: "Open",
        description: "Risk identified and being monitored",
        allowedTransitions: ["Mitigating", "Occurred", "Closed"],
        requiredConditions: ["Has owner", "Has likelihood and impact assessed"]
      },
      {
        state: "Mitigating",
        description: "Active mitigation actions are being implemented",
        allowedTransitions: ["Mitigated", "Occurred", "Closed"],
        requiredConditions: ["Has defined mitigation actions", "Has target completion date"]
      },
      {
        state: "Mitigated",
        description: "Mitigation actions completed, risk exposure reduced",
        allowedTransitions: ["Closed", "Open"],
        requiredConditions: ["Mitigation actions completed", "Reduced likelihood or impact"]
      },
      {
        state: "Occurred",
        description: "Risk event has happened, now being managed as issue",
        allowedTransitions: ["Closed"],
        requiredConditions: ["Impact documented", "Response plan activated"]
      },
      {
        state: "Closed",
        description: "Risk no longer relevant or threat has passed",
        allowedTransitions: [],
        requiredConditions: ["Has closure reason", "Has final assessment"]
      }
    ],
    completenessChecks: [
      "Has clear, event-based risk statement",
      "Has assessed likelihood and impact (risk matrix position)",
      "Has assigned risk owner",
      "High/Critical risks have mitigation actions defined",
      "Has regular review schedule",
      "Mitigation actions have owners and due dates",
      "Linked to affected program areas (tasks, benefits, etc.)"
    ]
  },

  Benefit: {
    name: "Benefit",
    definition: "A measurable improvement or positive outcome that the program is designed to deliver, representing the business value and justification for the investment.",
    purpose: "Articulates the 'why' of the program, provides basis for investment decisions, and enables tracking of value realization against business case expectations.",
    requiredAttributes: [
      {
        name: "name",
        type: "string",
        description: "Clear benefit statement",
        constraints: ["2-200 characters"],
        examples: ["Reduced operational costs", "Improved customer satisfaction", "Increased market share"]
      },
      {
        name: "programId",
        type: "reference",
        description: "Parent program delivering this benefit",
        constraints: ["Must reference valid program"],
        examples: ["uuid-123"]
      },
      {
        name: "targetValue",
        type: "string",
        description: "Expected benefit value to be realized",
        constraints: ["Must be quantifiable"],
        examples: ["2000000", "35%", "500"]
      },
      {
        name: "category",
        type: "string",
        description: "Type of benefit for classification",
        constraints: ["Should be standardized"],
        examples: ["Financial", "Operational", "Strategic", "Customer", "Compliance"]
      }
    ],
    optionalAttributes: [
      {
        name: "description",
        type: "text",
        description: "Detailed benefit definition and how it will be achieved",
        examples: ["Automate manual processes to reduce FTE requirements by 15 positions, saving $2M annually"]
      },
      {
        name: "realizedValue",
        type: "string",
        description: "Actual benefit value achieved to date",
        examples: ["1500000", "28%", "420"]
      },
      {
        name: "status",
        type: "enum",
        description: "Benefit realization state",
        examples: ["Not Started", "In Progress", "At Risk", "Realized", "Retired"]
      },
      {
        name: "realizationDate",
        type: "date",
        description: "When benefit is expected to be fully realized",
        examples: ["2026-06-30"]
      },
      {
        name: "owner",
        type: "string",
        description: "Business owner accountable for realizing the benefit",
        examples: ["CFO", "VP Operations"]
      },
      {
        name: "measurementKPI",
        type: "reference",
        description: "KPI used to track benefit realization",
        examples: ["kpi-uuid-456"]
      }
    ],
    businessRules: [
      {
        rule: "Benefits must be quantifiable and measurable",
        rationale: "Intangible benefits cannot be tracked or verified",
        validation: "Has numeric target value with units"
      },
      {
        rule: "Total program benefits should exceed total program costs",
        rationale: "Programs should deliver positive ROI to justify investment",
        validation: "SUM(all_benefits.targetValue) > SUM(all_funding.amount) + SUM(all_expenses.amount)"
      },
      {
        rule: "Benefits should have associated KPIs for measurement",
        rationale: "Benefits need measurement mechanism to track realization",
        validation: "Has linked KPI or defined measurement method"
      },
      {
        rule: "Realized value should not exceed target value by >20%",
        rationale: "Significant over-delivery suggests poor initial estimation",
        validation: "realizedValue <= targetValue * 1.2"
      }
    ],
    lifecycleStates: [
      {
        state: "Not Started",
        description: "Benefit identified but realization has not begun",
        allowedTransitions: ["In Progress"],
        requiredConditions: ["Has target value", "Has measurement KPI"]
      },
      {
        state: "In Progress",
        description: "Benefit is being actively delivered",
        allowedTransitions: ["At Risk", "Realized", "Retired"],
        requiredConditions: ["Has owner", "Has tracking mechanism"]
      },
      {
        state: "At Risk",
        description: "Benefit realization is in jeopardy",
        allowedTransitions: ["In Progress", "Retired"],
        requiredConditions: ["Has documented risk", "Has recovery plan"]
      },
      {
        state: "Realized",
        description: "Target benefit value has been achieved",
        allowedTransitions: [],
        requiredConditions: ["realizedValue >= targetValue", "Verified by business owner"]
      },
      {
        state: "Retired",
        description: "Benefit no longer pursued",
        allowedTransitions: [],
        requiredConditions: ["Has retirement reason", "Impact documented"]
      }
    ],
    completenessChecks: [
      "Has clear, outcome-based benefit statement",
      "Has quantified target value with units",
      "Has assigned business owner (not program manager)",
      "Has linked KPI for measurement",
      "Has realistic realization timeline",
      "Financial benefits have calculation methodology documented",
      "Has baseline for comparison",
      "Realization dependencies identified (which tasks/deliverables enable this benefit)"
    ]
  },

  Funding: {
    name: "Funding Source",
    definition: "A financial resource or budget allocation that provides capital for program execution, including source type, amount, and availability timing.",
    purpose: "Ensures program has adequate financial resources, tracks budget sources and commitments, and enables financial planning and cost management.",
    requiredAttributes: [
      {
        name: "name",
        type: "string",
        description: "Descriptive name for the funding source",
        constraints: ["2-200 characters"],
        examples: ["FY2025 Capital Budget", "Operational Efficiency Fund", "Innovation Grant"]
      },
      {
        name: "programId",
        type: "reference",
        description: "Parent program this funding supports",
        constraints: ["Must reference valid program"],
        examples: ["uuid-123"]
      },
      {
        name: "type",
        type: "enum",
        description: "Category of funding source",
        constraints: ["Should be standardized"],
        examples: ["Budget", "Grant", "Investment", "Savings", "External"]
      },
      {
        name: "amount",
        type: "number",
        description: "Total funding amount available",
        constraints: ["Must be positive"],
        examples: ["5000000", "250000"]
      }
    ],
    optionalAttributes: [
      {
        name: "description",
        type: "text",
        description: "Details about funding source, conditions, or restrictions",
        examples: ["Annual capital budget allocation approved by board for digital transformation"]
      },
      {
        name: "currency",
        type: "string",
        description: "Currency denomination",
        examples: ["USD", "EUR", "GBP"]
      },
      {
        name: "availableDate",
        type: "date",
        description: "When funding becomes available for use",
        examples: ["2025-01-01"]
      },
      {
        name: "expirationDate",
        type: "date",
        description: "Date by which funding must be used or returned",
        examples: ["2025-12-31"]
      },
      {
        name: "approver",
        type: "string",
        description: "Authority who approved the funding",
        examples: ["Board of Directors", "CFO"]
      }
    ],
    businessRules: [
      {
        rule: "Total program funding must cover total program expenses",
        rationale: "Programs cannot execute without adequate funding",
        validation: "SUM(all_funding.amount) >= SUM(all_expenses.amount)"
      },
      {
        rule: "Funding availability dates should align with program timeline",
        rationale: "Funding needed when program is active",
        validation: "funding.availableDate <= program.startDate AND funding.expirationDate >= program.endDate"
      },
      {
        rule: "Time-limited funding should have utilization plans",
        rationale: "Expiring funds need active spending management",
        validation: "IF has expirationDate THEN has spending plan"
      }
    ],
    lifecycleStates: [
      {
        state: "Planned",
        description: "Funding identified but not yet approved",
        allowedTransitions: ["Approved", "Cancelled"],
        requiredConditions: ["Has amount", "Has type"]
      },
      {
        state: "Approved",
        description: "Funding committed and available for use",
        allowedTransitions: ["Active", "Frozen", "Cancelled"],
        requiredConditions: ["Has approver", "Has availability date"]
      },
      {
        state: "Active",
        description: "Funding is being utilized",
        allowedTransitions: ["Depleted", "Frozen"],
        requiredConditions: ["Current date >= available date"]
      },
      {
        state: "Frozen",
        description: "Funding temporarily unavailable",
        allowedTransitions: ["Active", "Cancelled"],
        requiredConditions: ["Has freeze reason"]
      },
      {
        state: "Depleted",
        description: "All funding has been spent",
        allowedTransitions: [],
        requiredConditions: ["Spent amount >= total amount"]
      },
      {
        state: "Cancelled",
        description: "Funding withdrawn or returned",
        allowedTransitions: [],
        requiredConditions: ["Has cancellation reason"]
      }
    ],
    completenessChecks: [
      "Has source name and type",
      "Has approved amount in specified currency",
      "Has documented approver/authority",
      "Has availability dates that align with program",
      "Restrictions or conditions are documented",
      "Tracking mechanism in place for utilization"
    ]
  },

  Resource: {
    name: "Resource",
    definition: "A person, team, equipment, facility, or material asset allocated to support program execution, tracked by availability, capacity, and utilization.",
    purpose: "Ensures program has necessary human and material resources, manages capacity and allocation conflicts, and enables resource optimization across programs.",
    requiredAttributes: [
      {
        name: "name",
        type: "string",
        description: "Resource identifier",
        constraints: ["2-200 characters"],
        examples: ["John Smith", "Development Team A", "Conference Room B", "Cloud Infrastructure"]
      },
      {
        name: "programId",
        type: "reference",
        description: "Parent program this resource is allocated to",
        constraints: ["Must reference valid program"],
        examples: ["uuid-123"]
      },
      {
        name: "type",
        type: "enum",
        description: "Category of resource",
        constraints: ["Should be standardized"],
        examples: ["Person", "Team", "Equipment", "Facility", "Software", "External Contractor"]
      }
    ],
    optionalAttributes: [
      {
        name: "role",
        type: "string",
        description: "Role or function of the resource in the program",
        examples: ["Business Analyst", "Developer", "Subject Matter Expert", "Testing Environment"]
      },
      {
        name: "allocation",
        type: "number",
        description: "Percentage of resource capacity allocated to this program",
        constraints: ["0-100"],
        examples: ["50", "100", "25"]
      },
      {
        name: "availableFrom",
        type: "date",
        description: "When resource becomes available",
        examples: ["2025-02-01"]
      },
      {
        name: "availableTo",
        type: "date",
        description: "When resource allocation ends",
        examples: ["2025-12-31"]
      },
      {
        name: "costRate",
        type: "number",
        description: "Cost per time unit (hour, day, month)",
        examples: ["150", "1200", "12000"]
      },
      {
        name: "costUnit",
        type: "string",
        description: "Time unit for cost rate",
        examples: ["hour", "day", "month"]
      },
      {
        name: "skills",
        type: "array",
        description: "Relevant skills or capabilities",
        examples: ["['Java', 'AWS', 'Agile']", "['Financial Analysis', 'Stakeholder Management']"]
      }
    ],
    businessRules: [
      {
        rule: "Resource allocations across all programs should not exceed 100%",
        rationale: "Resources cannot be over-allocated",
        validation: "SUM(resource.allocation across all programs) <= 100"
      },
      {
        rule: "Resource availability should overlap with program timeline",
        rationale: "Resources must be available when needed",
        validation: "resource.availableFrom <= program.endDate AND resource.availableTo >= program.startDate"
      },
      {
        rule: "Critical tasks should have resources with appropriate skills",
        rationale: "Resource capabilities must match task requirements",
        validation: "Task requirements subset of assigned resource skills"
      },
      {
        rule: "External resources should have defined contracts",
        rationale: "External resources need formal agreements",
        validation: "IF type = 'External Contractor' THEN has contract details"
      }
    ],
    lifecycleStates: [
      {
        state: "Planned",
        description: "Resource identified but not yet secured",
        allowedTransitions: ["Allocated", "Unavailable"],
        requiredConditions: ["Has type", "Has required skills defined"]
      },
      {
        state: "Allocated",
        description: "Resource committed to program",
        allowedTransitions: ["Active", "Released", "Unavailable"],
        requiredConditions: ["Has allocation percentage", "Has availability dates"]
      },
      {
        state: "Active",
        description: "Resource actively working on program",
        allowedTransitions: ["Released", "Unavailable"],
        requiredConditions: ["Current date within availability window"]
      },
      {
        state: "Unavailable",
        description: "Resource temporarily not available",
        allowedTransitions: ["Active", "Released"],
        requiredConditions: ["Has unavailability reason"]
      },
      {
        state: "Released",
        description: "Resource allocation ended",
        allowedTransitions: [],
        requiredConditions: ["Work completed or date passed"]
      }
    ],
    completenessChecks: [
      "Has name and type",
      "Has defined role/function in program",
      "Has allocation percentage specified",
      "Has availability dates aligned with program",
      "Skills/capabilities match task requirements",
      "For people: has contact information",
      "For equipment/facilities: has booking/scheduling mechanism",
      "Cost rate defined if tracking budget utilization"
    ]
  },

  StageGate: {
    name: "Stage Gate",
    definition: "A formal governance checkpoint at a key program milestone where stakeholders review progress, assess risks, and make go/no-go decisions about continuing to the next phase.",
    purpose: "Provides structured decision points, ensures program remains aligned with objectives, enables course correction, and gives stakeholders oversight and control.",
    requiredAttributes: [
      {
        name: "name",
        type: "string",
        description: "Stage gate name",
        constraints: ["2-200 characters"],
        examples: ["Ideation Gate", "Planning Gate", "Execution Gate", "Business Case Approval"]
      },
      {
        name: "programId",
        type: "reference",
        description: "Parent program this gate governs",
        constraints: ["Must reference valid program"],
        examples: ["uuid-123"]
      },
      {
        name: "code",
        type: "string",
        description: "Standard gate code for identification",
        constraints: ["Should follow convention"],
        examples: ["G0", "G1", "G2", "G3", "G4"]
      },
      {
        name: "status",
        type: "enum",
        description: "Current gate status",
        constraints: ["Must be one of defined states"],
        examples: ["Pending", "In Review", "Approved", "Conditional", "Rejected"]
      }
    ],
    optionalAttributes: [
      {
        name: "description",
        type: "text",
        description: "Gate purpose and review criteria",
        examples: ["Review completed design and approve transition to implementation phase"]
      },
      {
        name: "dueDate",
        type: "date",
        description: "Scheduled gate review date",
        examples: ["2025-06-30"]
      },
      {
        name: "reviewDate",
        type: "date",
        description: "Actual date gate review was conducted",
        examples: ["2025-06-28"]
      },
      {
        name: "reviewers",
        type: "array",
        description: "Stakeholders participating in gate review",
        examples: ["['Executive Sponsor', 'CFO', 'Program Board']"]
      },
      {
        name: "exitCriteria",
        type: "array",
        description: "Requirements that must be met to pass the gate",
        examples: ["['Business case approved', 'Budget secured', 'Team assembled', 'Risks assessed']"]
      },
      {
        name: "decision",
        type: "text",
        description: "Outcome and rationale from gate review",
        examples: ["Approved to proceed with noted risk mitigation actions required"]
      }
    ],
    businessRules: [
      {
        rule: "Programs must have standard stage gates (G0-G4 minimum)",
        rationale: "Standard gates ensure consistent governance",
        validation: "Program has gates: G0 (Ideation), G1 (Planning), G2 (Execution), G3 (Validation), G4 (Closure)"
      },
      {
        rule: "Stage gates must be sequential",
        rationale: "Programs progress through phases in order",
        validation: "Cannot approve G2 before G1 is approved"
      },
      {
        rule: "Gates with 'Conditional' approval need documented conditions",
        rationale: "Conditional approvals require tracking of conditions",
        validation: "IF status = 'Conditional' THEN has list of conditions to be met"
      },
      {
        rule: "Major program changes require gate re-review",
        rationale: "Significant changes may invalidate previous approvals",
        validation: "IF approved gate has material scope/budget/timeline changes THEN trigger re-review"
      }
    ],
    lifecycleStates: [
      {
        state: "Pending",
        description: "Gate scheduled but review not yet conducted",
        allowedTransitions: ["In Review", "Cancelled"],
        requiredConditions: ["Has scheduled due date", "Has defined exit criteria"]
      },
      {
        state: "In Review",
        description: "Gate review is actively underway",
        allowedTransitions: ["Approved", "Conditional", "Rejected", "Deferred"],
        requiredConditions: ["Review has started", "Reviewers have been notified"]
      },
      {
        state: "Approved",
        description: "Program approved to proceed to next phase",
        allowedTransitions: ["In Review"],
        requiredConditions: ["All exit criteria met", "Decision documented"]
      },
      {
        state: "Conditional",
        description: "Approval granted with specific conditions to be met",
        allowedTransitions: ["Approved", "Rejected"],
        requiredConditions: ["Conditions documented", "Compliance timeline set"]
      },
      {
        state: "Rejected",
        description: "Program not approved to proceed",
        allowedTransitions: ["In Review"],
        requiredConditions: ["Rejection rationale documented", "Next steps defined"]
      },
      {
        state: "Deferred",
        description: "Decision postponed pending additional information",
        allowedTransitions: ["In Review", "Cancelled"],
        requiredConditions: ["Deferral reason documented", "New review date set"]
      },
      {
        state: "Cancelled",
        description: "Gate review no longer needed",
        allowedTransitions: [],
        requiredConditions: ["Cancellation reason"]
      }
    ],
    completenessChecks: [
      "Has name and standard code (G0-G4)",
      "Has scheduled due date",
      "Has identified reviewers/decision makers",
      "Has clearly defined exit criteria",
      "Is sequenced appropriately in program timeline",
      "Has documented review process",
      "Decisions and rationale are recorded",
      "If conditional approval: conditions are tracked"
    ]
  }
};

export interface EntityRelationship {
  from: string;
  to: string;
  type: 'hierarchical' | 'dependency' | 'association' | 'cross-cutting' | 'temporal' | 'measurement';
  cardinality: '1:1' | '1:many' | 'many:1' | 'many:many';
  description: string;
  required: boolean;
  cascadeRules?: string[];
  bidirectional?: boolean;
}

export const EPM_RELATIONSHIP_GRAPH: EntityRelationship[] = [
  {
    from: 'Program',
    to: 'Workstream',
    type: 'hierarchical',
    cardinality: '1:many',
    description: 'Programs contain multiple workstreams that organize work into focused areas',
    required: false,
    cascadeRules: [
      'When program timeline changes, review workstream dates for alignment',
      'When program is cancelled, all workstreams should be cancelled',
      'When program status changes to On Hold, workstreams should reflect this'
    ]
  },
  {
    from: 'Program',
    to: 'Task',
    type: 'hierarchical',
    cardinality: '1:many',
    description: 'Programs contain tasks (either directly or through workstreams)',
    required: true,
    cascadeRules: [
      'Active programs must have at least one task',
      'Tasks must fit within program timeline boundaries',
      'When program is cancelled, all tasks should be cancelled',
      'Program completion requires all critical tasks to be completed'
    ]
  },
  {
    from: 'Workstream',
    to: 'Task',
    type: 'hierarchical',
    cardinality: '1:many',
    description: 'Workstreams decompose into executable tasks',
    required: true,
    cascadeRules: [
      'Workstream timeline must encompass all its tasks',
      'Workstream cannot be completed until all tasks are completed',
      'When workstream is on hold, associated tasks should be paused'
    ]
  },
  {
    from: 'Task',
    to: 'Task',
    type: 'dependency',
    cardinality: 'many:many',
    description: 'Tasks can have predecessor/successor dependencies (finish-to-start relationships)',
    required: false,
    cascadeRules: [
      'Successor task cannot start before predecessor completes',
      'When predecessor task is delayed, successor start date must be adjusted',
      'Circular dependencies must be detected and prevented',
      'Critical path calculations must respect dependencies'
    ]
  },
  {
    from: 'Program',
    to: 'KPI',
    type: 'association',
    cardinality: '1:many',
    description: 'Programs define KPIs to measure success',
    required: true,
    cascadeRules: [
      'Every program should have at least 3-5 KPIs',
      'KPIs should align with program objectives',
      'When program scope changes, KPIs should be reviewed for relevance'
    ]
  },
  {
    from: 'KPI',
    to: 'Measurement',
    type: 'measurement',
    cardinality: '1:many',
    description: 'KPIs are tracked through regular measurements over time',
    required: true,
    cascadeRules: [
      'KPIs should have measurements according to their defined frequency',
      'Missing measurements for active KPIs indicate tracking gaps',
      'Trend analysis requires minimum 3 measurements'
    ]
  },
  {
    from: 'Program',
    to: 'Risk',
    type: 'association',
    cardinality: '1:many',
    description: 'Programs identify and manage risks that could affect objectives',
    required: true,
    cascadeRules: [
      'New programs should conduct initial risk assessment',
      'High/Critical risks require mitigation actions',
      'When program scope expands, conduct risk reassessment'
    ]
  },
  {
    from: 'Risk',
    to: 'Mitigation',
    type: 'association',
    cardinality: '1:many',
    description: 'Risks have mitigation actions to reduce likelihood or impact',
    required: false,
    cascadeRules: [
      'High and Critical priority risks must have at least one mitigation action',
      'Mitigation completion should reduce risk priority',
      'Failed mitigations should trigger alternative actions'
    ]
  },
  {
    from: 'Program',
    to: 'Benefit',
    type: 'association',
    cardinality: '1:many',
    description: 'Programs deliver measurable benefits that justify the investment',
    required: true,
    cascadeRules: [
      'Every program must define expected benefits',
      'Total benefit value should exceed total cost (positive ROI)',
      'When program scope reduces, benefit targets should be adjusted'
    ]
  },
  {
    from: 'Benefit',
    to: 'KPI',
    type: 'measurement',
    cardinality: 'many:1',
    description: 'Benefits are measured through associated KPIs',
    required: true,
    cascadeRules: [
      'Each benefit should link to at least one KPI for tracking',
      'Benefit realization requires KPI target achievement',
      'KPI trends predict benefit delivery success'
    ]
  },
  {
    from: 'Program',
    to: 'Funding',
    type: 'association',
    cardinality: '1:many',
    description: 'Programs have funding sources that provide financial resources',
    required: true,
    cascadeRules: [
      'Total funding must be sufficient for planned expenses',
      'When funding is reduced, scope or timeline must be adjusted',
      'Funding availability dates must align with spend plan'
    ]
  },
  {
    from: 'Program',
    to: 'Expense',
    type: 'association',
    cardinality: '1:many',
    description: 'Programs track expenses against budget',
    required: false,
    cascadeRules: [
      'Total expenses cannot exceed total funding',
      'Expense trends predict budget variance',
      'When expenses exceed plan, trigger budget review'
    ]
  },
  {
    from: 'Program',
    to: 'Resource',
    type: 'cross-cutting',
    cardinality: '1:many',
    description: 'Programs allocate resources for execution',
    required: true,
    cascadeRules: [
      'Resources must be allocated before tasks can begin',
      'Resource availability must overlap with task timelines',
      'Total resource allocation across programs cannot exceed 100%'
    ]
  },
  {
    from: 'Resource',
    to: 'Task',
    type: 'cross-cutting',
    cardinality: 'many:many',
    description: 'Resources are assigned to specific tasks',
    required: false,
    cascadeRules: [
      'Task effort should match resource availability',
      'Resource conflicts trigger scheduling alerts',
      'Critical tasks should have assigned resources'
    ]
  },
  {
    from: 'Program',
    to: 'StageGate',
    type: 'temporal',
    cardinality: '1:many',
    description: 'Programs have stage gates that mark governance checkpoints',
    required: true,
    cascadeRules: [
      'All programs must have standard stage gates (G0-G4)',
      'Stage gates must be in sequence (cannot skip)',
      'Cannot proceed to next phase until current gate is approved',
      'Major scope/budget changes require gate re-review'
    ]
  },
  {
    from: 'StageGate',
    to: 'Task',
    type: 'temporal',
    cardinality: '1:many',
    description: 'Stage gates relate to tasks that must complete before gate review',
    required: false,
    cascadeRules: [
      'Exit criteria often reference completion of specific tasks',
      'When critical tasks are delayed, gate date should be adjusted',
      'Gate approval may depend on task completion status'
    ]
  },
  {
    from: 'Task',
    to: 'Risk',
    type: 'association',
    cardinality: 'many:many',
    description: 'Tasks may be affected by or generate risks',
    required: false,
    bidirectional: true,
    cascadeRules: [
      'High-risk tasks may need additional mitigation',
      'Task delays may increase risk likelihood',
      'Risk occurrence may block task execution'
    ]
  },
  {
    from: 'Benefit',
    to: 'Task',
    type: 'association',
    cardinality: 'many:many',
    description: 'Benefits are enabled by completion of specific tasks',
    required: false,
    cascadeRules: [
      'Benefit realization depends on enabling tasks being completed',
      'When enabling tasks are delayed, benefit timing is impacted',
      'Task completion should trigger benefit measurement'
    ]
  },
  {
    from: 'Workstream',
    to: 'Resource',
    type: 'cross-cutting',
    cardinality: 'many:many',
    description: 'Workstreams have assigned resources (workstream leads, team members)',
    required: true,
    cascadeRules: [
      'Every workstream should have a designated lead',
      'Workstream resource allocation should match task requirements',
      'Resource availability must cover workstream timeline'
    ]
  }
];

export interface RelationshipMetadata {
  entityPairs: Map<string, EntityRelationship[]>;
  dependencyGraph: Map<string, string[]>;
  cascadeImpactMap: Map<string, string[]>;
}

export function getRelationshipsForEntity(entityName: string): EntityRelationship[] {
  return EPM_RELATIONSHIP_GRAPH.filter(
    rel => rel.from === entityName || (rel.bidirectional && rel.to === entityName)
  );
}

export function getDependentEntities(entityName: string): string[] {
  return EPM_RELATIONSHIP_GRAPH
    .filter(rel => rel.from === entityName)
    .map(rel => rel.to);
}

export function getRequiredRelationships(entityName: string): EntityRelationship[] {
  return EPM_RELATIONSHIP_GRAPH.filter(
    rel => rel.from === entityName && rel.required
  );
}

export function getHierarchicalChildren(entityName: string): string[] {
  return EPM_RELATIONSHIP_GRAPH
    .filter(rel => rel.from === entityName && rel.type === 'hierarchical')
    .map(rel => rel.to);
}

export function getHierarchicalParent(entityName: string): string | null {
  const parentRel = EPM_RELATIONSHIP_GRAPH.find(
    rel => rel.to === entityName && rel.type === 'hierarchical'
  );
  return parentRel ? parentRel.from : null;
}

export function getCascadeRules(fromEntity: string, toEntity: string): string[] {
  const relationship = EPM_RELATIONSHIP_GRAPH.find(
    rel => rel.from === fromEntity && rel.to === toEntity
  );
  return relationship?.cascadeRules || [];
}

export interface ValidationRule {
  id: string;
  entity: string;
  category: 'date' | 'budget' | 'relationship' | 'state' | 'constraint' | 'permission' | 'dependency';
  severity: 'error' | 'warning' | 'info';
  rule: string;
  validation: string;
  errorMessage: string;
  autoFix?: string;
}

export const VALIDATION_RULES: ValidationRule[] = [
  {
    id: 'program-date-consistency',
    entity: 'Program',
    category: 'date',
    severity: 'error',
    rule: 'Start date must be before end date',
    validation: 'program.startDate < program.endDate',
    errorMessage: 'Program start date ({startDate}) must be before end date ({endDate})',
    autoFix: 'Suggest extending end date to startDate + 90 days minimum'
  },
  {
    id: 'program-duration-reasonable',
    entity: 'Program',
    category: 'date',
    severity: 'warning',
    rule: 'Program duration should be between 3 and 36 months',
    validation: 'daysBetween(program.startDate, program.endDate) >= 90 AND daysBetween(program.startDate, program.endDate) <= 1095',
    errorMessage: 'Program duration is {duration} days. Typical programs run 90-1095 days (3-36 months)',
    autoFix: 'Programs <90 days: consider if this should be a project. Programs >1095 days: consider breaking into phases'
  },
  {
    id: 'program-has-stage-gates',
    entity: 'Program',
    category: 'relationship',
    severity: 'error',
    rule: 'Every program must have stage gates defined',
    validation: 'COUNT(stageGates WHERE programId = program.id) >= 1',
    errorMessage: 'Program has no stage gates defined. Minimum required: G0-G4',
    autoFix: 'Auto-create default stage gates: G0 (Ideation), G1 (Planning), G2 (Execution), G3 (Validation), G4 (Closure)'
  },
  {
    id: 'program-active-needs-work',
    entity: 'Program',
    category: 'state',
    severity: 'warning',
    rule: 'Active programs should have work defined',
    validation: 'IF program.status = \'Active\' THEN (COUNT(tasks WHERE programId = program.id) > 0 OR COUNT(workstreams WHERE programId = program.id) > 0)',
    errorMessage: 'Active program has no tasks or workstreams. Program cannot execute without work breakdown',
    autoFix: 'Create initial workstream structure or add tasks'
  },
  {
    id: 'program-budget-coverage',
    entity: 'Program',
    category: 'budget',
    severity: 'error',
    rule: 'Total funding must cover total expenses',
    validation: 'SUM(funding.amount WHERE programId = program.id) >= SUM(expenses.amount WHERE programId = program.id)',
    errorMessage: 'Total funding ({fundingTotal}) is less than total expenses ({expenseTotal}). Shortfall: {shortfall}',
    autoFix: 'Add funding source for shortfall amount or reduce planned expenses'
  },
  {
    id: 'program-has-benefits',
    entity: 'Program',
    category: 'relationship',
    severity: 'warning',
    rule: 'Programs should define expected benefits',
    validation: 'COUNT(benefits WHERE programId = program.id) >= 1',
    errorMessage: 'Program has no defined benefits. Benefits justify the investment and measure success',
    autoFix: 'Define at least 3 measurable benefits aligned with program objectives'
  },
  {
    id: 'program-positive-roi',
    entity: 'Program',
    category: 'budget',
    severity: 'warning',
    rule: 'Total benefit value should exceed total cost (positive ROI)',
    validation: 'SUM(benefits.targetValue WHERE programId = program.id) > (SUM(funding.amount WHERE programId = program.id) + SUM(expenses.amount WHERE programId = program.id))',
    errorMessage: 'Expected benefits ({benefitTotal}) do not exceed total costs ({costTotal}). ROI is negative',
    autoFix: 'Review benefit calculations or reconsider program viability'
  },
  {
    id: 'workstream-within-program-timeline',
    entity: 'Workstream',
    category: 'date',
    severity: 'error',
    rule: 'Workstream dates must fit within parent program timeline',
    validation: 'workstream.startDate >= program.startDate AND workstream.endDate <= program.endDate',
    errorMessage: 'Workstream timeline ({workstreamStart} to {workstreamEnd}) extends beyond program timeline ({programStart} to {programEnd})',
    autoFix: 'Adjust workstream dates to fit within program bounds'
  },
  {
    id: 'workstream-has-tasks',
    entity: 'Workstream',
    category: 'relationship',
    severity: 'warning',
    rule: 'Workstreams should have at least one task',
    validation: 'COUNT(tasks WHERE workstreamId = workstream.id) >= 1',
    errorMessage: 'Workstream has no tasks defined. Workstreams without tasks cannot be executed',
    autoFix: 'Break down workstream into executable tasks'
  },
  {
    id: 'task-date-consistency',
    entity: 'Task',
    category: 'date',
    severity: 'error',
    rule: 'Task start date must be before end date',
    validation: 'task.startDate < task.endDate',
    errorMessage: 'Task start date ({startDate}) must be before end date ({endDate})',
    autoFix: 'Adjust end date to be after start date'
  },
  {
    id: 'task-minimum-duration',
    entity: 'Task',
    category: 'date',
    severity: 'warning',
    rule: 'Tasks should be at least 1 day long',
    validation: 'daysBetween(task.startDate, task.endDate) >= 1',
    errorMessage: 'Task duration is less than 1 day. Consider consolidating very short tasks',
    autoFix: 'Combine with other short tasks or extend to minimum 1 day'
  },
  {
    id: 'task-within-program-timeline',
    entity: 'Task',
    category: 'date',
    severity: 'error',
    rule: 'Tasks must fit within program timeline',
    validation: 'task.startDate >= program.startDate AND task.endDate <= program.endDate',
    errorMessage: 'Task timeline extends beyond program timeline',
    autoFix: 'Adjust task dates to fit within program bounds'
  },
  {
    id: 'task-dependency-valid',
    entity: 'Task',
    category: 'dependency',
    severity: 'error',
    rule: 'Task cannot start before predecessor tasks complete',
    validation: 'task.startDate >= MAX(predecessor.endDate) for all predecessors',
    errorMessage: 'Task starts on {taskStart} but predecessor ends on {predecessorEnd}. Dependency violation',
    autoFix: 'Adjust task start date to {predecessorEnd} or later'
  },
  {
    id: 'task-no-circular-dependencies',
    entity: 'Task',
    category: 'dependency',
    severity: 'error',
    rule: 'Task dependency graph must not have cycles',
    validation: 'NO_CYCLES in dependency graph',
    errorMessage: 'Circular dependency detected: {cycle}. Tasks cannot depend on themselves transitively',
    autoFix: 'Remove dependency creating cycle'
  },
  {
    id: 'task-completed-past-date',
    entity: 'Task',
    category: 'state',
    severity: 'error',
    rule: 'Completed tasks must have end date in the past or today',
    validation: 'IF task.status = \'Completed\' THEN task.endDate <= current_date',
    errorMessage: 'Task marked completed but end date is in the future',
    autoFix: 'Update end date to actual completion date'
  },
  {
    id: 'task-blocked-has-reason',
    entity: 'Task',
    category: 'state',
    severity: 'warning',
    rule: 'Blocked tasks should have documented blocker',
    validation: 'IF task.status = \'Blocked\' THEN EXISTS(risk WHERE task_id = task.id) OR task.blockerNote IS NOT NULL',
    errorMessage: 'Task is blocked but no blocker is documented',
    autoFix: 'Add risk or blocker note explaining what is blocking the task'
  },
  {
    id: 'kpi-has-target',
    entity: 'KPI',
    category: 'constraint',
    severity: 'error',
    rule: 'KPIs must have defined target values',
    validation: 'kpi.targetValue IS NOT NULL AND kpi.targetValue != \'\'',
    errorMessage: 'KPI has no target value defined. KPIs must be measurable',
    autoFix: 'Define specific numeric target value with units'
  },
  {
    id: 'kpi-has-measurements',
    entity: 'KPI',
    category: 'relationship',
    severity: 'warning',
    rule: 'Active KPIs should have regular measurements',
    validation: 'IF kpi.status = \'Active\' THEN COUNT(measurements WHERE kpiId = kpi.id) > 0',
    errorMessage: 'Active KPI has no measurements. KPIs need data to track progress',
    autoFix: 'Add measurement data or mark KPI as Defined instead of Active'
  },
  {
    id: 'kpi-target-achievable',
    entity: 'KPI',
    category: 'constraint',
    severity: 'warning',
    rule: 'KPI target should be 10-30% improvement over baseline',
    validation: 'IF kpi.baseline IS NOT NULL THEN ABS(kpi.targetValue - kpi.baseline) / kpi.baseline BETWEEN 0.1 AND 0.3',
    errorMessage: 'KPI target ({target}) differs from baseline ({baseline}) by {percentage}%. Typical targets are 10-30% improvement',
    autoFix: 'Review if target is realistic and achievable'
  },
  {
    id: 'kpi-linked-to-benefit',
    entity: 'KPI',
    category: 'relationship',
    severity: 'info',
    rule: 'KPIs should be linked to program benefits',
    validation: 'EXISTS(benefit WHERE benefit.measurementKPI = kpi.id)',
    errorMessage: 'KPI is not linked to any benefit. Consider linking to show how this measurement drives value',
    autoFix: 'Link KPI to related benefit'
  },
  {
    id: 'risk-likelihood-impact-defined',
    entity: 'Risk',
    category: 'constraint',
    severity: 'error',
    rule: 'Risks must have likelihood and impact assessed',
    validation: 'risk.likelihood IS NOT NULL AND risk.impact IS NOT NULL',
    errorMessage: 'Risk assessment incomplete. Both likelihood and impact must be defined',
    autoFix: 'Assess risk using 5x5 matrix (likelihood: Rare to Certain, impact: Very Low to Very High)'
  },
  {
    id: 'risk-high-needs-mitigation',
    entity: 'Risk',
    category: 'relationship',
    severity: 'warning',
    rule: 'High and Critical risks must have mitigation actions',
    validation: 'IF risk.priority IN [\'High\', \'Critical\'] THEN COUNT(mitigations WHERE riskId = risk.id) > 0',
    errorMessage: 'High/Critical risk has no mitigation actions. Significant risks require active management',
    autoFix: 'Define mitigation actions to reduce likelihood or impact'
  },
  {
    id: 'risk-has-owner',
    entity: 'Risk',
    category: 'constraint',
    severity: 'warning',
    rule: 'Risks should have assigned owners',
    validation: 'risk.owner IS NOT NULL AND risk.owner != \'\'',
    errorMessage: 'Risk has no owner assigned. Risks need accountability for monitoring and mitigation',
    autoFix: 'Assign risk owner (typically program manager or subject matter expert)'
  },
  {
    id: 'benefit-quantifiable',
    entity: 'Benefit',
    category: 'constraint',
    severity: 'error',
    rule: 'Benefits must have quantifiable target values',
    validation: 'benefit.targetValue IS NOT NULL AND benefit.targetValue != \'\'',
    errorMessage: 'Benefit has no target value. Benefits must be measurable to track realization',
    autoFix: 'Define numeric target value (e.g., cost savings in dollars, efficiency gain in percentage)'
  },
  {
    id: 'benefit-has-measurement-kpi',
    entity: 'Benefit',
    category: 'relationship',
    severity: 'warning',
    rule: 'Benefits should have linked KPIs for measurement',
    validation: 'benefit.measurementKPI IS NOT NULL OR EXISTS(kpi WHERE kpi linked to benefit)',
    errorMessage: 'Benefit has no measurement KPI. Need measurement mechanism to track realization',
    autoFix: 'Create or link KPI to measure this benefit'
  },
  {
    id: 'benefit-has-owner',
    entity: 'Benefit',
    category: 'constraint',
    severity: 'warning',
    rule: 'Benefits should have business owners',
    validation: 'benefit.owner IS NOT NULL AND benefit.owner != \'\'',
    errorMessage: 'Benefit has no owner. Benefits need business sponsor accountable for realization',
    autoFix: 'Assign business owner (typically not the program manager)'
  },
  {
    id: 'benefit-realized-reasonable',
    entity: 'Benefit',
    category: 'constraint',
    severity: 'warning',
    rule: 'Realized value should not exceed target by >20%',
    validation: 'IF benefit.realizedValue IS NOT NULL THEN benefit.realizedValue <= benefit.targetValue * 1.2',
    errorMessage: 'Realized value ({realized}) exceeds target ({target}) by {percentage}%. May indicate poor initial estimation',
    autoFix: 'Verify realized value calculations and consider adjusting future estimates'
  },
  {
    id: 'funding-positive-amount',
    entity: 'Funding',
    category: 'constraint',
    severity: 'error',
    rule: 'Funding amount must be positive',
    validation: 'funding.amount > 0',
    errorMessage: 'Funding amount must be greater than zero',
    autoFix: 'Enter positive funding amount'
  },
  {
    id: 'funding-dates-align',
    entity: 'Funding',
    category: 'date',
    severity: 'warning',
    rule: 'Funding availability should align with program timeline',
    validation: 'IF funding.availableDate IS NOT NULL THEN funding.availableDate <= program.startDate AND (funding.expirationDate IS NULL OR funding.expirationDate >= program.endDate)',
    errorMessage: 'Funding availability ({available} to {expiration}) does not align with program timeline ({programStart} to {programEnd})',
    autoFix: 'Adjust funding dates or program timeline'
  },
  {
    id: 'resource-allocation-valid',
    entity: 'Resource',
    category: 'constraint',
    severity: 'error',
    rule: 'Resource allocation must be between 0 and 100%',
    validation: 'resource.allocation >= 0 AND resource.allocation <= 100',
    errorMessage: 'Resource allocation must be 0-100%. Current: {allocation}%',
    autoFix: 'Set allocation to percentage (e.g., 50 for 50%)'
  },
  {
    id: 'resource-no-over-allocation',
    entity: 'Resource',
    category: 'constraint',
    severity: 'error',
    rule: 'Total resource allocation across programs cannot exceed 100%',
    validation: 'SUM(resource.allocation across all programs) <= 100',
    errorMessage: 'Resource {name} is over-allocated: {total}% across programs. Maximum is 100%',
    autoFix: 'Reduce allocation in one or more programs'
  },
  {
    id: 'resource-availability-overlaps-program',
    entity: 'Resource',
    category: 'date',
    severity: 'warning',
    rule: 'Resource availability should overlap with program timeline',
    validation: 'resource.availableFrom <= program.endDate AND (resource.availableTo IS NULL OR resource.availableTo >= program.startDate)',
    errorMessage: 'Resource availability ({availableFrom} to {availableTo}) does not overlap with program ({programStart} to {programEnd})',
    autoFix: 'Adjust resource availability or find alternative resource'
  },
  {
    id: 'stagegate-sequential',
    entity: 'StageGate',
    category: 'state',
    severity: 'error',
    rule: 'Stage gates must be approved in sequence',
    validation: 'Cannot approve gate Gx+1 before gate Gx is approved',
    errorMessage: 'Cannot approve {gateCode} before {previousGate} is approved. Gates must be sequential',
    autoFix: 'Approve previous gate first'
  },
  {
    id: 'stagegate-has-criteria',
    entity: 'StageGate',
    category: 'constraint',
    severity: 'warning',
    rule: 'Stage gates should have defined exit criteria',
    validation: 'IF stageGate.exitCriteria IS NULL OR LENGTH(stageGate.exitCriteria) = 0 THEN false',
    errorMessage: 'Stage gate {name} has no exit criteria defined. Criteria needed for objective review',
    autoFix: 'Define specific, measurable exit criteria for gate approval'
  },
  {
    id: 'stagegate-conditional-has-conditions',
    entity: 'StageGate',
    category: 'state',
    severity: 'error',
    rule: 'Conditional approvals must document conditions',
    validation: 'IF stageGate.status = \'Conditional\' THEN stageGate.decision IS NOT NULL AND stageGate.decision contains conditions',
    errorMessage: 'Gate has conditional approval but conditions are not documented',
    autoFix: 'Document specific conditions that must be met'
  }
];

export function getValidationRulesForEntity(entityName: string): ValidationRule[] {
  return VALIDATION_RULES.filter(rule => rule.entity === entityName);
}

export function getValidationRulesByCategory(category: ValidationRule['category']): ValidationRule[] {
  return VALIDATION_RULES.filter(rule => rule.category === category);
}

export function getValidationRulesBySeverity(severity: ValidationRule['severity']): ValidationRule[] {
  return VALIDATION_RULES.filter(rule => rule.severity === severity);
}

export function getErrorValidationRules(): ValidationRule[] {
  return VALIDATION_RULES.filter(rule => rule.severity === 'error');
}

export default EPM_ONTOLOGY;
