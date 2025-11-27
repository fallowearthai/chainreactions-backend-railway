#!/bin/bash

echo "🛑 Stopping ChainReactions Backend Services..."
echo "=============================================="

# Function to stop a service
stop_service() {
    local service_name=$1

    if [ -f "logs/${service_name}.pid" ]; then
        local pid=$(cat "logs/${service_name}.pid")
        echo "🔄 Stopping $service_name (PID: $pid)..."

        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            sleep 2

            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                echo "   Force killing $service_name..."
                kill -9 "$pid"
            fi

            echo "   ✅ $service_name stopped"
        else
            echo "   ⚠️  $service_name was not running"
        fi

        rm -f "logs/${service_name}.pid"
    else
        echo "   ⚠️  No PID file found for $service_name"
    fi
}

# Stop all services
stop_service "entity-relations"
stop_service "entity-search"
stop_service "dataset-matching"
stop_service "data-management"
stop_service "dataset-search"
stop_service "user-management"

# Kill any remaining npm/ts-node processes
echo "🧹 Cleaning up remaining processes..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "ts-node-dev" 2>/dev/null || true

echo ""
echo "✅ All services stopped!"
echo "📊 Port summary:"
echo "   3002: Entity Relations - Available"
echo "   3003: Entity Search - Available"
echo "   3004: Dataset Matching - Available"
echo "   3005: Data Management - Available"
echo "   3006: Dataset Search - Available"
echo "   3007: User Management - Available"
echo ""
echo "📄 Logs are still available in logs/ directory"