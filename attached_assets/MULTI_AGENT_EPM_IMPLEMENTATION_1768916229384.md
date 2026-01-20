# Multi-Agent EPM Generation System - Complete Implementation Guide

## Overview

This document contains everything needed to implement a multi-agent Enterprise Program Management (EPM) generation system using CrewAI. The system replaces the current single-pass WBS generation with a collaborative multi-agent approach where specialized agents work together through progressive elaboration rounds.

**Key Features:**
- 7 specialized agents (Program Coordinator, Tech Architecture, Platform Delivery, Go-to-Market, Customer Success, Risk & Compliance, Finance & Resources)
- 7 rounds of progressive elaboration
- Knowledge Curator that extracts reusable knowledge from conversations
- Modular architecture with easy switch between legacy and new system
- Agent profiles loaded from YAML (easy to add new agents)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EPM Generation Request                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EPM Generator Router                         │
│                                                                 │
│   if (config.USE_MULTI_AGENT_EPM) {                            │
│     return multiAgentGenerator.generate(input);                 │
│   } else {                                                      │
│     return legacyGenerator.generate(input);  // Current code   │
│   }                                                             │
└─────────────────────────────────────────────────────────────────┘
                    │                       │
         ┌──────────┘                       └──────────┐
         ▼                                             ▼
┌─────────────────────┐                 ┌─────────────────────────┐
│ Legacy Generator    │                 │ Multi-Agent Generator   │
│ (Current Code)      │                 │ (CrewAI Python Service) │
└─────────────────────┘                 └─────────────────────────┘
                    │                       │
                    └───────────┬───────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Common EPM Output Format                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1: TypeScript Side (Premisia Backend)

### 1.1 Create Directory Structure

```
server/
├── services/
│   └── epm-generator/           # NEW - Isolated module
│       ├── index.ts             # Router/factory
│       ├── types.ts             # Shared interfaces
│       ├── legacy-generator.ts  # Wraps existing code
│       └── multi-agent-generator.ts  # Calls CrewAI
```

### 1.2 Types (server/services/epm-generator/types.ts)

```typescript
/**
 * Common interfaces for EPM generation.
 * Both legacy and multi-agent generators implement these.
 */

export interface BusinessContext {
  name: string;
  type: string;
  scale: string;
  description: string;
  industry?: string;
  keywords?: string[];
}

export interface Constraints {
  budget?: number;
  deadline?: Date;
  regulations?: string[];
}

export interface EPMGeneratorInput {
  businessContext: BusinessContext;
  bmcInsights: any;
  constraints?: Constraints;
  userId: string;
  sessionId: string;
}

export interface Deliverable {
  id: string;
  name: string;
  description: string;
  workstreamId: string;
  dueMonth?: number;
}

export interface Workstream {
  id: string;
  name: string;
  description: string;
  owner: string;
  deliverables: Deliverable[];
  dependencies: string[];
  resourceRequirements: any[];
  startMonth: number;
  endMonth: number;
  confidence: number;
}

export interface SupportingEvidence {
  agentId: string;
  agentName: string;
  round: number;
  statement: string;
}

export interface KnowledgeEmission {
  id: string;
  content: string;
  summary: string;
  type: 'fact' | 'estimate' | 'constraint' | 'lesson_learned' | 'decision_rationale' | 'pattern';
  scope: 'organization' | 'industry' | 'program_specific';
  suggestedMemoryLayer: 'semantic' | 'episodic' | 'symbolic';
  tags: string[];
  confidence: number;
  verificationStatus: 'verified' | 'contested' | 'hypothesis';
  supportingEvidence: SupportingEvidence[];
  contradictions?: SupportingEvidence[];
  source: {
    programId: string;
    programName: string;
    generatedAt: string;
    curatorVersion: string;
  };
}

export interface KnowledgeStats {
  totalCandidates: number;
  verified: number;
  deduplicated: number;
  emitted: number;
  contested: number;
  rejected: number;
  flaggedForReview: number;
}

export interface KnowledgeLedger {
  emissions: KnowledgeEmission[];
  contested: any[];
  rejected: any[];
  stats: KnowledgeStats;
}

export interface ConversationEntry {
  round: number;
  agentId: string;
  agentName: string;
  message: string;
  timestamp: string;
}

export interface Decision {
  id: string;
  round: number;
  topic: string;
  decision: string;
  rationale: string;
  madeBy: string;
  endorsedBy: string[];
}

export interface EPMGeneratorOutput {
  program: {
    id: string;
    workstreams: Workstream[];
    timeline: any;
    resourcePlan: any;
    riskRegister: any;
    financialPlan: any;
    overallConfidence: number;
  };
  metadata: {
    generator: 'legacy' | 'multi-agent';
    generatedAt: string;
    confidence: number;
    roundsCompleted?: number;
    agentsParticipated?: number;
    knowledgeEmissions?: number;
  };
  conversationLog?: ConversationEntry[];
  decisions?: Decision[];
  knowledgeLedger?: KnowledgeLedger;
}

export interface IEPMGenerator {
  generate(input: EPMGeneratorInput): Promise<EPMGeneratorOutput>;
}

export interface GenerationProgress {
  round: number;
  totalRounds: number;
  currentAgent: string;
  message: string;
  percentComplete: number;
}
```

### 1.3 Legacy Generator Wrapper (server/services/epm-generator/legacy-generator.ts)

```typescript
import { IEPMGenerator, EPMGeneratorInput, EPMGeneratorOutput } from './types';

/**
 * Wrapper around existing EPM generation code.
 * Delegates to current implementation without modifying it.
 */
export class LegacyEPMGenerator implements IEPMGenerator {

  async generate(input: EPMGeneratorInput): Promise<EPMGeneratorOutput> {
    console.log('[LegacyEPMGenerator] Using existing EPM generation pipeline');

    // Import existing modules dynamically to avoid circular deps
    const { WBSBuilder } = await import('../../lib/intelligent-planning/wbs-builder');
    const { EPMSynthesizer } = await import('../../intelligence/epm-synthesizer');

    // TODO: Wire up to existing pipeline
    // This is a placeholder - adjust based on actual current implementation

    // For now, throw to indicate this needs to be connected
    throw new Error('Legacy generator not yet wired up - connect to existing EPM pipeline');

    // Example of what the return should look like:
    // return {
    //   program: existingResult,
    //   metadata: {
    //     generator: 'legacy',
    //     generatedAt: new Date().toISOString(),
    //     confidence: existingResult.overallConfidence,
    //   }
    // };
  }
}
```

