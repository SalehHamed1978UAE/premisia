# CRITICAL BUG FIX: CrewAI Multi-Agent Service Hangs at 5%

**Date:** January 21, 2026
**Priority:** CRITICAL - Multi-agent EPM generation completely broken
**Reported By:** Claude (Code Audit)

---

## Summary

The multi-agent CrewAI EPM generator hangs indefinitely at approximately 5% progress. The Python service starts correctly (health check passes with 7 agents), but execution freezes during the first `crew.kickoff()` call when the LLM is invoked.

---

## Symptoms

1. Progress stuck at ~5% (service started, health check passed, but no further progress)
2. Console shows:
   ```
   [CrewAI] Starting program generation for session ...
   [ProgramCrew] Starting generation for: [business name]
   [ProgramCrew] Created 7 agents
   [ProgramCrew] Executing round 1 with 7 tasks...
   ```
   Then nothing. No further output. Hangs indefinitely.

3. TypeScript client eventually times out after 10 minutes
4. No error messages - silent hang

---

## Root Cause Analysis

**Primary Issue: Model ID Format**

**File:** `services/agent-planner/crews/program_crew.py`
**Line:** 68-72

```python
# CURRENT CODE - LIKELY BUG:
self.llm = LLM(
    model="anthropic/claude-sonnet-4-20250514",  # Model ID may be incorrect
    api_key=api_key,
    temperature=0.7
)
```

**Problems Identified:**

1. **Model ID Verification Needed**: The model `claude-sonnet-4-20250514` may not be a valid Anthropic model ID. Need to verify against Anthropic's actual model list.

2. **CrewAI Version Mismatch**:
   - `requirements.txt` specifies `crewai>=0.1.0` (extremely loose)
   - Code uses newer `from crewai.llm import LLM` pattern
   - Version mismatch could cause silent failures

3. **No LLM Call Timeout**: CrewAI doesn't configure a timeout for LLM calls by default. If the model is invalid or API key is wrong, LiteLLM (which CrewAI uses internally) may hang waiting for a response.

4. **Environment Variable Propagation**: The ANTHROPIC_API_KEY may not be reaching the Python service properly when spawned by the TypeScript service manager.

---

## The Fix

### Step 1: Verify and Fix Model ID

Check Anthropic's current model list. The correct format should be one of:
- `claude-3-5-sonnet-20241022`
- `claude-3-opus-20240229`
- Or the latest available model

**Replace lines 68-72 in `services/agent-planner/crews/program_crew.py`:**

```python
# FIXED CODE - Use correct model ID with timeout:
from litellm import completion

def _initialize_llm(self):
    """Initialize the LLM for all agents."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable not set")

    # Log to verify API key is present (first/last 4 chars only for security)
    print(f"[ProgramCrew] API key found: {api_key[:4]}...{api_key[-4:]}")

    # Use a known valid model ID
    model_id = os.environ.get("CREWAI_MODEL", "anthropic/claude-3-5-sonnet-20241022")
    print(f"[ProgramCrew] Using model: {model_id}")

    self.llm = LLM(
        model=model_id,
        api_key=api_key,
        temperature=0.7,
        timeout=120,  # 2-minute timeout per LLM call
        max_retries=2
    )
```

### Step 2: Pin CrewAI Version

**Replace in `services/agent-planner/requirements.txt`:**

```
fastapi>=0.104.0
uvicorn>=0.24.0
crewai==0.80.0  # Pin to known working version
pydantic>=2.5.0
python-dotenv>=1.0.0
anthropic>=0.40.0  # Update to latest
pyyaml>=6.0.1
litellm>=1.50.0  # Explicit litellm for timeout support
```

### Step 3: Add Debug Logging and Timeout

**Add before `crew.kickoff()` in `generate_sync()` (line 700):**

```python
# Add timeout and verbose logging
print(f"[ProgramCrew] About to execute crew.kickoff() for round {round_num}")
print(f"[ProgramCrew] Tasks: {[t.description[:100] for t in round_tasks]}")
print(f"[ProgramCrew] LLM model: {self.llm.model if hasattr(self.llm, 'model') else 'unknown'}")

try:
    import signal

    def timeout_handler(signum, frame):
        raise TimeoutError(f"Round {round_num} timed out after 5 minutes")

    # Set 5-minute timeout per round
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(300)  # 5 minutes

    result = crew.kickoff()

    signal.alarm(0)  # Cancel timeout
    print(f"[ProgramCrew] Round {round_num} kickoff complete")

except TimeoutError as e:
    print(f"[ProgramCrew ERROR] {str(e)}")
    raise
```

