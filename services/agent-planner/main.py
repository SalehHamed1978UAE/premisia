"""
Agent Planner FastAPI Service

Multi-agent EPM generator using CrewAI for collaborative program planning.
"""

import os
import sys
import uuid
import traceback
import asyncio
from datetime import datetime

# Ensure Python stdout is unbuffered so logs appear immediately
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models.schemas import (
    EPMGeneratorInput,
    EPMGeneratorOutput,
    EPMProgram,
    EPMGeneratorMetadata,
    HealthResponse,
    JobStartResponse,
    JobStatusResponse,
    JobResultResponse,
    Workstream,
    Deliverable,
    ResourceRequirement,
    Timeline,
    TimelinePhase,
    Milestone,
    ResourcePlan,
    RiskRegister,
    Risk,
    FinancialPlan,
    FinancialItem,
    ConversationEntry,
    Decision,
    KnowledgeLedger,
    KnowledgeEmission,
    KnowledgeStats,
    SupportingEvidence,
)
from crews.program_crew import ProgramPlanningCrew
from crews.knowledge_curator import KnowledgeCurator

load_dotenv()

app = FastAPI(
    title="Agent Planner Service",
    description="Multi-agent EPM generator using CrewAI",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs_store: dict = {}
session_to_job: dict = {}  # Maps session_id -> job_id for idempotency


@app.on_event("startup")
async def validate_llm():
    """Test LLM connectivity on startup."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    model_id = os.environ.get("CREWAI_MODEL", "anthropic/claude-sonnet-4-20250514")
    
    if not api_key:
        print("[Startup] WARNING: ANTHROPIC_API_KEY not set - multi-agent generation will fail!")
        return
    
    masked_key = f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else "***"
    print(f"[Startup] API key: {masked_key}")
    print(f"[Startup] Model: {model_id}")
    
    try:
        from anthropic import Anthropic
        
        print(f"[Startup] Testing LLM connectivity with Anthropic SDK...")
        client = Anthropic(api_key=api_key)
        
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=10,
            messages=[{"role": "user", "content": "Say hello"}]
        )
        result = response.content[0].text if response.content else "OK"
        print(f"[Startup] LLM test successful: {result}")
    except Exception as e:
        print(f"[Startup] WARNING: LLM test failed: {e}")
        print("[Startup] Multi-agent generation may not work!")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(status="healthy", agents=7)


def _run_generation_job(job_id: str, input_data: EPMGeneratorInput):
    """Background worker function to run the generation job."""
    import sys
    try:
        jobs_store[job_id]["status"] = "running"
        jobs_store[job_id]["progress"] = 5
        jobs_store[job_id]["message"] = "Starting multi-agent generation..."
        
        start_time = datetime.now()
        print(f"[Job {job_id}] Starting program generation", flush=True)
        print(f"[Job {job_id}] Business context: {input_data.business_context.name}", flush=True)
        sys.stdout.flush()
        
        # Progress callback to update job status during round execution
        def on_round_progress(round_num: int, round_name: str, agent_name: str = None):
            """Called by ProgramPlanningCrew after each agent/round completes."""
            # Progress from 10% to 80% across 7 rounds (10% per round)
            base_progress = 10 + (round_num * 10)
            progress = min(base_progress, 80)
            
            jobs_store[job_id]["progress"] = progress
            jobs_store[job_id]["current_round"] = round_num
            
            if agent_name:
                jobs_store[job_id]["message"] = f"Round {round_num}: {agent_name} completed"
            else:
                jobs_store[job_id]["message"] = f"Starting round {round_num}: {round_name}"
            
            print(f"[Job {job_id}] Progress: {progress}% - Round {round_num}: {round_name}")
        
        print(f"[Job {job_id}] Creating ProgramPlanningCrew...", flush=True)
        sys.stdout.flush()
        
        crew = ProgramPlanningCrew()
        
        print(f"[Job {job_id}] ProgramPlanningCrew created successfully", flush=True)
        sys.stdout.flush()
        
        jobs_store[job_id]["progress"] = 10
        jobs_store[job_id]["message"] = "Agents initialized, starting round 1..."
        
        print(f"[Job {job_id}] Calling crew.generate_sync()...", flush=True)
        sys.stdout.flush()
        
        crew_result = crew.generate_sync(input_data, on_progress=on_round_progress)
        
        print(f"[Job {job_id}] crew.generate_sync() completed", flush=True)
        sys.stdout.flush()
        
        program: EPMProgram = crew_result["program"]
        conversation_log = crew_result["conversation_log"]
        decisions = crew_result["decisions"]
        rounds_completed = crew_result["rounds_completed"]
        agents_participated = crew_result["agents_participated"]
        
        jobs_store[job_id]["progress"] = 85
        jobs_store[job_id]["current_round"] = 7
        jobs_store[job_id]["message"] = "Curating knowledge from agent conversations..."
        
        print(f"[Job {job_id}] Program generation complete. Rounds: {rounds_completed}")
        
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        curator = KnowledgeCurator()
        knowledge_ledger = loop.run_until_complete(curator.curate(
            conversation_log=conversation_log,
            program=program,
            decisions=decisions
        ))
        loop.close()
        
        end_time = datetime.now()
        generation_time_ms = int((end_time - start_time).total_seconds() * 1000)
        
        metadata = EPMGeneratorMetadata(
            generator="multi-agent",
            generated_at=datetime.now().isoformat(),
            confidence=program.overall_confidence,
            rounds_completed=rounds_completed,
            agents_participated=agents_participated,
            knowledge_emissions=len(knowledge_ledger.emissions),
            generation_time_ms=generation_time_ms
        )
        
        output = EPMGeneratorOutput(
            program=program,
            metadata=metadata,
            conversation_log=conversation_log,
            decisions=decisions,
            knowledge_ledger=knowledge_ledger
        )
        
        jobs_store[job_id]["status"] = "completed"
        jobs_store[job_id]["progress"] = 100
        jobs_store[job_id]["message"] = "Generation complete!"
        jobs_store[job_id]["result"] = output
        
        print(f"[Job {job_id}] Completed successfully in {generation_time_ms}ms")
        
    except Exception as e:
        error_msg = f"Generation failed: {str(e)}"
        print(f"[Job {job_id}] ERROR: {error_msg}")
        print(f"[Job {job_id}] Traceback:\n{traceback.format_exc()}")
        
        jobs_store[job_id]["status"] = "failed"
        jobs_store[job_id]["error"] = error_msg
        jobs_store[job_id]["message"] = f"Failed: {str(e)[:100]}"


@app.post("/start-job", response_model=JobStartResponse)
async def start_job(input_data: EPMGeneratorInput):
    """
    Start an async EPM generation job.
    
    Returns a job ID immediately. Use /job-status/{job_id} to poll for progress
    and /job-result/{job_id} to get the result when complete.
    
    Idempotent: If a job is already running for this session, returns the existing job ID.
    """
    session_id = input_data.session_id
    
    # Check if a job is already running for this session (idempotency)
    if session_id and session_id in session_to_job:
        existing_job_id = session_to_job[session_id]
        existing_job = jobs_store.get(existing_job_id)
        
        if existing_job and existing_job["status"] in ["pending", "running"]:
            print(f"[Job] Returning existing job {existing_job_id} for session {session_id}")
            return JobStartResponse(jobId=existing_job_id)
        else:
            # Job completed or failed, allow new job
            del session_to_job[session_id]
    
    job_id = str(uuid.uuid4())
    
    # Track session -> job mapping for idempotency
    if session_id:
        session_to_job[session_id] = job_id
    
    jobs_store[job_id] = {
        "status": "pending",
        "progress": 0,
        "current_round": 0,
        "message": "Job queued...",
        "result": None,
        "error": None,
        "input_data": input_data,
        "created_at": datetime.now().isoformat()
    }
    
    print(f"[CrewAI] Starting async job {job_id} for session {input_data.session_id}")
    
    import threading
    thread = threading.Thread(target=_run_generation_job, args=(job_id, input_data))
    thread.daemon = True
    thread.start()
    
    return JobStartResponse(job_id=job_id, status="pending")


@app.get("/job-status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Get the current status and progress of a generation job."""
    if job_id not in jobs_store:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    job = jobs_store[job_id]
    return JobStatusResponse(
        job_id=job_id,
        status=job["status"],
        progress=job["progress"],
        current_round=job.get("current_round"),
        total_rounds=7,
        message=job.get("message"),
        error=job.get("error")
    )


@app.get("/job-result/{job_id}")
async def get_job_result(job_id: str) -> JSONResponse:
    """Get the result of a completed generation job."""
    if job_id not in jobs_store:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    job = jobs_store[job_id]
    
    if job["status"] == "pending" or job["status"] == "running":
        return JSONResponse(
            status_code=202,
            content={"jobId": job_id, "status": job["status"], "message": "Job still in progress"}
        )
    
    if job["status"] == "failed":
        raise HTTPException(status_code=500, detail=job.get("error", "Job failed"))
    
    result: EPMGeneratorOutput = job["result"]
    return JSONResponse(content=result.model_dump(by_alias=True))


@app.post("/generate-program")
async def generate_program(input_data: EPMGeneratorInput) -> JSONResponse:
    """
    Generate an EPM program using multi-agent collaboration.
    
    This endpoint accepts business context, BMC insights, and constraints,
    then returns a complete EPM program with workstreams, timeline,
    resources, risks, and financials.
    
    Returns JSON with camelCase keys for TypeScript compatibility.
    """
    try:
        start_time = datetime.now()
        print(f"[CrewAI] Starting program generation for session {input_data.session_id}")
        
        crew = ProgramPlanningCrew()
        
        # Run synchronous crew.generate() in a thread pool to avoid blocking async context
        loop = asyncio.get_event_loop()
        crew_result = await loop.run_in_executor(None, crew.generate_sync, input_data)
        
        program: EPMProgram = crew_result["program"]
        conversation_log = crew_result["conversation_log"]
        decisions = crew_result["decisions"]
        rounds_completed = crew_result["rounds_completed"]
        agents_participated = crew_result["agents_participated"]
        
        print(f"[CrewAI] Program generation complete. Rounds: {rounds_completed}, Agents: {agents_participated}")
        
        curator = KnowledgeCurator()
        knowledge_ledger = await curator.curate(
            conversation_log=conversation_log,
            program=program,
            decisions=decisions
        )
        
        end_time = datetime.now()
        generation_time_ms = int((end_time - start_time).total_seconds() * 1000)
        
        metadata = EPMGeneratorMetadata(
            generator="multi-agent",
            generated_at=datetime.now().isoformat(),
            confidence=program.overall_confidence,
            rounds_completed=rounds_completed,
            agents_participated=agents_participated,
            knowledge_emissions=len(knowledge_ledger.emissions),
            generation_time_ms=generation_time_ms
        )
        
        output = EPMGeneratorOutput(
            program=program,
            metadata=metadata,
            conversation_log=conversation_log,
            decisions=decisions,
            knowledge_ledger=knowledge_ledger
        )
        return JSONResponse(content=output.model_dump(by_alias=True))
        
    except ValueError as e:
        print(f"[CrewAI ERROR] ValueError: {str(e)}")
        print(f"[CrewAI ERROR] Traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        error_msg = f"Program generation failed: {str(e)}"
        print(f"[CrewAI ERROR] {error_msg}")
        print(f"[CrewAI ERROR] Full traceback:\n{traceback.format_exc()}")
        
        # Return 500 error with details instead of fallback - let TypeScript handle fallback
        raise HTTPException(
            status_code=500, 
            detail=f"{error_msg}. Check CrewAI service logs for details."
        )


async def _generate_fallback_program(
    input_data: EPMGeneratorInput, 
    error_message: str
) -> EPMGeneratorOutput:
    """
    Generate a fallback program when CrewAI fails.
    
    This provides a basic program structure so the endpoint doesn't fail completely.
    """
    start_time = datetime.now()
    
    program_id = str(uuid.uuid4())
    business_name = input_data.business_context.name
    
    workstream1_id = str(uuid.uuid4())
    workstream2_id = str(uuid.uuid4())
    workstream3_id = str(uuid.uuid4())
    
    deliverable1_id = str(uuid.uuid4())
    deliverable2_id = str(uuid.uuid4())
    deliverable3_id = str(uuid.uuid4())
    deliverable4_id = str(uuid.uuid4())
    
    workstreams = [
        Workstream(
            id=workstream1_id,
            name="Strategy & Planning",
            description="Define strategic objectives and create implementation roadmap",
            owner="Strategy Lead",
            deliverables=[
                Deliverable(
                    id=deliverable1_id,
                    name="Strategic Assessment",
                    description="Comprehensive analysis of current state and opportunities",
                    workstream_id=workstream1_id,
                    due_month=1,
                    status="not_started"
                ),
                Deliverable(
                    id=deliverable2_id,
                    name="Implementation Roadmap",
                    description="Detailed plan with milestones and dependencies",
                    workstream_id=workstream1_id,
                    due_month=2,
                    status="not_started"
                )
            ],
            dependencies=[],
            resource_requirements=[
                ResourceRequirement(
                    role="Strategy Consultant",
                    skills=["Strategic Planning", "Business Analysis"],
                    allocation=1.0,
                    cost_per_month=15000
                )
            ],
            start_month=1,
            end_month=3,
            confidence=0.85
        ),
        Workstream(
            id=workstream2_id,
            name="Capability Development",
            description="Build required capabilities and skills",
            owner="Capability Lead",
            deliverables=[
                Deliverable(
                    id=deliverable3_id,
                    name="Capability Assessment",
                    description="Gap analysis of current vs required capabilities",
                    workstream_id=workstream2_id,
                    due_month=2,
                    status="not_started"
                )
            ],
            dependencies=[workstream1_id],
            resource_requirements=[
                ResourceRequirement(
                    role="Capability Manager",
                    skills=["Training", "Change Management"],
                    allocation=0.8,
                    cost_per_month=12000
                )
            ],
            start_month=2,
            end_month=5,
            confidence=0.80
        ),
        Workstream(
            id=workstream3_id,
            name="Execution & Delivery",
            description="Execute strategic initiatives and deliver outcomes",
            owner="Delivery Lead",
            deliverables=[
                Deliverable(
                    id=deliverable4_id,
                    name="Pilot Implementation",
                    description="Initial rollout to validate approach",
                    workstream_id=workstream3_id,
                    due_month=4,
                    status="not_started"
                )
            ],
            dependencies=[workstream1_id, workstream2_id],
            resource_requirements=[
                ResourceRequirement(
                    role="Project Manager",
                    skills=["Project Management", "Stakeholder Management"],
                    allocation=1.0,
                    cost_per_month=13000
                ),
                ResourceRequirement(
                    role="Business Analyst",
                    skills=["Requirements Analysis", "Process Improvement"],
                    allocation=0.5,
                    cost_per_month=10000
                )
            ],
            start_month=3,
            end_month=6,
            confidence=0.75
        )
    ]
    
    timeline = Timeline(
        phases=[
            TimelinePhase(
                id=str(uuid.uuid4()),
                name="Phase 1: Foundation",
                start_month=1,
                end_month=2,
                workstream_ids=[workstream1_id],
                milestones=[
                    Milestone(
                        id=str(uuid.uuid4()),
                        name="Strategy Approved",
                        due_month=2,
                        deliverable_ids=[deliverable1_id, deliverable2_id]
                    )
                ]
            ),
            TimelinePhase(
                id=str(uuid.uuid4()),
                name="Phase 2: Development",
                start_month=2,
                end_month=4,
                workstream_ids=[workstream2_id],
                milestones=[
                    Milestone(
                        id=str(uuid.uuid4()),
                        name="Capabilities Ready",
                        due_month=4,
                        deliverable_ids=[deliverable3_id]
                    )
                ]
            ),
            TimelinePhase(
                id=str(uuid.uuid4()),
                name="Phase 3: Execution",
                start_month=3,
                end_month=6,
                workstream_ids=[workstream3_id],
                milestones=[
                    Milestone(
                        id=str(uuid.uuid4()),
                        name="Pilot Complete",
                        due_month=5,
                        deliverable_ids=[deliverable4_id]
                    )
                ]
            )
        ],
        total_months=6,
        critical_path=[workstream1_id, workstream2_id, workstream3_id]
    )
    
    resource_plan = ResourcePlan(
        roles=[
            ResourceRequirement(role="Strategy Consultant", skills=["Strategic Planning", "Business Analysis"], allocation=1.0, cost_per_month=15000),
            ResourceRequirement(role="Capability Manager", skills=["Training", "Change Management"], allocation=0.8, cost_per_month=12000),
            ResourceRequirement(role="Project Manager", skills=["Project Management", "Stakeholder Management"], allocation=1.0, cost_per_month=13000),
            ResourceRequirement(role="Business Analyst", skills=["Requirements Analysis", "Process Improvement"], allocation=0.5, cost_per_month=10000),
        ],
        total_headcount=4,
        total_cost=300000
    )
    
    risk_register = RiskRegister(
        risks=[
            Risk(
                id=str(uuid.uuid4()),
                description="Resource availability constraints may delay timeline",
                probability="medium",
                impact="high",
                mitigation="Identify backup resources and establish cross-training program",
                owner="Resource Manager",
                category="Resource"
            ),
            Risk(
                id=str(uuid.uuid4()),
                description="Stakeholder alignment challenges",
                probability="medium",
                impact="medium",
                mitigation="Regular stakeholder communication and engagement sessions",
                owner="Program Manager",
                category="Stakeholder"
            ),
            Risk(
                id=str(uuid.uuid4()),
                description="Technology integration complexity",
                probability="low",
                impact="high",
                mitigation="Conduct thorough technical assessment and proof of concept",
                owner="Technical Lead",
                category="Technical"
            )
        ],
        overall_risk_level="medium"
    )
    
    financial_plan = FinancialPlan(
        capex=[
            FinancialItem(category="Technology", description="Software licenses and tools", amount=50000, frequency="one_time"),
            FinancialItem(category="Infrastructure", description="Cloud infrastructure setup", amount=25000, frequency="one_time")
        ],
        opex=[
            FinancialItem(category="Personnel", description="Team salaries", amount=50000, frequency="monthly"),
            FinancialItem(category="Operations", description="Ongoing operational costs", amount=10000, frequency="monthly")
        ],
        total_budget=435000,
        contingency=43500
    )
    
    program = EPMProgram(
        id=program_id,
        title=f"{business_name} Strategic Transformation Program",
        description=f"A comprehensive program to execute strategic initiatives for {business_name}, aligned with BMC insights and business objectives.",
        workstreams=workstreams,
        timeline=timeline,
        resource_plan=resource_plan,
        risk_register=risk_register,
        financial_plan=financial_plan,
        overall_confidence=0.80
    )
    
    conversation_log = [
        ConversationEntry(
            round=1,
            agent_id="system",
            agent_name="System",
            message=f"Fallback program generated due to error: {error_message[:500]}",
            timestamp=datetime.now().isoformat()
        ),
        ConversationEntry(
            round=1,
            agent_id="program_coordinator",
            agent_name="Program Coordinator",
            message=f"Created strategic transformation program for {business_name}.",
            timestamp=datetime.now().isoformat()
        )
    ]
    
    decisions = [
        Decision(
            id=str(uuid.uuid4()),
            round=1,
            topic="Program Structure",
            decision="Three-workstream approach with sequential dependencies",
            rationale="Provides clear ownership and manageable complexity while ensuring logical flow",
            made_by="Program Coordinator",
            endorsed_by=[]
        )
    ]
    
    knowledge_ledger = KnowledgeLedger(
        emissions=[
            KnowledgeEmission(
                id=str(uuid.uuid4()),
                content=f"Strategic transformation programs for {input_data.business_context.scale} scale organizations typically require 4-8 month timelines for sustainable implementation.",
                summary="Program duration benchmarks",
                type="pattern",
                scope="industry",
                suggested_memory_layer="semantic",
                tags=["program-management", "timeline", "benchmarks"],
                confidence=0.85,
                verification_status="verified",
                supporting_evidence=[
                    SupportingEvidence(
                        agent_id="program_coordinator",
                        agent_name="Program Coordinator",
                        round=1,
                        statement="Analysis of similar programs shows 6-month duration is optimal"
                    )
                ],
                source={
                    "program_id": program_id,
                    "program_name": program.title,
                    "generated_at": datetime.now().isoformat(),
                    "curator_version": "1.0.0"
                }
            )
        ],
        contested=[],
        rejected=[],
        stats=KnowledgeStats(
            total_candidates=1,
            verified=1,
            deduplicated=0,
            emitted=1,
            contested=0,
            rejected=0,
            flagged_for_review=0
        )
    )
    
    end_time = datetime.now()
    generation_time_ms = int((end_time - start_time).total_seconds() * 1000)
    
    metadata = EPMGeneratorMetadata(
        generator="multi-agent",
        generated_at=datetime.now().isoformat(),
        confidence=0.80,
        rounds_completed=1,
        agents_participated=1,
        knowledge_emissions=1,
        generation_time_ms=generation_time_ms
    )
    
    return EPMGeneratorOutput(
        program=program,
        metadata=metadata,
        conversation_log=conversation_log,
        decisions=decisions,
        knowledge_ledger=knowledge_ledger
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
