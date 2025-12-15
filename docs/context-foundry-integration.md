# Context Foundry Integration

**Last Updated:** December 15, 2025  
**Status:** Live and Verified

## Purpose

Context Foundry provides **grounded organizational context** for Premisia's AI analysis. Instead of AI making assumptions about an organization's structure, CF supplies verified facts from a knowledge graph, ensuring strategic recommendations are anchored in reality.

## How It Works

1. User enters strategic input (e.g., "Reduce API Gateway downtime by 50%")
2. Premisia sends the **raw text** to Context Foundry's V1 API
3. CF internally extracts entities and resolves them against its knowledge graph
4. CF returns grounded facts (dependencies, relationships, metrics)
5. Premisia injects these facts into AI prompts, constraining responses to verified data

## Configuration

### Environment
- **Secret:** `CONTEXT_FOUNDRY_API_KEY` (stored in Replit Secrets)
- **Base URL:** `https://1ccacfa5-76d6-4bc8-b11c-e8a59e39c1f1-00-i16a1ywb4a3m.riker.replit.dev`

### Authentication
- Header: `X-CF-API-Key: <api_key>`
- NOT `Authorization: Bearer` (this was changed from the initial implementation)

### API Endpoint
- **Path:** `/api/v1/query`
- **Method:** POST
- **Payload:**
  ```json
  {
    "query": "<raw user text>",
    "analysis_type": "root_cause",
    "context": {
      "app_id": "premisia",
      "user_id": "<user>",
      "session_id": "<session>"
    }
  }
  ```

## Key Files

| File | Purpose |
|------|---------|
| `server/services/context-foundry-client.ts` | Main CF client with query, verify, and formatting functions |
| `server/services/strategy-analyzer.ts` | Integrates CF into Five Whys and Porter's analysis |

## Response Format

CF returns a `CFV1Response`:
```typescript
{
  status: 'RESOLVED' | 'AMBIGUOUS' | 'NO_MATCHES',
  entity_resolution: {
    selected: { entity_id, name, confidence }
  },
  answer: {
    grounded_facts: [...],  // Array of relationship objects
    gaps: [...]             // Areas with limited data
  },
  confidence: 0.0 - 1.0
}
```

## Verified Test Results

**Input:** "Reduce API Gateway downtime by 50%"

**Response:**
- Status: `RESOLVED`
- Entity: `API Gateway` (confidence: 1.0)
- 15 grounded relationships returned:
  - Dependencies: Auth Service, Rate Limiter, Load Balancer
  - Downstream: Order Service, User Service, Product Service, Cart Service, Search Service
  - Dependent Gateways: GraphQL Gateway, Mobile Gateway, Partner Gateway
  - Monitoring: Prometheus, Synthetic Monitor, Service Mesh

## Integration Points

### StrategyAnalyzer
The `analyzeWithGrounding()` method in `strategy-analyzer.ts` queries CF before running AI analysis, injecting verified context into prompts.

### Status Endpoint
`GET /api/strategic-consultant/context-foundry/status` returns CF availability and configuration status.

## Troubleshooting

1. **401 Unauthorized:** Check `CONTEXT_FOUNDRY_API_KEY` secret is set correctly
2. **Empty responses:** CF may not have data for the queried entity - this is normal, analysis continues without grounding
3. **Timeouts:** Default timeout is 30 seconds; CF may be slow for complex queries

## Future Enhancements

- [ ] Cache CF responses for repeated queries
- [ ] Display grounding confidence in UI
- [ ] Show "grounded by CF" badge on analysis results
- [ ] Expand to BMC and PESTLE analysis types
