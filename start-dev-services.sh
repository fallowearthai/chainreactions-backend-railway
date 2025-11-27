#!/bin/bash

echo "🚀 Starting ChainReactions Backend Services..."
echo "=============================================="

# Function to start a service
start_service() {
    local service_name=$1
    local port=$2

    echo "📡 Starting $service_name (Port: $port)..."
    cd "services/$service_name"
    npm run dev > "../../logs/${service_name}.log" 2>&1 &
    local pid=$!
    echo "   PID: $pid"
    echo "   Logs: logs/${service_name}.log"
    echo "   Health: http://localhost:$port/api/health"
    echo ""

    # Save PID for cleanup
    echo $pid > "../../logs/${service_name}.pid"
    cd ../..
}

# Create logs directory
mkdir -p logs

# Start all services
start_service "entity-relations" 3002
start_service "entity-search" 3003
start_service "dataset-matching" 3004
start_service "data-management" 3005
start_service "dataset-search" 3006
start_service "user-management" 3007

echo "⏳ Waiting for services to start..."
sleep 5

echo "🔍 Checking service health..."
echo "================================"

# Health check function
check_health() {
    local service_name=$1
    local port=$2

    if curl -s "http://localhost:$port/api/health" > /dev/null; then
        echo "✅ $service_name (Port: $port) - HEALTHY"
    else
        echo "❌ $service_name (Port: $port) - UNREACHABLE"
    fi
}

check_health "Entity Relations" 3002
check_health "Entity Search" 3003
check_health "Dataset Matching" 3004
check_health "Data Management" 3005
check_health "Dataset Search" 3006
check_health "User Management" 3007

echo ""
echo "🎉 All services started!"
echo "================================"
echo "📊 Service Summary:"
echo "   Entity Relations:  http://localhost:3002/api/health"
echo "   Entity Search:     http://localhost:3003/api/health"
echo "   Dataset Matching:  http://localhost:3004/api/health"
echo "   Data Management:   http://localhost:3005/api/health"
echo "   Dataset Search:    http://localhost:3006/api/health"
echo "   User Management:   http://localhost:3007/api/health"
echo ""
echo "🛑 To stop all services: ./stop-dev-services.sh"
echo "📄 View logs: tail -f logs/[service-name].log"