### 1.4 Multi-Agent Generator (server/services/epm-generator/multi-agent-generator.ts)

```typescript
import { IEPMGenerator, EPMGeneratorInput, EPMGeneratorOutput } from './types';

/**
 * Multi-agent EPM generator using CrewAI Python service.
 */
export class MultiAgentEPMGenerator implements IEPMGenerator {

  private serviceUrl: string;
  private timeout: number;

  constructor() {
    this.serviceUrl = process.env.CREWAI_SERVICE_URL || 'http://localhost:8001';
    this.timeout = 600000; // 10 minutes - multi-agent takes time
  }

  /**
   * Check if the CrewAI service is available
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serviceUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      console.error('[MultiAgentGenerator] Health check failed:', error);
      return false;
    }
  }

  /**
   * Generate EPM using multi-agent collaboration
   */
  async generate(input: EPMGeneratorInput): Promise<EPMGeneratorOutput> {
    console.log('[MultiAgentGenerator] Starting multi-agent collaboration');
    console.log(`[MultiAgentGenerator] Service URL: ${this.serviceUrl}`);

    // Check service health first
    const healthy = await this.isHealthy();
    if (!healthy) {
      throw new Error('CrewAI service is not available. Check if the Python service is running.');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.serviceUrl}/generate-program`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`CrewAI service error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      console.log('[MultiAgentGenerator] Generation complete');
      console.log(`[MultiAgentGenerator] Rounds completed: ${result.metadata?.roundsCompleted}`);
      console.log(`[MultiAgentGenerator] Knowledge emissions: ${result.knowledgeLedger?.stats?.emitted || 0}`);

      return result;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Multi-agent generation timed out after 10 minutes');
      }
      throw error;
    }
  }
}
```

### 1.5 Router/Factory (server/services/epm-generator/index.ts)

```typescript
import { IEPMGenerator, EPMGeneratorInput, EPMGeneratorOutput } from './types';
import { LegacyEPMGenerator } from './legacy-generator';
import { MultiAgentEPMGenerator } from './multi-agent-generator';

export * from './types';

/**
 * Factory that returns the appropriate generator based on config.
 * Single point of control for switching between implementations.
 */
export class EPMGeneratorRouter {

  private legacyGenerator: LegacyEPMGenerator;
  private multiAgentGenerator: MultiAgentEPMGenerator;

  constructor() {
    this.legacyGenerator = new LegacyEPMGenerator();
    this.multiAgentGenerator = new MultiAgentEPMGenerator();
  }

  /**
   * Get the active generator based on configuration.
   *
   * @param options.forceMultiAgent - Override config to use multi-agent
   * @param options.forceLegacy - Override config to use legacy
   */
  getGenerator(options?: {
    forceMultiAgent?: boolean;
    forceLegacy?: boolean;
  }): IEPMGenerator {

    if (options?.forceLegacy) {
      console.log('[EPMRouter] Forced to use Legacy Generator');
      return this.legacyGenerator;
    }

    if (options?.forceMultiAgent) {
      console.log('[EPMRouter] Forced to use Multi-Agent Generator');
      return this.multiAgentGenerator;
    }

    const useMultiAgent = process.env.USE_MULTI_AGENT_EPM === 'true';

    if (useMultiAgent) {
      console.log('[EPMRouter] Config: Using Multi-Agent Generator');
      return this.multiAgentGenerator;
    } else {
      console.log('[EPMRouter] Config: Using Legacy Generator');
      return this.legacyGenerator;
    }
  }

  /**
   * Check if multi-agent service is available
   */
  async isMultiAgentAvailable(): Promise<boolean> {
    return this.multiAgentGenerator.isHealthy();
  }

  /**
   * Generate EPM using the configured generator.
   */
  async generate(input: EPMGeneratorInput): Promise<EPMGeneratorOutput> {
    const generator = this.getGenerator();
    return generator.generate(input);
  }
}

// Singleton instance
export const epmGeneratorRouter = new EPMGeneratorRouter();
```

### 1.6 Environment Variables

Add to `.env`:

```bash
# EPM Generator Configuration
# Set to 'true' to use multi-agent CrewAI generator
# Set to 'false' (or omit) to use legacy generator
USE_MULTI_AGENT_EPM=false

# CrewAI Python service URL (only needed if USE_MULTI_AGENT_EPM=true)
CREWAI_SERVICE_URL=http://localhost:8001
```

---

## Part 2: Python CrewAI Service

### 2.1 Directory Structure

Create a new directory `crewai-service/` at the project root:

```
crewai-service/
├── main.py                      # FastAPI server
├── config/
│   ├── agents/                  # Agent profiles (YAML)
│   │   ├── program_coordinator.yaml
│   │   ├── tech_architecture.yaml
│   │   ├── platform_delivery.yaml
│   │   ├── go_to_market.yaml
│   │   ├── customer_success.yaml
│   │   ├── risk_compliance.yaml
│   │   ├── finance_resources.yaml
│   │   └── knowledge_curator.yaml
│   └── rounds/
│       └── standard_planning.yaml
├── crews/
│   ├── __init__.py
│   ├── program_crew.py
│   ├── agent_loader.py
│   └── knowledge_curator.py
├── models/
│   ├── __init__.py
│   └── schemas.py
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

### 2.2 requirements.txt

```
crewai>=0.28.0
crewai-tools>=0.1.0
fastapi>=0.109.0
uvicorn>=0.27.0
pydantic>=2.5.0
pyyaml>=6.0.1
python-dotenv>=1.0.0
httpx>=0.26.0
langchain-openai>=0.0.5
```

### 2.3 models/__init__.py

```python
from .schemas import *
```

### 2.4 models/schemas.py

```python
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum


