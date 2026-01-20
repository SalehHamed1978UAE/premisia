"""
Program Planning Crew - Multi-Agent EPM Generator using CrewAI

This module implements a CrewAI-based program planning system with 7 specialized agents
that collaborate across 7 planning rounds to generate comprehensive EPM programs.
"""

import os
import uuid
import json
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List, Optional

import yaml
from crewai import Agent, Task, Crew, Process
from crewai.llm import LLM

from models.schemas import (
    EPMGeneratorInput,
    EPMProgram,
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
)


class ProgramPlanningCrew:
    """
    Orchestrates multiple AI agents to collaboratively generate EPM programs.
    
    Agents (7 total, excluding Knowledge Curator which runs post-generation):
    1. Program Coordinator - Synthesizes inputs, tracks decisions, resolves conflicts
    2. Tech Architecture Lead - Defines technology stack and feasibility
    3. Platform Delivery Manager - Defines delivery approach and quality gates
    4. Go-to-Market Strategist - Defines marketing and sales enablement
    5. Customer Success Lead - Defines onboarding and retention strategies
    6. Risk & Compliance Officer - Identifies risks and compliance requirements
    7. Finance & Resource Manager - Defines budget and resource planning
    """
    
    def __init__(self):
        self.agents_count = 7
        self.config_path = Path(__file__).parent.parent / "config"
        self.agent_configs = self._load_agent_configs()
        self.round_config = self._load_round_config()
        self.agents: Dict[str, Agent] = {}
        self.conversation_log: List[ConversationEntry] = []
        self.decisions: List[Decision] = []
        self._initialize_llm()
        
    def _initialize_llm(self):
        """Initialize the LLM for all agents."""
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")
        
        self.llm = LLM(
            model="anthropic/claude-3-5-sonnet-20241022",
            api_key=api_key,
            temperature=0.7
        )
        
    def _load_agent_configs(self) -> Dict[str, Dict]:
        """Load all agent configurations from YAML files."""
        agents_path = self.config_path / "agents"
        configs = {}
        
        agent_files = [
            "program_coordinator",
            "tech_architecture",
            "platform_delivery",
            "go_to_market",
            "customer_success",
            "risk_compliance",
            "finance_resources",
        ]
        
        for agent_name in agent_files:
            yaml_path = agents_path / f"{agent_name}.yaml"
            if yaml_path.exists():
                with open(yaml_path, 'r') as f:
                    configs[agent_name] = yaml.safe_load(f)
                    
        return configs
    
    def _load_round_config(self) -> Dict:
        """Load round definitions from YAML."""
        rounds_path = self.config_path / "rounds" / "standard_planning.yaml"
        if rounds_path.exists():
            with open(rounds_path, 'r') as f:
                return yaml.safe_load(f)
        return {"rounds": []}
    
    def _create_agents(self) -> Dict[str, Agent]:
        """Create CrewAI agents from configurations."""
        agents = {}
        
        for agent_id, config in self.agent_configs.items():
            agents[agent_id] = Agent(
                role=config.get("role", agent_id),
                goal=config.get("goal", ""),
                backstory=config.get("backstory", ""),
                verbose=config.get("verbose", True),
                allow_delegation=config.get("allow_delegation", False),
                llm=self.llm
            )
            
        return agents
    
    def _create_round_tasks(
        self, 
        round_config: Dict, 
        input_data: EPMGeneratorInput,
        previous_outputs: Dict[int, str]
    ) -> List[Task]:
        """Create tasks for a specific planning round."""
        tasks = []
        round_num = round_config.get("round", 1)
        round_name = round_config.get("name", "Unknown")
        objectives = round_config.get("objectives", [])
        participating_agents = round_config.get("participating_agents", [])
        expected_outputs = round_config.get("outputs", [])
        
        objectives_text = "\n".join(f"- {obj}" for obj in objectives)
        outputs_text = "\n".join(f"- {out}" for out in expected_outputs)
        
        previous_context = ""
        if previous_outputs:
            previous_context = "\n\nPrevious Round Outputs:\n"
            for prev_round, output in previous_outputs.items():
                previous_context += f"\nRound {prev_round}:\n{output[:2000]}...\n"
        
        business_context = f"""
Business Name: {input_data.business_context.name}
Business Type: {input_data.business_context.type}
Scale: {input_data.business_context.scale}
Description: {input_data.business_context.description}
Industry: {input_data.business_context.industry or 'Not specified'}
"""
        
        constraints_text = ""
        if input_data.constraints:
            if input_data.constraints.budget:
                constraints_text += f"Budget: ${input_data.constraints.budget:,.0f}\n"
            if input_data.constraints.deadline:
                constraints_text += f"Deadline: {input_data.constraints.deadline}\n"
            if input_data.constraints.regulations:
                constraints_text += f"Regulations: {', '.join(input_data.constraints.regulations)}\n"
        
        for agent_id in participating_agents:
            if agent_id == "knowledge_curator":
                continue
                
            agent = self.agents.get(agent_id)
            if not agent:
                continue
            
            task_description = f"""
You are participating in Round {round_num}: {round_name}

{round_config.get('description', '')}

**Objectives for this round:**
{objectives_text}

**Expected outputs:**
{outputs_text}

**Business Context:**
{business_context}

**Constraints:**
{constraints_text if constraints_text else 'No specific constraints defined'}
{previous_context}

Based on your role as {agent.role}, provide your expert input for this round.

Your response should be structured and include:
1. Your key observations and recommendations
2. Specific deliverables or work items you propose
3. Dependencies on other workstreams or agents
4. Risks you've identified from your perspective
5. Timeline considerations
6. Resource requirements from your domain

Be specific and actionable. Reference the business context and objectives.
"""
            
            task = Task(
                description=task_description,
                expected_output=f"Structured analysis and recommendations for {round_name} from the perspective of {agent.role}",
                agent=agent
            )
            tasks.append(task)
            
        return tasks
    
    def _create_synthesis_task(
        self, 
        round_config: Dict, 
        round_outputs: List[str],
        input_data: EPMGeneratorInput
    ) -> Task:
        """Create a synthesis task for the coordinator to summarize round outputs."""
        round_num = round_config.get("round", 1)
        round_name = round_config.get("name", "Unknown")
        
        outputs_summary = "\n\n".join([f"Agent Output {i+1}:\n{output}" for i, output in enumerate(round_outputs)])
        
        synthesis_description = f"""
As Program Coordinator, synthesize the outputs from Round {round_num}: {round_name}

**Agent Outputs to Synthesize:**
{outputs_summary[:8000]}

**Your synthesis should:**
1. Identify key themes and consensus points
2. Note any conflicting views or trade-offs needed
3. Propose decisions that need to be made
4. Create a consolidated summary of round outcomes
5. Identify open items for subsequent rounds

Output a structured synthesis that captures the collective intelligence of the team.
Include a JSON block at the end with key decisions in this format:
```json
{{
  "decisions": [
    {{"topic": "...", "decision": "...", "rationale": "..."}}
  ],
  "workstream_updates": [
    {{"name": "...", "description": "...", "owner": "...", "startMonth": 1, "endMonth": 3}}
  ],
  "risks_identified": [
    {{"description": "...", "probability": "medium", "impact": "high", "mitigation": "..."}}
  ],
  "resources_needed": [
    {{"role": "...", "skills": [...], "allocation": 0.5, "costPerMonth": 10000}}
  ]
}}
```
"""
        
        coordinator = self.agents.get("program_coordinator")
        
        return Task(
            description=synthesis_description,
            expected_output=f"Synthesized summary of Round {round_num} with decisions and action items",
            agent=coordinator
        )
    
    def _log_conversation(self, round_num: int, agent_id: str, message: str):
        """Add an entry to the conversation log."""
        agent_config = self.agent_configs.get(agent_id, {})
        agent_name = agent_config.get("role", agent_id)
        
        entry = ConversationEntry(
            round=round_num,
            agent_id=agent_id,
            agent_name=agent_name,
            message=message[:2000],
            timestamp=datetime.now().isoformat()
        )
        self.conversation_log.append(entry)
    
    def _extract_decisions(self, synthesis_output: str, round_num: int) -> List[Decision]:
        """Extract decisions from the synthesis output."""
        decisions = []
        
        try:
            json_start = synthesis_output.find("```json")
            json_end = synthesis_output.find("```", json_start + 7)
            
            if json_start != -1 and json_end != -1:
                json_str = synthesis_output[json_start + 7:json_end].strip()
                data = json.loads(json_str)
                
                for d in data.get("decisions", []):
                    decision = Decision(
                        id=str(uuid.uuid4()),
                        round=round_num,
                        topic=d.get("topic", "Unknown"),
                        decision=d.get("decision", ""),
                        rationale=d.get("rationale", ""),
                        made_by="Program Coordinator",
                        endorsed_by=[]
                    )
                    decisions.append(decision)
        except (json.JSONDecodeError, ValueError):
            pass
            
        return decisions
    
    def _extract_workstreams(self, all_synthesis: List[str], input_data: EPMGeneratorInput) -> List[Workstream]:
        """Extract workstreams from all synthesis outputs."""
        workstreams = []
        workstream_data = []
        
        for synthesis in all_synthesis:
            try:
                json_start = synthesis.find("```json")
                json_end = synthesis.find("```", json_start + 7)
                
                if json_start != -1 and json_end != -1:
                    json_str = synthesis[json_start + 7:json_end].strip()
                    data = json.loads(json_str)
                    workstream_data.extend(data.get("workstream_updates", []))
            except (json.JSONDecodeError, ValueError):
                continue
        
        ws_by_name = {}
        for ws in workstream_data:
            name = ws.get("name", "Unknown Workstream")
            if name not in ws_by_name:
                ws_by_name[name] = ws
        
        for name, ws in ws_by_name.items():
            ws_id = str(uuid.uuid4())
            deliverable = Deliverable(
                id=str(uuid.uuid4()),
                name=f"{name} - Initial Deliverable",
                description=ws.get("description", ""),
                workstream_id=ws_id,
                due_month=ws.get("endMonth", 3),
                status="not_started"
            )
            
            workstream = Workstream(
                id=ws_id,
                name=name,
                description=ws.get("description", ""),
                owner=ws.get("owner", "TBD"),
                deliverables=[deliverable],
                dependencies=[],
                resource_requirements=[],
                start_month=ws.get("startMonth", 1),
                end_month=ws.get("endMonth", 3),
                confidence=0.8
            )
            workstreams.append(workstream)
        
        if not workstreams:
            workstreams = self._generate_default_workstreams(input_data)
            
        return workstreams
    
    def _generate_default_workstreams(self, input_data: EPMGeneratorInput) -> List[Workstream]:
        """Generate default workstreams if extraction fails."""
        business_name = input_data.business_context.name
        
        workstream1_id = str(uuid.uuid4())
        workstream2_id = str(uuid.uuid4())
        workstream3_id = str(uuid.uuid4())
        
        return [
            Workstream(
                id=workstream1_id,
                name="Strategy & Planning",
                description=f"Define strategic objectives and create implementation roadmap for {business_name}",
                owner="Strategy Lead",
                deliverables=[
                    Deliverable(
                        id=str(uuid.uuid4()),
                        name="Strategic Assessment",
                        description="Comprehensive analysis of current state and opportunities",
                        workstream_id=workstream1_id,
                        due_month=1,
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
                        id=str(uuid.uuid4()),
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
                        id=str(uuid.uuid4()),
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
                    )
                ],
                start_month=3,
                end_month=6,
                confidence=0.75
            )
        ]
    
    def _extract_risks(self, all_synthesis: List[str]) -> List[Risk]:
        """Extract risks from all synthesis outputs."""
        risks = []
        seen_descriptions = set()
        
        for synthesis in all_synthesis:
            try:
                json_start = synthesis.find("```json")
                json_end = synthesis.find("```", json_start + 7)
                
                if json_start != -1 and json_end != -1:
                    json_str = synthesis[json_start + 7:json_end].strip()
                    data = json.loads(json_str)
                    
                    for r in data.get("risks_identified", []):
                        desc = r.get("description", "")
                        if desc and desc not in seen_descriptions:
                            seen_descriptions.add(desc)
                            risk = Risk(
                                id=str(uuid.uuid4()),
                                description=desc,
                                probability=r.get("probability", "medium"),
                                impact=r.get("impact", "medium"),
                                mitigation=r.get("mitigation", "To be defined"),
                                owner="Risk Committee",
                                category="Program"
                            )
                            risks.append(risk)
            except (json.JSONDecodeError, ValueError):
                continue
        
        if not risks:
            risks = [
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
                )
            ]
            
        return risks
    
    def _extract_resources(self, all_synthesis: List[str]) -> List[ResourceRequirement]:
        """Extract resources from all synthesis outputs."""
        resources = []
        seen_roles = set()
        
        for synthesis in all_synthesis:
            try:
                json_start = synthesis.find("```json")
                json_end = synthesis.find("```", json_start + 7)
                
                if json_start != -1 and json_end != -1:
                    json_str = synthesis[json_start + 7:json_end].strip()
                    data = json.loads(json_str)
                    
                    for r in data.get("resources_needed", []):
                        role = r.get("role", "")
                        if role and role not in seen_roles:
                            seen_roles.add(role)
                            resource = ResourceRequirement(
                                role=role,
                                skills=r.get("skills", []),
                                allocation=r.get("allocation", 1.0),
                                cost_per_month=r.get("costPerMonth", 10000)
                            )
                            resources.append(resource)
            except (json.JSONDecodeError, ValueError):
                continue
        
        if not resources:
            resources = [
                ResourceRequirement(role="Strategy Consultant", skills=["Strategic Planning"], allocation=1.0, cost_per_month=15000),
                ResourceRequirement(role="Project Manager", skills=["Project Management"], allocation=1.0, cost_per_month=13000),
                ResourceRequirement(role="Business Analyst", skills=["Analysis"], allocation=0.5, cost_per_month=10000),
            ]
            
        return resources
    
    def _build_timeline(self, workstreams: List[Workstream]) -> Timeline:
        """Build a timeline from workstreams."""
        if not workstreams:
            return Timeline(phases=[], total_months=6, critical_path=[])
        
        max_month = max(ws.end_month for ws in workstreams)
        min_month = min(ws.start_month for ws in workstreams)
        
        phases = []
        current_phase_start = min_month
        phase_duration = max((max_month - min_month + 1) // 3, 2)
        
        phase_num = 1
        while current_phase_start <= max_month:
            phase_end = min(current_phase_start + phase_duration - 1, max_month)
            
            phase_workstreams = [
                ws.id for ws in workstreams 
                if ws.start_month <= phase_end and ws.end_month >= current_phase_start
            ]
            
            phase_deliverables = []
            for ws in workstreams:
                if ws.id in phase_workstreams:
                    phase_deliverables.extend([d.id for d in ws.deliverables if d.due_month and d.due_month <= phase_end])
            
            milestone = Milestone(
                id=str(uuid.uuid4()),
                name=f"Phase {phase_num} Complete",
                due_month=phase_end,
                deliverable_ids=phase_deliverables[:5]
            )
            
            phase = TimelinePhase(
                id=str(uuid.uuid4()),
                name=f"Phase {phase_num}",
                start_month=current_phase_start,
                end_month=phase_end,
                workstream_ids=phase_workstreams,
                milestones=[milestone]
            )
            phases.append(phase)
            
            current_phase_start = phase_end + 1
            phase_num += 1
        
        critical_path = []
        sorted_ws = sorted(workstreams, key=lambda x: x.start_month)
        for ws in sorted_ws:
            if ws.dependencies or not critical_path:
                critical_path.append(ws.id)
        
        return Timeline(
            phases=phases,
            total_months=max_month,
            critical_path=critical_path
        )
    
    def _build_resource_plan(self, resources: List[ResourceRequirement]) -> ResourcePlan:
        """Build a resource plan from resource requirements."""
        total_cost = sum(
            (r.cost_per_month or 10000) * r.allocation * 6 
            for r in resources
        )
        
        return ResourcePlan(
            roles=resources,
            total_headcount=len(resources),
            total_cost=total_cost
        )
    
    def _build_financial_plan(self, resource_plan: ResourcePlan, input_data: EPMGeneratorInput) -> FinancialPlan:
        """Build a financial plan."""
        personnel_cost = resource_plan.total_cost / 6
        
        capex = [
            FinancialItem(category="Technology", description="Software licenses and tools", amount=50000, frequency="one_time"),
            FinancialItem(category="Infrastructure", description="Cloud infrastructure setup", amount=25000, frequency="one_time")
        ]
        
        opex = [
            FinancialItem(category="Personnel", description="Team salaries", amount=personnel_cost, frequency="monthly"),
            FinancialItem(category="Operations", description="Ongoing operational costs", amount=10000, frequency="monthly")
        ]
        
        total_budget = 75000 + (personnel_cost + 10000) * 6
        
        if input_data.constraints and input_data.constraints.budget:
            if total_budget > input_data.constraints.budget:
                scale_factor = input_data.constraints.budget / total_budget
                total_budget = input_data.constraints.budget
                for item in capex:
                    item.amount *= scale_factor
                for item in opex:
                    item.amount *= scale_factor
        
        return FinancialPlan(
            capex=capex,
            opex=opex,
            total_budget=total_budget,
            contingency=total_budget * 0.1
        )
    
    async def generate(self, input_data: EPMGeneratorInput) -> Dict[str, Any]:
        """
        Generate an EPM program using multi-agent collaboration.
        
        Runs 7 planning rounds with all agents participating, then synthesizes
        the results into a complete EPM program.
        """
        self.conversation_log = []
        self.decisions = []
        
        self.agents = self._create_agents()
        
        all_synthesis_outputs = []
        previous_outputs: Dict[int, str] = {}
        
        rounds = self.round_config.get("rounds", [])
        
        for round_config in rounds:
            round_num = round_config.get("round", 1)
            round_name = round_config.get("name", "Unknown")
            
            self._log_conversation(
                round_num,
                "system",
                f"Starting Round {round_num}: {round_name}"
            )
            
            round_tasks = self._create_round_tasks(round_config, input_data, previous_outputs)
            
            if not round_tasks:
                continue
            
            crew = Crew(
                agents=list(self.agents.values()),
                tasks=round_tasks,
                process=Process.sequential,
                verbose=True
            )
            
            try:
                result = crew.kickoff()
                
                round_outputs = []
                if hasattr(result, 'tasks_output'):
                    for task_output in result.tasks_output:
                        output_str = str(task_output)
                        round_outputs.append(output_str)
                        
                        agent_id = None
                        for aid, agent in self.agents.items():
                            if agent.role in output_str[:200]:
                                agent_id = aid
                                break
                        
                        if agent_id:
                            self._log_conversation(round_num, agent_id, output_str[:2000])
                else:
                    round_outputs = [str(result)]
                    self._log_conversation(round_num, "crew", str(result)[:2000])
                
                synthesis_task = self._create_synthesis_task(round_config, round_outputs, input_data)
                
                synthesis_crew = Crew(
                    agents=[self.agents["program_coordinator"]],
                    tasks=[synthesis_task],
                    process=Process.sequential,
                    verbose=True
                )
                
                synthesis_result = synthesis_crew.kickoff()
                synthesis_output = str(synthesis_result)
                
                all_synthesis_outputs.append(synthesis_output)
                previous_outputs[round_num] = synthesis_output
                
                self._log_conversation(round_num, "program_coordinator", synthesis_output[:2000])
                
                round_decisions = self._extract_decisions(synthesis_output, round_num)
                self.decisions.extend(round_decisions)
                
            except Exception as e:
                self._log_conversation(
                    round_num,
                    "system",
                    f"Round {round_num} encountered an error: {str(e)}"
                )
                continue
        
        workstreams = self._extract_workstreams(all_synthesis_outputs, input_data)
        risks = self._extract_risks(all_synthesis_outputs)
        resources = self._extract_resources(all_synthesis_outputs)
        timeline = self._build_timeline(workstreams)
        resource_plan = self._build_resource_plan(resources)
        financial_plan = self._build_financial_plan(resource_plan, input_data)
        
        risk_level = "medium"
        if len([r for r in risks if r.impact == "high"]) > len(risks) / 2:
            risk_level = "high"
        elif len([r for r in risks if r.impact == "low"]) > len(risks) / 2:
            risk_level = "low"
        
        overall_confidence = 0.8
        if workstreams:
            overall_confidence = sum(ws.confidence for ws in workstreams) / len(workstreams)
        
        program = EPMProgram(
            id=str(uuid.uuid4()),
            title=f"{input_data.business_context.name} Strategic Transformation Program",
            description=f"A comprehensive program to execute strategic initiatives for {input_data.business_context.name}",
            workstreams=workstreams,
            timeline=timeline,
            resource_plan=resource_plan,
            risk_register=RiskRegister(risks=risks, overall_risk_level=risk_level),
            financial_plan=financial_plan,
            overall_confidence=overall_confidence
        )
        
        return {
            "program": program,
            "conversation_log": self.conversation_log,
            "decisions": self.decisions,
            "rounds_completed": len(all_synthesis_outputs),
            "agents_participated": self.agents_count
        }
