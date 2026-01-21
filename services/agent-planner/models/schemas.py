from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any, Literal
from datetime import datetime
from enum import Enum


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase"""
    components = string.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])


class CamelModel(BaseModel):
    """Base model that accepts both snake_case and camelCase"""
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
    )


class BusinessContext(CamelModel):
    name: str
    type: str
    scale: Literal['smb', 'mid_market', 'enterprise']
    description: str
    industry: Optional[str] = None
    keywords: Optional[List[str]] = None


class ResourceLimits(CamelModel):
    max_headcount: Optional[int] = Field(None, alias="maxHeadcount")
    max_contractors: Optional[int] = Field(None, alias="maxContractors")


class Constraints(CamelModel):
    budget: Optional[float] = None
    deadline: Optional[datetime] = None
    regulations: Optional[List[str]] = None
    resource_limits: Optional[ResourceLimits] = Field(None, alias="resourceLimits")


class EPMGeneratorInput(CamelModel):
    business_context: BusinessContext = Field(..., alias="businessContext")
    bmc_insights: Any = Field(..., alias="bmcInsights")
    strategy_insights: Optional[Any] = Field(None, alias="strategyInsights")
    constraints: Optional[Constraints] = None
    user_id: str = Field(..., alias="userId")
    session_id: str = Field(..., alias="sessionId")
    journey_type: Optional[str] = Field(None, alias="journeyType")


class ResourceRequirement(CamelModel):
    role: str
    skills: List[str]
    allocation: float
    cost_per_month: Optional[float] = Field(None, alias="costPerMonth")


class Deliverable(CamelModel):
    id: str
    name: str
    description: str
    workstream_id: str = Field(..., alias="workstreamId")
    due_month: Optional[int] = Field(None, alias="dueMonth")
    status: Optional[Literal['not_started', 'in_progress', 'completed']] = 'not_started'


class Workstream(CamelModel):
    id: str
    name: str
    description: str
    owner: str
    deliverables: List[Deliverable]
    dependencies: List[str]
    resource_requirements: List[ResourceRequirement] = Field(..., alias="resourceRequirements")
    start_month: int = Field(..., alias="startMonth")
    end_month: int = Field(..., alias="endMonth")
    confidence: float


class Milestone(CamelModel):
    id: str
    name: str
    due_month: int = Field(..., alias="dueMonth")
    deliverable_ids: List[str] = Field(..., alias="deliverableIds")


class TimelinePhase(CamelModel):
    id: str
    name: str
    start_month: int = Field(..., alias="startMonth")
    end_month: int = Field(..., alias="endMonth")
    workstream_ids: List[str] = Field(..., alias="workstreamIds")
    milestones: List[Milestone]


class Risk(CamelModel):
    id: str
    description: str
    probability: Literal['low', 'medium', 'high']
    impact: Literal['low', 'medium', 'high']
    mitigation: str
    owner: Optional[str] = None
    category: Optional[str] = None


class FinancialItem(CamelModel):
    category: str
    description: str
    amount: float
    frequency: Literal['one_time', 'monthly', 'quarterly', 'annual']


class SupportingEvidence(CamelModel):
    agent_id: str = Field(..., alias="agentId")
    agent_name: str = Field(..., alias="agentName")
    round: int
    statement: str


class KnowledgeEmission(CamelModel):
    id: str
    content: str
    summary: str
    type: Literal['fact', 'estimate', 'constraint', 'lesson_learned', 'decision_rationale', 'pattern']
    scope: Literal['organization', 'industry', 'program_specific']
    suggested_memory_layer: Literal['semantic', 'episodic', 'symbolic'] = Field(..., alias="suggestedMemoryLayer")
    tags: List[str]
    confidence: float
    verification_status: Literal['verified', 'contested', 'hypothesis'] = Field(..., alias="verificationStatus")
    supporting_evidence: List[SupportingEvidence] = Field(..., alias="supportingEvidence")
    contradictions: Optional[List[SupportingEvidence]] = None
    source: dict


class KnowledgeStats(CamelModel):
    total_candidates: int = Field(..., alias="totalCandidates")
    verified: int
    deduplicated: int
    emitted: int
    contested: int
    rejected: int
    flagged_for_review: int = Field(..., alias="flaggedForReview")


class KnowledgeLedger(CamelModel):
    emissions: List[KnowledgeEmission]
    contested: List[Any]
    rejected: List[Any]
    stats: KnowledgeStats


class ConversationEntry(CamelModel):
    round: int
    agent_id: str = Field(..., alias="agentId")
    agent_name: str = Field(..., alias="agentName")
    message: str
    timestamp: str


class Decision(CamelModel):
    id: str
    round: int
    topic: str
    decision: str
    rationale: str
    made_by: str = Field(..., alias="madeBy")
    endorsed_by: List[str] = Field(..., alias="endorsedBy")


class Timeline(CamelModel):
    phases: List[TimelinePhase]
    total_months: int = Field(..., alias="totalMonths")
    critical_path: List[str] = Field(..., alias="criticalPath")


class ResourcePlan(CamelModel):
    roles: List[ResourceRequirement]
    total_headcount: int = Field(..., alias="totalHeadcount")
    total_cost: float = Field(..., alias="totalCost")


class RiskRegister(CamelModel):
    risks: List[Risk]
    overall_risk_level: Literal['low', 'medium', 'high'] = Field(..., alias="overallRiskLevel")


class FinancialPlan(CamelModel):
    capex: List[FinancialItem]
    opex: List[FinancialItem]
    total_budget: float = Field(..., alias="totalBudget")
    contingency: float


class EPMProgram(CamelModel):
    id: str
    title: str
    description: str
    workstreams: List[Workstream]
    timeline: Timeline
    resource_plan: ResourcePlan = Field(..., alias="resourcePlan")
    risk_register: RiskRegister = Field(..., alias="riskRegister")
    financial_plan: FinancialPlan = Field(..., alias="financialPlan")
    overall_confidence: float = Field(..., alias="overallConfidence")


class EPMGeneratorMetadata(CamelModel):
    generator: Literal['legacy', 'multi-agent']
    generated_at: str = Field(..., alias="generatedAt")
    confidence: float
    rounds_completed: Optional[int] = Field(None, alias="roundsCompleted")
    agents_participated: Optional[int] = Field(None, alias="agentsParticipated")
    knowledge_emissions: Optional[int] = Field(None, alias="knowledgeEmissions")
    generation_time_ms: Optional[int] = Field(None, alias="generationTimeMs")


class EPMGeneratorOutput(CamelModel):
    program: EPMProgram
    metadata: EPMGeneratorMetadata
    conversation_log: Optional[List[ConversationEntry]] = Field(None, alias="conversationLog")
    decisions: Optional[List[Decision]] = None
    knowledge_ledger: Optional[KnowledgeLedger] = Field(None, alias="knowledgeLedger")


class HealthResponse(BaseModel):
    status: str
    agents: int


class JobStartResponse(CamelModel):
    job_id: str = Field(..., alias="jobId")
    status: str


class JobStatusResponse(CamelModel):
    job_id: str = Field(..., alias="jobId")
    status: Literal['pending', 'running', 'completed', 'failed']
    progress: int
    current_round: Optional[int] = Field(None, alias="currentRound")
    total_rounds: int = Field(7, alias="totalRounds")
    message: Optional[str] = None
    error: Optional[str] = None


class JobResultResponse(CamelModel):
    job_id: str = Field(..., alias="jobId")
    status: Literal['completed', 'failed', 'pending', 'running']
    result: Optional[EPMGeneratorOutput] = None
    error: Optional[str] = None