class BusinessContext(BaseModel):
    name: str
    type: str
    scale: str
    description: str
    industry: Optional[str] = None
    keywords: Optional[List[str]] = []


class Constraints(BaseModel):
    budget: Optional[float] = None
    deadline: Optional[datetime] = None
    regulations: Optional[List[str]] = []


class EPMGeneratorInput(BaseModel):
    businessContext: BusinessContext
    bmcInsights: Dict[str, Any]
    constraints: Optional[Constraints] = None
    userId: str
    sessionId: str


class ConversationEntry(BaseModel):
    round: int
    agentId: str
    agentName: str
    message: str
    timestamp: datetime


class Decision(BaseModel):
    id: str
    round: int
    topic: str
    decision: str
    rationale: str
    madeBy: str
    endorsedBy: List[str]


# Knowledge Types
class KnowledgeType(str, Enum):
    FACT = "fact"
    ESTIMATE = "estimate"
    CONSTRAINT = "constraint"
    LESSON_LEARNED = "lesson_learned"
    DECISION_RATIONALE = "decision_rationale"
    PATTERN = "pattern"


class KnowledgeScope(str, Enum):
    ORGANIZATION = "organization"
    INDUSTRY = "industry"
    PROGRAM_SPECIFIC = "program_specific"


class MemoryLayer(str, Enum):
    SEMANTIC = "semantic"
    EPISODIC = "episodic"
    SYMBOLIC = "symbolic"


class VerificationStatus(str, Enum):
    VERIFIED = "verified"
    CONTESTED = "contested"
    HYPOTHESIS = "hypothesis"


class SupportingEvidence(BaseModel):
    agentId: str
    agentName: str
    round: int
    statement: str


class KnowledgeEmission(BaseModel):
    id: str
    content: str
    summary: str
    type: KnowledgeType
    scope: KnowledgeScope
    suggestedMemoryLayer: MemoryLayer
    tags: List[str]
    confidence: float
    verificationStatus: VerificationStatus
    supportingEvidence: List[SupportingEvidence]
    contradictions: Optional[List[SupportingEvidence]] = None
    source: Dict[str, Any]
    cfStatus: Optional[str] = None
    cfEntityId: Optional[str] = None


class ContestedKnowledge(BaseModel):
    id: str
    content: str
    supportingEvidence: List[SupportingEvidence]
    contradictions: List[SupportingEvidence]
    reason: str


class RejectedCandidate(BaseModel):
    content: str
    reason: str
    source: Optional[SupportingEvidence] = None


class KnowledgeStats(BaseModel):
    totalCandidates: int
    verified: int
    deduplicated: int
    emitted: int
    contested: int
    rejected: int
    flaggedForReview: int


class KnowledgeLedger(BaseModel):
    emissions: List[KnowledgeEmission]
    contested: List[ContestedKnowledge]
    rejected: List[RejectedCandidate]
    stats: KnowledgeStats


class EPMGeneratorOutput(BaseModel):
    program: Dict[str, Any]
    metadata: Dict[str, Any]
    conversationLog: List[ConversationEntry]
    decisions: List[Decision]
    knowledgeLedger: KnowledgeLedger
```

### 2.5 crews/__init__.py

```python
from .program_crew import ProgramPlanningCrew
from .agent_loader import AgentLoader
from .knowledge_curator import KnowledgeCurator
```

### 2.6 crews/agent_loader.py

```python
import os
import yaml
from pathlib import Path
from typing import List, Dict, Any, Optional
from crewai import Agent