### Step 4: Verify Environment Variable Propagation

**In `server/services/crewai-service-manager.ts`, ensure API key is passed (line 166-169):**

```typescript
const proc = spawn('python3', [
  '-m', 'uvicorn',
  'main:app',
  '--host', '0.0.0.0',
  '--port', String(CREWAI_PORT)
], {
  cwd: servicePath,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    // Explicitly pass required env vars
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    CREWAI_MODEL: process.env.CREWAI_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
    PYTHONUNBUFFERED: '1',  // Ensure immediate output
  }
});
```

---

## Verification Steps

After applying the fix:

1. **Check startup logs:**
   ```
   [ProgramCrew] API key found: sk-a...xxxx
   [ProgramCrew] Using model: anthropic/claude-3-5-sonnet-20241022
   ```

2. **Check round execution:**
   ```
   [ProgramCrew] About to execute crew.kickoff() for round 1
   [ProgramCrew] Tasks: [...]
   [ProgramCrew] Round 1 kickoff complete
   ```

3. **Verify completion:**
   - All 7 rounds should complete
   - Total generation time: 3-8 minutes (not hanging)
   - Output should have business-specific workstreams (not generic fallback)

---

## Quick Diagnostic Commands

Run these on the Replit server to diagnose:

```bash
# Check if API key is set
echo $ANTHROPIC_API_KEY | head -c 10

# Check if model is reachable (test LiteLLM directly)
python3 -c "
import os
from litellm import completion
response = completion(
    model='anthropic/claude-3-5-sonnet-20241022',
    messages=[{'role': 'user', 'content': 'Say hello'}],
    api_key=os.environ.get('ANTHROPIC_API_KEY'),
    timeout=30
)
print('SUCCESS:', response.choices[0].message.content)
"

# Check CrewAI version
pip show crewai

# Check Python service logs
curl http://localhost:8001/health
```

---

## Why This Was Missed

1. **Health check doesn't test LLM**: `/health` returns `{"status":"healthy","agents":7}` without making any LLM calls
2. **Silent failures in LiteLLM**: Invalid model IDs can cause LiteLLM to hang waiting for a response instead of throwing an error
3. **No timeouts configured**: Neither CrewAI nor LiteLLM had explicit timeouts set
4. **Loose version constraint**: `crewai>=0.1.0` allows any version, potentially incompatible ones

---

## Additional Recommendation

Add a startup LLM validation test in `main.py`:

```python
@app.on_event("startup")
async def validate_llm():
    """Test LLM connectivity on startup."""
    try:
        from litellm import completion
        import os

        print("[Startup] Testing LLM connectivity...")
        response = completion(
            model=os.environ.get("CREWAI_MODEL", "anthropic/claude-3-5-sonnet-20241022"),
            messages=[{"role": "user", "content": "test"}],
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
            timeout=10,
            max_tokens=5
        )
        print(f"[Startup] LLM test successful: {response.choices[0].message.content}")
    except Exception as e:
        print(f"[Startup] WARNING: LLM test failed: {e}")
        print("[Startup] Multi-agent generation may not work!")
```

This ensures the service logs an immediate warning if the LLM is misconfigured.

---

## Summary of Changes

| File | Change |
|------|--------|
| `services/agent-planner/crews/program_crew.py` | Fix model ID, add timeout, add debug logging |
| `services/agent-planner/requirements.txt` | Pin crewai version, add litellm explicitly |
| `services/agent-planner/main.py` | Add LLM validation on startup |
| `server/services/crewai-service-manager.ts` | Explicit env var propagation |

---

## Test Case

After fix, generate EPM for "open napoli pizzeria abu dhabi" and verify:

- [ ] Service doesn't hang - progress continues past 5%
- [ ] All 7 rounds complete successfully
- [ ] Console shows round-by-round progress
- [ ] Generation completes in 3-8 minutes (not 10+ minute timeout)
- [ ] Workstreams are pizzeria-specific
- [ ] No fallback to legacy generator
