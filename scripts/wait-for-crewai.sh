#!/bin/bash
# Wait for CrewAI service to be healthy before proceeding

MAX_RETRIES=30
RETRY_INTERVAL=2
CREWAI_URL="http://localhost:8001/health"

echo "⏳ Waiting for CrewAI service to be healthy..."

for i in $(seq 1 $MAX_RETRIES); do
  response=$(curl -s "$CREWAI_URL" 2>/dev/null)
  
  if [ $? -eq 0 ]; then
    status=$(echo "$response" | grep -o '"status":"healthy"')
    agents=$(echo "$response" | grep -o '"agents":7')
    
    if [ -n "$status" ] && [ -n "$agents" ]; then
      echo "✅ CrewAI service is healthy with 7 agents!"
      echo "   Response: $response"
      exit 0
    fi
  fi
  
  echo "   Attempt $i/$MAX_RETRIES: CrewAI not ready yet, retrying in ${RETRY_INTERVAL}s..."
  sleep $RETRY_INTERVAL
done

echo "❌ CrewAI service failed to start after $MAX_RETRIES attempts"
echo "   EPM generation will fall back to legacy generator"
exit 1