class AgentLoader:
    """Loads agent profiles from YAML configuration files."""

    def __init__(self, config_dir: str = "config/agents"):
        self.config_dir = Path(config_dir)
        self.agent_profiles: Dict[str, Dict[str, Any]] = {}
        self._load_all_profiles()

    def _load_all_profiles(self):
        """Load all agent profiles from config directory."""
        if not self.config_dir.exists():
            print(f"[AgentLoader] Warning: Config directory {self.config_dir} does not exist")
            return

        for yaml_file in self.config_dir.glob("*.yaml"):
            try:
                with open(yaml_file, 'r') as f:
                    profile = yaml.safe_load(f)
                    if profile and 'id' in profile:
                        self.agent_profiles[profile['id']] = profile
                        print(f"[AgentLoader] Loaded: {profile['id']}")
            except Exception as e:
                print(f"[AgentLoader] Error loading {yaml_file}: {e}")

        print(f"[AgentLoader] Loaded {len(self.agent_profiles)} agent profiles")

    def get_relevant_agents(
        self,
        business_context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Select agents relevant for the given business context.
        """
        relevant = []
        business_type = business_context.get('type', '').lower()
        keywords = [kw.lower() for kw in business_context.get('keywords', [])]

        for agent_id, profile in self.agent_profiles.items():
            # Skip curator - it runs separately
            if profile.get('runs_after_convergence', False):
                continue

            # Always include if marked
            if profile.get('always_include', False):
                relevant.append(profile)
                continue

            # Check if relevant for this business type
            relevant_for = [r.lower() for r in profile.get('relevant_for', [])]
            if not relevant_for:  # Empty means relevant for all
                relevant.append(profile)
                continue

            # Check business type match
            if business_type in relevant_for:
                relevant.append(profile)
                continue

            # Check keyword match
            if any(kw in relevant_for for kw in keywords):
                relevant.append(profile)
                continue

        print(f"[AgentLoader] Selected {len(relevant)} agents for '{business_type}'")
        for p in relevant:
            print(f"  - {p['name']}")
        return relevant

    def create_crew_agent(self, profile: Dict[str, Any], llm: Any) -> Agent:
        """Create a CrewAI Agent from a profile."""
        return Agent(
            role=profile['role'],
            goal=profile['goal'],
            backstory=profile['backstory'],
            verbose=True,
            allow_delegation=False,
            llm=llm
        )

    def get_profile(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific agent profile by ID."""
        return self.agent_profiles.get(agent_id)

    def list_available_agents(self) -> List[str]:
        """List all available agent IDs."""
        return list(self.agent_profiles.keys())
```

### 2.7 crews/knowledge_curator.py

```python
import yaml
import json
from pathlib import Path
from typing import List, Dict, Any, Tuple
from datetime import datetime
from crewai import Agent, Task, Crew, Process
from langchain_openai import ChatOpenAI

from models.schemas import (
    KnowledgeEmission,
    KnowledgeType,
    KnowledgeScope,
    MemoryLayer,
    VerificationStatus,
    SupportingEvidence,
    ContestedKnowledge,
    RejectedCandidate,
    KnowledgeStats,
    KnowledgeLedger,
    ConversationEntry
)


class KnowledgeCurator:
    """
    Extracts, verifies, deduplicates, and normalizes knowledge
    from multi-agent conversations.
    """

    def __init__(self):
        self.llm = ChatOpenAI(model="gpt-4o", temperature=0.3)
        self.agent_profile = self._load_profile()
        self.agent = self._create_agent()

    def _load_profile(self) -> Dict[str, Any]:
        """Load curator profile from YAML."""
        config_path = Path("config/agents/knowledge_curator.yaml")
        if config_path.exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        return {
            'role': 'Knowledge Curator',
            'goal': 'Extract and verify knowledge from conversations',
            'backstory': 'Expert knowledge engineer focused on quality and accuracy'
        }

    def _create_agent(self) -> Agent:
        """Create the curator agent."""
        return Agent(
            role=self.agent_profile.get('role', 'Knowledge Curator'),
            goal=self.agent_profile.get('goal', 'Extract knowledge'),
            backstory=self.agent_profile.get('backstory', 'Knowledge expert'),
            verbose=True,
            allow_delegation=False,
            llm=self.llm
        )

    async def curate(
        self,
        conversation_log: List[ConversationEntry],
        program_id: str,
        program_name: str,
        existing_emissions: List[KnowledgeEmission] = None
    ) -> KnowledgeLedger:
        """Run the full curation pipeline."""
        if existing_emissions is None:
            existing_emissions = []

        print(f"[KnowledgeCurator] Starting curation for: {program_name}")

        transcript = self._format_transcript(conversation_log)
        existing_summary = self._format_existing_emissions(existing_emissions)

        extraction_result = await self._extract_and_verify(
            transcript,
            existing_summary,
            program_id,
            program_name
        )

        emissions, contested, rejected = self._parse_extraction_result(
            extraction_result,
            program_id,
            program_name
        )

        deduplicated = self._deduplicate(emissions, existing_emissions)

        stats = KnowledgeStats(
            totalCandidates=len(emissions) + len(contested) + len(rejected),
            verified=len([e for e in deduplicated if e.verificationStatus == VerificationStatus.VERIFIED]),
            deduplicated=len(emissions) - len(deduplicated),
            emitted=len(deduplicated),
            contested=len(contested),
            rejected=len(rejected),
            flaggedForReview=len(contested)
        )

        print(f"[KnowledgeCurator] Complete - Emitted: {stats.emitted}, Contested: {stats.contested}")

        return KnowledgeLedger(
            emissions=deduplicated,
            contested=contested,
            rejected=rejected,
            stats=stats
        )

    def _format_transcript(self, conversation_log: List[ConversationEntry]) -> str:
        """Format conversation log for the curator prompt."""
        lines = []
        current_round = 0

        for entry in conversation_log:
            if entry.round != current_round:
                current_round = entry.round
                lines.append(f"\n=== ROUND {current_round} ===\n")

            lines.append(f"[{entry.agentName}]:")
            lines.append(entry.message)
            lines.append("")

        return "\n".join(lines)

    def _format_existing_emissions(self, existing: List[KnowledgeEmission]) -> str:
        """Format existing emissions to avoid duplicates."""
        if not existing:
            return "No existing emissions."

        return "\n".join([
            f"- [{e.type.value}] {e.content} (confidence: {e.confidence})"
            for e in existing
        ])

    async def _extract_and_verify(
        self,
        transcript: str,
        existing_summary: str,
        program_id: str,
        program_name: str
    ) -> str:
        """Run the main extraction task."""

        prompt = f"""
You are the Knowledge Curator. Extract valuable, reusable knowledge from this program planning conversation.

## What to Extract

EXTRACT knowledge that is:
- Specific and actionable (numbers, timelines, costs)
- Confirmed by multiple agents OR based on cited evidence
- Generalizable beyond this specific program

DO NOT EXTRACT:
- Vague statements ("it takes time", "it's complex")
- Program-specific details that won't apply elsewhere
- Opinions without supporting rationale

## Verification Rules

1. If 2+ agents confirmed it → confidence = 0.85
2. If based on historical data → confidence = 0.80
3. If single agent with rationale → confidence = 0.65
4. If contradicted by another agent → mark as "contested"
5. If assumption without evidence → mark as "hypothesis", confidence = 0.50

## Output Format (JSON only)

```json
{{
  "emissions": [
    {{
      "content": "The knowledge statement",
      "summary": "One-line summary",
      "type": "fact|estimate|constraint|lesson_learned|decision_rationale|pattern",
      "scope": "organization|industry|program_specific",
      "suggestedMemoryLayer": "semantic|episodic|symbolic",
      "confidence": 0.0-1.0,
      "verificationStatus": "verified|hypothesis",
      "tags": ["tag1", "tag2"],
      "supportingEvidence": [
        {{
          "agentId": "agent_id",
          "agentName": "Agent Name",
          "round": 2,
          "statement": "What they said"
        }}
      ]
    }}
  ],
  "contested": [
    {{
      "content": "Contested statement",
      "supportingEvidence": [...],
      "contradictions": [...],
      "reason": "Why contested"
    }}
  ],
  "rejected": [
    {{
      "content": "Rejected statement",
      "reason": "Too vague / program-specific"
    }}
  ]
}}
```

## Conversation Transcript

{transcript}

## Previously Emitted (avoid duplicates)

{existing_summary}

## Your Extraction (JSON only)
"""

        task = Task(
            description=prompt,
            agent=self.agent,
            expected_output="JSON with emissions, contested, and rejected arrays"
        )

        crew = Crew(
            agents=[self.agent],
            tasks=[task],
            process=Process.sequential,
            verbose=True
        )

        result = crew.kickoff()
        return str(result)

    def _parse_extraction_result(
        self,
        result: str,
        program_id: str,
        program_name: str
    ) -> Tuple[List[KnowledgeEmission], List[ContestedKnowledge], List[RejectedCandidate]]:
        """Parse LLM output into structured objects."""

        emissions = []
        contested = []
        rejected = []

        try:
            json_start = result.find('{')
            json_end = result.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                data = json.loads(result[json_start:json_end])
            else:
                print("[KnowledgeCurator] No JSON found")
                return emissions, contested, rejected

            for i, e in enumerate(data.get('emissions', [])):
                try:
                    emissions.append(KnowledgeEmission(
                        id=f"ke_{program_id[:8]}_{i+1:03d}",
                        content=e['content'],
                        summary=e.get('summary', e['content'][:100]),
                        type=KnowledgeType(e['type']),
                        scope=KnowledgeScope(e['scope']),
                        suggestedMemoryLayer=MemoryLayer(e.get('suggestedMemoryLayer', 'semantic')),
                        tags=e.get('tags', []),
                        confidence=float(e.get('confidence', 0.65)),
                        verificationStatus=VerificationStatus(e.get('verificationStatus', 'verified')),
                        supportingEvidence=[SupportingEvidence(**ev) for ev in e.get('supportingEvidence', [])],
                        source={
                            'programId': program_id,
                            'programName': program_name,
                            'generatedAt': datetime.utcnow().isoformat(),
                            'curatorVersion': '1.0.0'
                        }
                    ))
                except Exception as ex:
                    print(f"[KnowledgeCurator] Parse error: {ex}")

            for c in data.get('contested', []):
                try:
                    contested.append(ContestedKnowledge(
                        id=f"ck_{program_id[:8]}_{len(contested)+1:03d}",
                        content=c['content'],
                        supportingEvidence=[SupportingEvidence(**ev) for ev in c.get('supportingEvidence', [])],
                        contradictions=[SupportingEvidence(**ev) for ev in c.get('contradictions', [])],
                        reason=c.get('reason', 'Contradicted')
                    ))
                except Exception as ex:
                    print(f"[KnowledgeCurator] Contested parse error: {ex}")

            for r in data.get('rejected', []):
                rejected.append(RejectedCandidate(
                    content=r['content'],
                    reason=r['reason']
                ))

        except json.JSONDecodeError as e:
            print(f"[KnowledgeCurator] JSON error: {e}")

        return emissions, contested, rejected

    def _deduplicate(
        self,
        emissions: List[KnowledgeEmission],
        existing: List[KnowledgeEmission]
    ) -> List[KnowledgeEmission]:
        """Remove duplicates."""
        if not existing:
            return emissions

        existing_contents = {e.content.lower().strip() for e in existing}

        return [
            e for e in emissions
            if e.content.lower().strip() not in existing_contents
        ]
```

### 2.8 crews/program_crew.py

```python
import yaml
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
from crewai import Agent, Task, Crew, Process
from langchain_openai import ChatOpenAI

from .agent_loader import AgentLoader
from .knowledge_curator import KnowledgeCurator
from models.schemas import (
    EPMGeneratorInput,
    EPMGeneratorOutput,
    ConversationEntry,
    Decision,
    KnowledgeLedger
)


class ProgramPlanningCrew:
    """
    Multi-agent crew for program planning.
    Runs progressive elaboration through multiple rounds.
    """

    def __init__(self):
        self.agent_loader = AgentLoader()
        self.knowledge_curator = KnowledgeCurator()
        self.rounds_config = self._load_rounds_config()
        self.llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
        self.conversation_log: List[ConversationEntry] = []
        self.decisions: List[Decision] = []
        self.shared_context: Dict[str, Any] = {}

    def _load_rounds_config(self) -> Dict[str, Any]:
        """Load round protocol configuration."""
        config_path = Path("config/rounds/standard_planning.yaml")
        if config_path.exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        return {'rounds': [{'round': 1, 'name': 'Planning'}]}

    def _log_conversation(
        self,
        round_num: int,
        agent_id: str,
        agent_name: str,
        message: str
    ):
        """Log a conversation entry."""
        self.conversation_log.append(ConversationEntry(
            round=round_num,
            agentId=agent_id,
            agentName=agent_name,
            message=message,
            timestamp=datetime.utcnow()
        ))

    async def generate_program(
        self,
        input: EPMGeneratorInput
    ) -> EPMGeneratorOutput:
        """Run the multi-agent program planning process."""

        print(f"[ProgramCrew] Starting for: {input.businessContext.name}")

        # Reset state
        self.conversation_log = []
        self.decisions = []
        self.shared_context = {
            'business': input.businessContext.model_dump(),
            'insights': input.bmcInsights,
            'constraints': input.constraints.model_dump() if input.constraints else {},
            'workstreams': {},
            'dependencies': [],
            'open_questions': [],
        }

        # Select relevant agents
        agent_profiles = self.agent_loader.get_relevant_agents(
            input.businessContext.model_dump()
        )

        # Create agents
        agents = {
            p['id']: self.agent_loader.create_crew_agent(p, self.llm)
            for p in agent_profiles
        }

        # Get coordinator
        coordinator_profile = next(
            (p for p in agent_profiles if p['id'] == 'program_coordinator'),
            agent_profiles[0]
        )

        # Run rounds
        for round_config in self.rounds_config.get('rounds', []):
            round_num = round_config['round']
            round_name = round_config['name']

            print(f"\n[ProgramCrew] === Round {round_num}: {round_name} ===")

            # Coordinator kicks off
            coordinator_msg = f"Round {round_num}: {round_name}\n"
            coordinator_msg += f"Planning program for: {input.businessContext.description}\n"
            coordinator_msg += round_config.get('coordinator_prompt', '').format(
                program_description=input.businessContext.description,
                open_questions=self.shared_context.get('open_questions', []),
                constraints=self.shared_context.get('constraints', {})
            )

            self._log_conversation(
                round_num,
                'program_coordinator',
                coordinator_profile['name'],
                coordinator_msg
            )

            # Each agent responds
            for agent_id, agent in agents.items():
                if agent_id == 'program_coordinator':
                    continue

                profile = self.agent_loader.get_profile(agent_id)
                if not profile:
                    continue

                task_description = f"""
You are the {profile['name']}.

Business Context:
- Name: {input.businessContext.name}
- Type: {input.businessContext.type}
- Description: {input.businessContext.description}

Your perspective: {profile.get('perspective', '')}
Your priorities: {', '.join(profile.get('priorities', []))}

Round {round_num} Task: {round_config.get('agent_task', 'Provide your workstream plan')}

Current state:
{self._format_context()}

Respond with your specific contributions for this round.
"""

                task = Task(
                    description=task_description,
                    agent=agent,
                    expected_output="Detailed workstream contribution"
                )

                crew = Crew(
                    agents=[agent],
                    tasks=[task],
                    process=Process.sequential,
                    verbose=True
                )

                result = crew.kickoff()

                self._log_conversation(
                    round_num,
                    agent_id,
                    profile['name'],
                    str(result)
                )

                # Update context
                if agent_id not in self.shared_context['workstreams']:
                    self.shared_context['workstreams'][agent_id] = {}
                self.shared_context['workstreams'][agent_id][f'round_{round_num}'] = str(result)

        # Knowledge curation pass
        print("\n[ProgramCrew] === Knowledge Curation ===")
        knowledge_ledger = await self.knowledge_curator.curate(
            conversation_log=self.conversation_log,
            program_id=f"prog_{input.sessionId}",
            program_name=input.businessContext.name
        )

        return self._build_output(input, knowledge_ledger)

    def _format_context(self) -> str:
        """Format shared context for prompts."""
        workstreams = self.shared_context.get('workstreams', {})
        if not workstreams:
            return "No workstreams defined yet."

        lines = []
        for ws_id, ws in workstreams.items():
            lines.append(f"\n{ws_id}:")
            for round_key, content in ws.items():
                lines.append(f"  {round_key}: {str(content)[:200]}...")
        return "\n".join(lines)

    def _build_output(
        self,
        input: EPMGeneratorInput,
        knowledge_ledger: KnowledgeLedger
    ) -> EPMGeneratorOutput:
        """Build final output."""

        workstreams = []
        for i, (ws_id, ws_data) in enumerate(self.shared_context.get('workstreams', {}).items()):
            workstreams.append({
                'id': f'T{i+1:03d}',
                'name': ws_id.replace('_', ' ').title(),
                'description': str(ws_data.get('round_1', ''))[:500],
                'owner': 'TBD',
                'deliverables': [],
                'dependencies': [],
                'startMonth': 0,
                'endMonth': 3,
                'confidence': 0.75
            })

        program = {
            'id': f"prog_{input.sessionId}",
            'workstreams': workstreams,
            'timeline': {'totalMonths': 6, 'phases': []},
            'resourcePlan': {},
            'riskRegister': {'risks': []},
            'financialPlan': {},
            'overallConfidence': 0.75
        }

        return EPMGeneratorOutput(
            program=program,
            metadata={
                'generator': 'multi-agent',
                'generatedAt': datetime.utcnow().isoformat(),
                'confidence': 0.75,
                'roundsCompleted': len(set(e.round for e in self.conversation_log)),
                'agentsParticipated': len(self.shared_context.get('workstreams', {})) + 1,
                'knowledgeEmissions': knowledge_ledger.stats.emitted
            },
            conversationLog=self.conversation_log,
            decisions=self.decisions,
            knowledgeLedger=knowledge_ledger
        )
```

### 2.9 main.py

```python
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models.schemas import EPMGeneratorInput, EPMGeneratorOutput
from crews.program_crew import ProgramPlanningCrew
from crews.agent_loader import AgentLoader

load_dotenv()

app = FastAPI(
    title="CrewAI Program Planning Service",
    description="Multi-agent EPM generation",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent_loader = AgentLoader()
program_crew = ProgramPlanningCrew()


@app.get("/health")
async def health_check():
    """Health check for TypeScript service."""
    return {
        "status": "healthy",
        "service": "crewai-program-planning",
        "agents_available": agent_loader.list_available_agents()
    }


@app.get("/agents")
async def list_agents():
    """List available agents."""
    return {
        "agents": agent_loader.list_available_agents(),
        "count": len(agent_loader.agent_profiles)
    }


@app.post("/generate-program", response_model=EPMGeneratorOutput)
async def generate_program(input: EPMGeneratorInput):
    """Generate program using multi-agent collaboration."""
    try:
        print(f"[API] Request for: {input.businessContext.name}")
        result = await program_crew.generate_program(input)
        print(f"[API] Complete - Rounds: {result.metadata.get('roundsCompleted')}")
        return result
    except Exception as e:
        print(f"[API] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
```

### 2.10 Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

### 2.11 docker-compose.yml

```yaml
version: '3.8'

services:
  crewai-service:
    build: .
    ports:
      - "8001:8001"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./config:/app/config
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## Part 3: Agent Profile YAML Files

### 3.1 config/agents/program_coordinator.yaml

```yaml
id: program_coordinator
name: Program Coordinator
role: Program Manager
goal: >
  Ensure the program plan is integrated, coherent, and achievable.
  Resolve conflicts between workstreams and enforce governance.
backstory: >
  You are a seasoned PMO director with 15 years of experience managing
  complex enterprise programs. You've seen projects fail due to poor
  integration and unclear ownership. You insist on explicit handoffs,
  realistic timelines, and documented decisions.

perspective: PMO - Integration & governance

priorities:
  - Program coherence and integration
  - Timeline feasibility
  - Stakeholder alignment
  - Clear ownership and accountability

scrutinizes:
  - Dependencies without owners
  - Unresolved conflicts between workstreams
  - Scope gaps or overlaps
  - Unrealistic timelines

typical_questions:
  - "Who owns this deliverable?"
  - "What happens if this workstream slips?"
  - "Have all impacted parties reviewed and agreed?"

success_criteria:
  - All workstreams have clear scope and ownership
  - Critical path identified and buffered
  - No orphan deliverables
  - All conflicts resolved with documented rationale

relevant_for: []
always_include: true
```

### 3.2 config/agents/tech_architecture.yaml

```yaml
id: tech_architecture
name: Strategy & Architecture Lead
role: Technical Architect
goal: >
  Design a robust, scalable system architecture that meets business needs
  while maintaining technical excellence and long-term sustainability.
backstory: >
  You are a principal architect with deep experience in distributed systems.
  You've seen projects fail because teams skipped architecture or made
  expedient choices that created debt. You push back on shortcuts.

perspective: Technical excellence and long-term sustainability

priorities:
  - System integrity and coherence
  - Scalability and performance
  - Technical standards and patterns
  - Security and compliance by design

scrutinizes:
  - Technical shortcuts that create debt
  - Missing non-functional requirements
  - Unclear integration points
  - Undocumented technical decisions

typical_questions:
  - "How does this scale to 10x load?"
  - "What are the failure modes?"
  - "Have we considered security implications?"

success_criteria:
  - Architecture documented with clear rationale
  - Technical standards defined
  - Integration points specified
  - Technical risks identified

relevant_for:
  - technology
  - software
  - platform
  - saas
  - digital

always_include: false
```

### 3.3 config/agents/platform_delivery.yaml

```yaml
id: platform_delivery
name: Platform & Delivery Lead
role: Engineering Manager
goal: >
  Create a realistic, achievable implementation plan with clear
  requirements, appropriate resources, and honest timelines.
backstory: >
  You're an engineering manager who has delivered dozens of projects.
  You push back on vague specs, impossible deadlines, and under-resourced
  work. You protect your team from scope creep.

perspective: Buildable, testable, deliverable

priorities:
  - Feasibility and clarity of requirements
  - Realistic estimates based on team capacity
  - Clear dependencies and inputs
  - Risk buffers for unknowns

scrutinizes:
  - Vague specifications
  - Impossible timelines
  - Under-resourced work
  - Missing skill requirements

typical_questions:
  - "What exactly do I need to build?"
  - "When do I get the inputs I need?"
  - "Do I have the right skills on the team?"

success_criteria:
  - Clear build plan with phases
  - Resources allocated with named skills
  - Dependencies scheduled with buffers
  - Acceptance criteria defined

relevant_for:
  - technology
  - software
  - platform
  - product

always_include: false
```

### 3.4 config/agents/go_to_market.yaml

```yaml
id: go_to_market
name: Go-to-Market Lead
role: Commercial Strategy Director
goal: >
  Ensure successful market launch with clear positioning,
  effective channels, and sales team readiness.
backstory: >
  You've launched dozens of products and know that great technology
  means nothing without great go-to-market. You push for clear messaging,
  realistic launch dates, and proper sales enablement.

perspective: Commercial success and market timing

priorities:
  - Launch readiness and timing
  - Competitive positioning
  - Clear value proposition
  - Sales and channel enablement

scrutinizes:
  - Delays that miss market windows
  - Unclear value propositions
  - Missing competitive differentiation
  - Unprepared sales teams

typical_questions:
  - "When can we announce to the market?"
  - "What can we promise customers on day one?"
  - "How do we differentiate from competitors?"

success_criteria:
  - Launch date locked and achievable
  - Messaging and positioning approved
  - Sales enablement materials ready
  - Channel partners briefed

relevant_for: []
always_include: true
```

### 3.5 config/agents/customer_success.yaml

```yaml
id: customer_success
name: Customer Success Lead
role: VP of Customer Success
goal: >
  Ensure post-launch sustainability with clear SLAs,
  supportable products, and effective onboarding.
backstory: >
  You've managed support teams that inherited unsupportable products.
  You insist on clear SLAs, proper documentation, and realistic
  commitments before launch.

perspective: Post-launch sustainability and customer satisfaction

priorities:
  - Supportability of the product
  - Clear, achievable SLAs
  - Onboarding and documentation readiness
  - Team training and readiness

scrutinizes:
  - Unsupportable complexity
  - Unclear or unrealistic SLAs
  - Missing documentation
  - Untrained support teams

typical_questions:
  - "What SLA can we actually commit to?"
  - "How do we handle failures?"
  - "Is the support team trained?"

success_criteria:
  - SLAs defined and achievable
  - Support runbooks ready
  - Team trained before launch
  - Escalation paths clear

relevant_for: []
always_include: true
```

### 3.6 config/agents/risk_compliance.yaml

```yaml
id: risk_compliance
name: Risk & Compliance Lead
role: Chief Risk Officer
goal: >
  Protect the business by identifying risks, ensuring compliance,
  and establishing contingency plans.
backstory: >
  You've seen programs fail because risks were ignored until too late.
  You insist on explicit risk registers, clear ownership, and funded
  mitigations.

perspective: Governance, protection, and contingency

priorities:
  - Risk identification and mitigation
  - Regulatory and compliance requirements
  - Contingency and fallback planning
  - Audit readiness

scrutinizes:
  - Unmitigated high-impact risks
  - Compliance gaps
  - Missing fallback plans
  - Unfunded risk responses

typical_questions:
  - "What could go wrong?"
  - "Are we compliant with regulations?"
  - "What's our fallback if this fails?"

success_criteria:
  - All high risks have owners and mitigations
  - Compliance requirements verified
  - Contingency plans documented
  - Risk budget allocated

relevant_for: []
always_include: true
```

### 3.7 config/agents/finance_resources.yaml

```yaml
id: finance_resources
name: Finance & Resources Lead
role: Program Finance Controller
goal: >
  Ensure budget discipline, resource efficiency, and clear ROI.
backstory: >
  You've seen programs blow budgets because no one tracked spend.
  You insist on funded work, clear allocations, and honest ROI projections.

perspective: Budget discipline and resource efficiency

priorities:
  - Budget adherence and tracking
  - Resource utilization and conflicts
  - ROI and business case validity
  - Cost transparency

scrutinizes:
  - Unfunded work requests
  - Resource over-allocation
  - Unclear ROI claims
  - Hidden costs

typical_questions:
  - "Is this work funded?"
  - "Who else needs this resource?"
  - "What's the expected return?"

success_criteria:
  - Budget approved and tracked
  - Resources allocated without conflicts
  - ROI projected with clear assumptions
  - No unfunded mandates

relevant_for: []
always_include: true
```

### 3.8 config/agents/knowledge_curator.yaml

```yaml
id: knowledge_curator
name: Knowledge Curator
role: Organizational Knowledge Steward
goal: >
  Extract, verify, deduplicate, and normalize valuable knowledge from
  program planning conversations. Ensure only high-quality, actionable
  knowledge enters the organizational knowledge base.
backstory: >
  You are a meticulous knowledge engineer who has built knowledge bases
  for Fortune 500 companies. You have zero tolerance for noise.
  Your job is to extract the signal and reject the rest.

perspective: Organizational learning and knowledge integrity

priorities:
  - Extract reusable knowledge from conversations
  - Ensure accuracy and verifiability
  - Maintain consistency with existing knowledge
  - Reject noise, keep signal

scrutinizes:
  - Vague or unactionable statements
  - Unverified claims without evidence
  - Contradictions between agents
  - Duplicate or redundant knowledge

typical_questions:
  - "Is this specific enough to be useful?"
  - "Did multiple agents confirm this?"
  - "Does this contradict anything we know?"

success_criteria:
  - High signal-to-noise ratio
  - All emissions have clear provenance
  - No contradictions emitted without flagging
  - Knowledge is normalized and searchable

participates_in_planning: false
runs_after_convergence: true
always_include: true
```

---

## Part 4: Round Protocol Configuration

### 4.1 config/rounds/standard_planning.yaml

```yaml
name: Standard Program Planning
description: 7-round progressive elaboration

rounds:
  - round: 1
    name: Initial Framing
    coordinator_prompt: |
      Welcome to the program planning session.
      We're planning: {program_description}

      Each workstream lead: define your initial scope and deliverables.
    agent_task: |
      Define your workstream:
      1. What is your scope?
      2. What are your key deliverables (3-5)?
      3. What do you need from other workstreams?

  - round: 2
    name: Dependency Discovery
    coordinator_prompt: |
      Round 2: Let's map dependencies.
      Review what others need from you.
    agent_task: |
      Review incoming dependencies.
      Can you fulfill them? What questions do you have?

  - round: 3
    name: Negotiation
    coordinator_prompt: |
      Round 3: Resolve conflicts.
      Open questions: {open_questions}
    agent_task: |
      Address questions and conflicts involving your workstream.
      Propose resolutions.

  - round: 4
    name: Resource & Timeline
    coordinator_prompt: |
      Round 4: Align on resources and timeline.
      Constraints: {constraints}
    agent_task: |
      Specify resource needs and timeline.
      What flexibility do you have?

  - round: 5
    name: Risk Review
    coordinator_prompt: |
      Round 5: Identify and mitigate risks.
    agent_task: |
      What could go wrong in your workstream?
      What's your mitigation plan?

  - round: 6
    name: Final Reconciliation
    coordinator_prompt: |
      Round 6: Final review. Raise any concerns now.
    agent_task: |
      Review the integrated plan.
      Any final concerns or adjustments?

  - round: 7
    name: Sign-off
    coordinator_prompt: |
      Round 7: Formal commitment.
    agent_task: |
      Commit to your workstream deliverables and timeline.

convergence_criteria:
  - all_workstreams_defined
  - all_dependencies_acknowledged
  - no_blocking_questions
  - resources_allocated
```

---

## Part 5: Running the System

### 5.1 Start the Python Service

```bash
cd crewai-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set OpenAI key
export OPENAI_API_KEY=your-key-here

# Run the service
python main.py
```

Or with Docker:

```bash
cd crewai-service
docker-compose up --build
```

### 5.2 Configure Premisia

Add to `.env`:

```bash
USE_MULTI_AGENT_EPM=true
CREWAI_SERVICE_URL=http://localhost:8001
```

### 5.3 Test the Service

```bash
# Health check
curl http://localhost:8001/health

# List agents
curl http://localhost:8001/agents

# Generate program (example)
curl -X POST http://localhost:8001/generate-program \
  -H "Content-Type: application/json" \
  -d '{
    "businessContext": {
      "name": "API Gateway Platform",
      "type": "technology",
      "scale": "enterprise",
      "description": "Build a high-availability API gateway with multi-region failover"
    },
    "bmcInsights": {},
    "userId": "test-user",
    "sessionId": "test-session"
  }'
```

---

## Part 6: Adding New Agents

To add a new agent (e.g., Supply Chain for manufacturing):

1. Create `config/agents/supply_chain.yaml`:

```yaml
id: supply_chain
name: Supply Chain Lead
role: VP of Supply Chain
goal: Ensure reliable sourcing and logistics
backstory: 20-year procurement veteran...

relevant_for:
  - manufacturing
  - retail
  - hardware

always_include: false
```

2. Restart the service - the agent is automatically loaded.

No code changes required.

---

## Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| TypeScript Router | `server/services/epm-generator/` | Switch between legacy/multi-agent |
| Python Service | `crewai-service/` | Multi-agent collaboration |
| Agent Profiles | `crewai-service/config/agents/` | YAML agent definitions |
| Round Protocols | `crewai-service/config/rounds/` | Planning round definitions |
| Knowledge Curator | `crewai-service/crews/knowledge_curator.py` | Extract knowledge from conversations |

**Key Features:**
- Environment variable switch: `USE_MULTI_AGENT_EPM=true/false`
- Agents loaded from YAML - easy to add new ones
- 7 rounds of progressive elaboration
- Knowledge extraction with verification and deduplication
- Full conversation log for transparency
