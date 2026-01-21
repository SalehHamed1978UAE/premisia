#!/bin/bash
# Start all Premisia services: CrewAI Python service + Node.js application

echo "🚀 Starting Premisia Services..."
echo "================================"

# Function to check if a port is in use
check_port() {
  nc -z localhost $1 2>/dev/null
  return $?
}

# Function to wait for service health
wait_for_crewai() {
  local MAX_RETRIES=30
  local RETRY_INTERVAL=2
  local CREWAI_URL="http://localhost:8001/health"

  echo "⏳ Waiting for CrewAI service to be healthy..."

  for i in $(seq 1 $MAX_RETRIES); do
    response=$(curl -s "$CREWAI_URL" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
      status=$(echo "$response" | grep -o '"status":"healthy"')
      agents=$(echo "$response" | grep -o '"agents":7')
      
      if [ -n "$status" ] && [ -n "$agents" ]; then
        echo "✅ CrewAI service is healthy with 7 agents!"
        return 0
      fi
    fi
    
    echo "   Attempt $i/$MAX_RETRIES: CrewAI not ready yet..."
    sleep $RETRY_INTERVAL
  done

  echo "⚠️  CrewAI service not available - EPM will use legacy generator"
  return 1
}

# Start CrewAI Python service in background
echo ""
echo "📦 Starting CrewAI Python service on port 8001..."
cd services/agent-planner

# Install dependencies if needed
pip install -q -r requirements.txt 2>/dev/null

# Start uvicorn in background
python3 -m uvicorn main:app --host 0.0.0.0 --port 8001 &
CREWAI_PID=$!
echo "   CrewAI PID: $CREWAI_PID"

cd ../..

# Wait for CrewAI to be healthy
wait_for_crewai

echo ""
echo "🌐 Starting Node.js application on port 5000..."
echo "================================"

# Start the main Node.js application (foreground)
npm run dev

# If Node exits, also stop CrewAI
echo "Stopping CrewAI service..."
kill $CREWAI_PID 2>/dev/null
