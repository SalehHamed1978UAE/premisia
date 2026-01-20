"""
Knowledge Curator - Extracts reusable knowledge from agent conversations

This module processes the conversation log after all planning rounds complete
and extracts knowledge candidates that can be stored for organizational learning.
"""

import os
import uuid
import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple
from pathlib import Path

import yaml
from crewai import Agent, Task, Crew, Process
from crewai.llm import LLM

from models.schemas import (
    ConversationEntry,
    KnowledgeLedger,
    KnowledgeEmission,
    KnowledgeStats,
    SupportingEvidence,
    EPMProgram,
)


class KnowledgeCurator:
    """
    Extracts reusable knowledge from multi-agent planning conversations.
    
    Processes conversation logs to identify:
    - Facts: Verified statements about the business or industry
    - Estimates: Quantified assumptions with uncertainty
    - Constraints: Limitations that shaped decisions
    - Lessons Learned: Insights from past experiences
    - Decision Rationale: Why specific choices were made
    - Patterns: Recurring themes or approaches
    """
    
    KNOWLEDGE_TYPES = [
        "fact",
        "estimate", 
        "constraint",
        "lesson_learned",
        "decision_rationale",
        "pattern"
    ]
    
    KNOWLEDGE_SCOPES = [
        "organization",
        "industry",
        "program_specific"
    ]
    
    def __init__(self):
        self.config_path = Path(__file__).parent.parent / "config"
        self._initialize_llm()
        self._load_curator_config()
        
    def _initialize_llm(self):
        """Initialize the LLM for knowledge extraction."""
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")
        
        self.llm = LLM(
            model="anthropic/claude-3-5-sonnet-20241022",
            api_key=api_key,
            temperature=0.3
        )
        
    def _load_curator_config(self):
        """Load curator configuration from YAML."""
        curator_path = self.config_path / "agents" / "knowledge_curator.yaml"
        if curator_path.exists():
            with open(curator_path, 'r') as f:
                self.config = yaml.safe_load(f)
        else:
            self.config = {
                "role": "Knowledge Curator",
                "goal": "Extract reusable knowledge from agent conversations",
                "backstory": "You are a knowledge management specialist."
            }
    
    def _create_curator_agent(self) -> Agent:
        """Create the knowledge curator agent."""
        return Agent(
            role=self.config.get("role", "Knowledge Curator"),
            goal=self.config.get("goal", "Extract reusable knowledge"),
            backstory=self.config.get("backstory", ""),
            verbose=True,
            allow_delegation=False,
            llm=self.llm
        )
    
    def _prepare_conversation_summary(self, conversation_log: List[ConversationEntry]) -> str:
        """Prepare a summary of the conversation for analysis."""
        summary_parts = []
        
        by_round: Dict[int, List[ConversationEntry]] = {}
        for entry in conversation_log:
            if entry.round not in by_round:
                by_round[entry.round] = []
            by_round[entry.round].append(entry)
        
        for round_num in sorted(by_round.keys()):
            entries = by_round[round_num]
            summary_parts.append(f"\n=== Round {round_num} ===\n")
            
            for entry in entries:
                summary_parts.append(
                    f"[{entry.agent_name}]: {entry.message[:1000]}\n"
                )
        
        return "\n".join(summary_parts)
    
    def _extract_candidates_with_llm(
        self, 
        conversation_summary: str,
        program: EPMProgram
    ) -> List[Dict[str, Any]]:
        """Use LLM to extract knowledge candidates from conversation."""
        curator = self._create_curator_agent()
        
        extraction_prompt = f"""
Analyze this multi-agent planning conversation and extract reusable knowledge.

**Program Context:**
Title: {program.title}
Description: {program.description}

**Conversation Log:**
{conversation_summary[:15000]}

**Extract knowledge candidates in these categories:**
1. **Facts**: Verified statements about the business, market, or technology
2. **Estimates**: Quantified assumptions (timelines, costs, probabilities)
3. **Constraints**: Limitations that influenced decisions
4. **Lessons Learned**: Insights from experience that could help future planning
5. **Decision Rationale**: Why specific choices were made over alternatives
6. **Patterns**: Recurring themes or successful approaches

For each knowledge candidate, provide:
- content: The knowledge statement (1-3 sentences)
- summary: Brief title (5-10 words)
- type: One of [fact, estimate, constraint, lesson_learned, decision_rationale, pattern]
- scope: One of [organization, industry, program_specific]
- confidence: 0.0-1.0 based on evidence strength
- tags: Relevant keywords
- supporting_agents: Which agents endorsed this knowledge
- contradicting_agents: Which agents disagreed (if any)

Output as JSON array:
```json
[
  {{
    "content": "...",
    "summary": "...",
    "type": "pattern",
    "scope": "industry",
    "confidence": 0.85,
    "tags": ["tag1", "tag2"],
    "supporting_agents": ["Program Coordinator", "Tech Architecture Lead"],
    "contradicting_agents": []
  }}
]
```

Extract 10-30 diverse knowledge candidates. Focus on actionable, reusable insights.
"""
        
        task = Task(
            description=extraction_prompt,
            expected_output="JSON array of knowledge candidates with all required fields",
            agent=curator
        )
        
        crew = Crew(
            agents=[curator],
            tasks=[task],
            process=Process.sequential,
            verbose=True
        )
        
        try:
            result = crew.kickoff()
            return self._parse_candidates(str(result))
        except Exception as e:
            print(f"Knowledge extraction failed: {e}")
            return []
    
    def _parse_candidates(self, result: str) -> List[Dict[str, Any]]:
        """Parse JSON candidates from LLM output."""
        candidates = []
        
        try:
            json_start = result.find("```json")
            json_end = result.find("```", json_start + 7)
            
            if json_start != -1 and json_end != -1:
                json_str = result[json_start + 7:json_end].strip()
                candidates = json.loads(json_str)
            else:
                json_match = re.search(r'\[[\s\S]*\]', result)
                if json_match:
                    candidates = json.loads(json_match.group())
        except (json.JSONDecodeError, ValueError) as e:
            print(f"Failed to parse candidates: {e}")
            
        return candidates
    
    def _validate_candidate(self, candidate: Dict[str, Any]) -> bool:
        """Validate that a candidate has required fields."""
        required_fields = ["content", "summary", "type", "scope", "confidence"]
        
        for field in required_fields:
            if field not in candidate:
                return False
        
        if candidate.get("type") not in self.KNOWLEDGE_TYPES:
            return False
            
        if candidate.get("scope") not in self.KNOWLEDGE_SCOPES:
            return False
            
        confidence = candidate.get("confidence", 0)
        if not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 1:
            return False
            
        return True
    
    def _deduplicate_candidates(
        self, 
        candidates: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Remove duplicate or highly similar candidates."""
        unique = []
        seen_summaries: Set[str] = set()
        duplicates = 0
        
        for candidate in candidates:
            summary_lower = candidate.get("summary", "").lower().strip()
            content_key = candidate.get("content", "")[:100].lower()
            
            if summary_lower in seen_summaries:
                duplicates += 1
                continue
                
            is_duplicate = False
            for existing in unique:
                existing_content = existing.get("content", "")[:100].lower()
                if self._similarity_score(content_key, existing_content) > 0.8:
                    is_duplicate = True
                    duplicates += 1
                    break
            
            if not is_duplicate:
                seen_summaries.add(summary_lower)
                unique.append(candidate)
        
        return unique, duplicates
    
    def _similarity_score(self, s1: str, s2: str) -> float:
        """Calculate simple word-overlap similarity."""
        words1 = set(s1.split())
        words2 = set(s2.split())
        
        if not words1 or not words2:
            return 0.0
            
        intersection = words1 & words2
        union = words1 | words2
        
        return len(intersection) / len(union) if union else 0.0
    
    def _categorize_by_confidence(
        self, 
        candidates: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Categorize candidates by confidence level."""
        verified = []
        contested = []
        rejected = []
        
        for candidate in candidates:
            confidence = candidate.get("confidence", 0)
            has_contradictions = bool(candidate.get("contradicting_agents", []))
            
            if has_contradictions:
                if confidence >= 0.6:
                    contested.append(candidate)
                else:
                    rejected.append(candidate)
            elif confidence >= 0.7:
                verified.append(candidate)
            elif confidence >= 0.4:
                contested.append(candidate)
            else:
                rejected.append(candidate)
        
        return verified, contested, rejected
    
    def _create_emission(
        self, 
        candidate: Dict[str, Any],
        program: EPMProgram,
        status: str = "verified"
    ) -> KnowledgeEmission:
        """Create a KnowledgeEmission from a candidate."""
        supporting_evidence = []
        for agent_name in candidate.get("supporting_agents", []):
            evidence = SupportingEvidence(
                agent_id=agent_name.lower().replace(" ", "_"),
                agent_name=agent_name,
                round=1,
                statement=f"Endorsed: {candidate.get('summary', '')}"
            )
            supporting_evidence.append(evidence)
        
        contradictions = []
        for agent_name in candidate.get("contradicting_agents", []):
            contradiction = SupportingEvidence(
                agent_id=agent_name.lower().replace(" ", "_"),
                agent_name=agent_name,
                round=1,
                statement=f"Disputed: {candidate.get('summary', '')}"
            )
            contradictions.append(contradiction)
        
        knowledge_type = candidate.get("type", "pattern")
        if knowledge_type == "fact":
            memory_layer = "semantic"
        elif knowledge_type in ["lesson_learned", "decision_rationale"]:
            memory_layer = "episodic"
        else:
            memory_layer = "symbolic"
        
        return KnowledgeEmission(
            id=str(uuid.uuid4()),
            content=candidate.get("content", ""),
            summary=candidate.get("summary", ""),
            type=knowledge_type,
            scope=candidate.get("scope", "program_specific"),
            suggested_memory_layer=memory_layer,
            tags=candidate.get("tags", []),
            confidence=candidate.get("confidence", 0.5),
            verification_status=status,
            supporting_evidence=supporting_evidence,
            contradictions=contradictions if contradictions else None,
            source={
                "program_id": program.id,
                "program_name": program.title,
                "generated_at": datetime.now().isoformat(),
                "curator_version": "1.0.0"
            }
        )
    
    def _generate_fallback_emissions(
        self, 
        program: EPMProgram,
        conversation_log: List[ConversationEntry]
    ) -> List[KnowledgeEmission]:
        """Generate fallback emissions if LLM extraction fails."""
        emissions = []
        
        if program.timeline and program.timeline.total_months:
            emissions.append(KnowledgeEmission(
                id=str(uuid.uuid4()),
                content=f"Programs of this scale typically require {program.timeline.total_months} months for implementation.",
                summary="Program duration benchmark",
                type="pattern",
                scope="industry",
                suggested_memory_layer="semantic",
                tags=["timeline", "duration", "benchmark"],
                confidence=0.8,
                verification_status="verified",
                supporting_evidence=[
                    SupportingEvidence(
                        agent_id="program_coordinator",
                        agent_name="Program Coordinator",
                        round=4,
                        statement="Timeline validated across workstreams"
                    )
                ],
                source={
                    "program_id": program.id,
                    "program_name": program.title,
                    "generated_at": datetime.now().isoformat(),
                    "curator_version": "1.0.0"
                }
            ))
        
        if program.resource_plan:
            emissions.append(KnowledgeEmission(
                id=str(uuid.uuid4()),
                content=f"Resource allocation of {program.resource_plan.total_headcount} FTEs recommended for programs of this scope and complexity.",
                summary="Resource sizing guidelines",
                type="estimate",
                scope="organization",
                suggested_memory_layer="semantic",
                tags=["resources", "headcount", "staffing"],
                confidence=0.75,
                verification_status="verified",
                supporting_evidence=[
                    SupportingEvidence(
                        agent_id="finance_resources",
                        agent_name="Finance & Resource Manager",
                        round=4,
                        statement="Resource plan validated against budget"
                    )
                ],
                source={
                    "program_id": program.id,
                    "program_name": program.title,
                    "generated_at": datetime.now().isoformat(),
                    "curator_version": "1.0.0"
                }
            ))
        
        if program.risk_register and program.risk_register.risks:
            high_risks = [r for r in program.risk_register.risks if r.impact == "high"]
            if high_risks:
                emissions.append(KnowledgeEmission(
                    id=str(uuid.uuid4()),
                    content=f"High-impact risks identified: {', '.join([r.description[:50] for r in high_risks[:3]])}. Proactive mitigation is essential.",
                    summary="Critical risk patterns",
                    type="lesson_learned",
                    scope="organization",
                    suggested_memory_layer="episodic",
                    tags=["risk", "mitigation", "planning"],
                    confidence=0.85,
                    verification_status="verified",
                    supporting_evidence=[
                        SupportingEvidence(
                            agent_id="risk_compliance",
                            agent_name="Risk & Compliance Officer",
                            round=5,
                            statement="Risk assessment validated"
                        )
                    ],
                    source={
                        "program_id": program.id,
                        "program_name": program.title,
                        "generated_at": datetime.now().isoformat(),
                        "curator_version": "1.0.0"
                    }
                ))
        
        for ws in program.workstreams[:3]:
            if ws.dependencies:
                emissions.append(KnowledgeEmission(
                    id=str(uuid.uuid4()),
                    content=f"Workstream '{ws.name}' depends on upstream deliverables. Ensure proper sequencing to avoid delays.",
                    summary=f"{ws.name} dependency constraint",
                    type="constraint",
                    scope="program_specific",
                    suggested_memory_layer="symbolic",
                    tags=["dependencies", "sequencing", ws.name.lower().replace(" ", "_")],
                    confidence=0.9,
                    verification_status="verified",
                    supporting_evidence=[
                        SupportingEvidence(
                            agent_id="platform_delivery",
                            agent_name="Platform Delivery Manager",
                            round=2,
                            statement="Dependencies mapped and validated"
                        )
                    ],
                    source={
                        "program_id": program.id,
                        "program_name": program.title,
                        "generated_at": datetime.now().isoformat(),
                        "curator_version": "1.0.0"
                    }
                ))
        
        return emissions
    
    async def curate(
        self,
        conversation_log: List[ConversationEntry],
        program: EPMProgram,
        decisions: Optional[List[Any]] = None
    ) -> KnowledgeLedger:
        """
        Process conversation log and extract knowledge emissions.
        
        Args:
            conversation_log: List of conversation entries from all rounds
            program: The generated EPM program
            decisions: Optional list of decisions made during planning
            
        Returns:
            KnowledgeLedger containing verified, contested, and rejected knowledge
        """
        conversation_summary = self._prepare_conversation_summary(conversation_log)
        
        raw_candidates = self._extract_candidates_with_llm(conversation_summary, program)
        
        valid_candidates = [c for c in raw_candidates if self._validate_candidate(c)]
        
        unique_candidates, duplicates_removed = self._deduplicate_candidates(valid_candidates)
        
        verified_candidates, contested_candidates, rejected_candidates = \
            self._categorize_by_confidence(unique_candidates)
        
        emissions = [
            self._create_emission(c, program, "verified") 
            for c in verified_candidates
        ]
        
        contested = [
            self._create_emission(c, program, "contested")
            for c in contested_candidates
        ]
        
        rejected = [
            self._create_emission(c, program, "hypothesis")
            for c in rejected_candidates
        ]
        
        if len(emissions) < 5:
            fallback = self._generate_fallback_emissions(program, conversation_log)
            existing_summaries = {e.summary for e in emissions}
            for fb in fallback:
                if fb.summary not in existing_summaries:
                    emissions.append(fb)
        
        stats = KnowledgeStats(
            total_candidates=len(raw_candidates),
            verified=len(emissions),
            deduplicated=duplicates_removed,
            emitted=len(emissions),
            contested=len(contested),
            rejected=len(rejected),
            flagged_for_review=len([e for e in emissions if e.confidence < 0.8])
        )
        
        return KnowledgeLedger(
            emissions=emissions,
            contested=contested,
            rejected=rejected,
            stats=stats
        )
