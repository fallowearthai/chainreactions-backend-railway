#!/bin/bash

# =================================================================
# Service Status Monitoring Script
# =================================================================
# Purpose: Real-time monitoring of all microservices with color-coded output

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Service configuration
SERVICES=(
    "entity-relations:3002:Entity Relations Service"
    "entity-search:3003:Entity Search Service"
    "dataset-matching:3004:Dataset Matching Service"
    "data-management:3005:Data Management Service"
    "dataset-search:3006:Dataset Search Service"
    "redis:6379:Redis Cache"
)

# Health check endpoints
HEALTH_ENDPOINTS=(
    "entity-relations:http://localhost:3002/api/health"
    "entity-search:http://localhost:3003/api/health"
    "dataset-matching:http://localhost:3004/api/health"
    "data-management:http://localhost:3005/api/health"
    "dataset-search:http://localhost:3006/api/health"
)

print_header() {
    echo -e "${BLUE}🔍 ChainReactions Service Monitor${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo -e ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_service_health() {
    local service_name=$1
    local port=$2
    local url=$3

    # Use wget with timeout for health check
    response=$(wget --no-verbose --tries=1 --timeout=10 --spider "$url" -O- "http://localhost:$port/api/health" 2>&1)

    if [ $? -eq 0 ] && echo "$response" | grep -q "200 OK"; then
        print_success "$service_name ($port): Healthy"
        return 0
    else
        print_error "$service_name ($port): Unhealthy"
        return 1
    fi
}

get_container_id() {
    local service=$1
    docker-compose ps -q "$service" | awk 'NR==1 {print $2}'
}

get_service_logs() {
    local service=$1
    local lines=${2:-20}  # Default to last 20 lines

    echo -e "${YELLOW}📋 Recent logs for $service:${NC}"
    docker-compose logs --tail="$lines" "$service" 2>&1 | while IFS= read -r line; do
        echo -e "  $line"
        ((lines--))
    done
}

show_service_status() {
    echo ""
    echo -e "${BLUE}Service Status Overview:${NC}"
    echo -e "${BLUE}============================${NC}"

    for service_info in "${SERVICES[@]}"; do
        service_name=$(echo "$service_info" | cut -d: -f1)
        port=$(echo "$service_info" | cut -d: -f2)
        description=$(echo "$service_info" | cut -d: -f3-)

        # Simple health check based on port
        if lsof -i :$port >/dev/null 2>&1; then
            status="${GREEN}Running${NC}"
        else
            status="${RED}Stopped${NC}"
        fi

        echo -e "${status} ${NC}• $service_name ($port)"
    done

    echo -e "${BLUE}============================${NC}"
}

show_redis_status() {
    redis_id=$(get_container_id "redis")
    if [ -n "$redis_id" ]; then
        status="${RED}Not Running${NC}"
    else
        if docker-compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
            status="${GREEN}Healthy${NC}"
        else
            status="${RED}Unhealthy${NC}"
        fi
    fi

    echo -e "${status} ${NC}• Redis Cache (6379)"
}

show_system_info() {
    echo ""
    echo -e "${BLUE}System Information:${NC}"
    echo -e "${BLUE}================${NC}"

    # Show resource usage
    echo -e "${YELLOW}💾 Resource Usage:${NC}"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}}" 2>/dev/null | head -10

    echo ""
    echo -e "${BLUE}Network Information:${NC}"
    echo -e "${BLUE}================${NC}"
    docker network ls chainreactions-network --format "table {{.Name}}\t{{.Driver}}\t{{.Scope}}" 2>/dev/null
}

# Main monitoring functions
monitor_all() {
    clear
    show_service_status
    show_redis_status
    show_system_info
}

quick_check() {
    clear
    echo -e "${BLUE}🔍 Quick Health Check${NC}"
    echo -e "${BLUE}================${NC}"

    local all_running=true

    for service_info in "${SERVICES[@]}"; do
        service_name=$(echo "$service_info" | cut -d: -f1)
        port=$(echo "$service_info" | cut -d: -f2)

        # Simple port check
        if lsof -i :$port >/dev/null 2>&1; then
            echo -e "  ${GREEN}✅ $service_name ($port): Running${NC}"
        else
            echo -e "  ${RED}❌ $service_name ($port): Stopped${NC}"
            all_running=false
        fi
    done

    if [ "$all_running" = true ]; then
        echo -e "${GREEN}🎉 All Services Running!${NC}"
    else
        echo -e "${RED}⚠️  Some Services Need Attention!${NC}"
    fi

    echo -e "${BLUE}================${NC}"
}

# Interactive menu
case "${1:-monitor}" in
    "monitor"|""|"m")
        monitor_all
        ;;
    "check"|""|"c")
        quick_check
        ;;
    "entity-relations"|"e")
        get_service_logs "entity-relations" 50
        ;;
    "entity-search"|"s")
        get_service_logs "entity-search" 50
        ;;
    "dataset-matching"|"d")
        get_service_logs "dataset-matching" 50
        ;;
    "data-management"|"a")
        get_service_logs "data-management" 50
        ;;
    "dataset-search"|"t")
        get_service_logs "dataset-search" 50
        ;;
    "redis"|"r")
        show_redis_status
        ;;
    "system"|"y")
        show_system_info
        ;;
    "help"|"h"|"?")
        echo ""
        echo -e "${BLUE}Usage:${NC}"
        echo -e "  monitor       - Monitor all services continuously"
        echo -e "  check         - Quick health check of all services"
        echo -e "  [service]   - Show detailed logs for specific service"
        echo -e "    Available services: entity-relations, entity-search, dataset-matching, data-management, dataset-search, redis, system"
        echo -e "  ctrl+c       - Exit monitoring"
        ;;
    *)
        echo -e "${RED}Unknown option: $1${NC}"
        echo -e "Available: monitor, check, [service], redis, system, help"
        exit 1
        ;;
esac

# Command line interface
if [ $# -eq 0 ]; then
    monitor_all
else
    case "$1" in
        "monitor"|"m")
            monitor_all
            ;;
        "check"|"c")
            quick_check
            ;;
        "help"|"h"|"?")
            echo ""
            echo -e "${BLUE}Usage:${NC}"
            echo -e "  monitor       - Monitor all services continuously"
            echo -e "  check         - Quick health check of all services"
            echo -e "  [service]   - Show detailed logs for specific service"
            echo -e "    Available services: entity-relations, entity-search, dataset-matching, data-management, dataset-search, redis, system"
            echo -e "  ctrl+c       - Exit monitoring"
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo -e "Available: monitor, check, [service], redis, system, help"
            exit 1
            ;;
    esac
fi