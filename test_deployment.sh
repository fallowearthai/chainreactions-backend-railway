#!/bin/bash

# =================================================================
# ChainReactions Backend - Deployment Test Script
# =================================================================
# Purpose: Comprehensive testing of microservices deployment
# =================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

print_section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo ""
}

# Detect Docker Compose command (v1 or v2)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    echo -e "${RED}[ERROR]${NC} Docker Compose is not installed. Please install Docker Compose."
    exit 1
fi

# =================================================================
# TEST SUITE 1: CONTAINER HEALTH
# =================================================================
print_section "TEST SUITE 1: Container Health Checks"

SERVICES=("entity-relations" "entity-search" "dataset-matching" "data-management" "dataset-search" "redis")

for service in "${SERVICES[@]}"; do
    print_test "Checking if $service container is running..."
    if $DOCKER_COMPOSE ps | grep "$service" | grep -q "Up"; then
        print_pass "$service container is running"
    else
        print_fail "$service container is not running"
    fi
done

# =================================================================
# TEST SUITE 2: HEALTH ENDPOINTS
# =================================================================
print_section "TEST SUITE 2: Service Health Endpoints"

declare -A SERVICE_PORTS=(
    ["entity-relations"]="3002"
    ["entity-search"]="3003"
    ["dataset-matching"]="3004"
    ["data-management"]="3005"
    ["dataset-search"]="3006"
)

for service in "${!SERVICE_PORTS[@]}"; do
    port="${SERVICE_PORTS[$service]}"
    print_test "Testing $service health endpoint (port $port)..."

    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/api/health" || echo "000")

    if [ "$response" = "200" ]; then
        # Get detailed health info
        health_data=$(curl -s "http://localhost:$port/api/health")
        print_pass "$service health endpoint returned 200 OK"
        echo "       Response: $health_data"
    else
        print_fail "$service health endpoint failed (HTTP $response)"
    fi
done

# =================================================================
# TEST SUITE 3: REDIS CONNECTIVITY
# =================================================================
print_section "TEST SUITE 3: Redis Connectivity"

print_test "Testing Redis PING command..."
if $DOCKER_COMPOSE exec -T redis redis-cli ping | grep -q "PONG"; then
    print_pass "Redis PING successful"
else
    print_fail "Redis PING failed"
fi

print_test "Checking Redis memory usage..."
memory_info=$($DOCKER_COMPOSE exec -T redis redis-cli info memory | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')
if [ -n "$memory_info" ]; then
    print_pass "Redis memory usage: $memory_info"
else
    print_fail "Could not retrieve Redis memory info"
fi

print_test "Checking Redis connected clients..."
clients=$($DOCKER_COMPOSE exec -T redis redis-cli info clients | grep "connected_clients" | cut -d: -f2 | tr -d '\r')
if [ -n "$clients" ]; then
    print_pass "Redis connected clients: $clients"
else
    print_fail "Could not retrieve Redis client info"
fi

# =================================================================
# TEST SUITE 4: SERVICE INFO ENDPOINTS
# =================================================================
print_section "TEST SUITE 4: Service Info Endpoints"

for service in "${!SERVICE_PORTS[@]}"; do
    port="${SERVICE_PORTS[$service]}"
    print_test "Testing $service info endpoint..."

    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/api" || echo "000")

    if [ "$response" = "200" ]; then
        print_pass "$service info endpoint accessible"
    else
        print_fail "$service info endpoint failed (HTTP $response)"
    fi
done

# =================================================================
# TEST SUITE 5: NETWORK CONNECTIVITY
# =================================================================
print_section "TEST SUITE 5: Inter-Service Network Connectivity"

print_test "Testing entity-relations -> redis connectivity..."
if $DOCKER_COMPOSE exec -T entity-relations ping -c 1 redis > /dev/null 2>&1; then
    print_pass "entity-relations can reach redis"
else
    print_fail "entity-relations cannot reach redis"
fi

print_test "Testing dataset-matching -> redis connectivity..."
if $DOCKER_COMPOSE exec -T dataset-matching ping -c 1 redis > /dev/null 2>&1; then
    print_pass "dataset-matching can reach redis"
else
    print_fail "dataset-matching cannot reach redis"
fi

# =================================================================
# TEST SUITE 6: RESOURCE USAGE
# =================================================================
print_section "TEST SUITE 6: Resource Usage Analysis"

print_test "Checking container memory usage..."
echo ""
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
echo ""

print_test "Checking disk usage..."
disk_usage=$(docker system df --format "{{.Type}}\t{{.TotalCount}}\t{{.Size}}\t{{.Reclaimable}}")
echo ""
echo "$disk_usage"
echo ""
print_pass "Disk usage information retrieved"

# =================================================================
# TEST SUITE 7: LOG ANALYSIS
# =================================================================
print_section "TEST SUITE 7: Log Analysis (Errors in Last 100 Lines)"

for service in "${SERVICES[@]}"; do
    print_test "Checking $service logs for errors..."
    error_count=$($DOCKER_COMPOSE logs --tail=100 "$service" 2>&1 | grep -i -c "error" || true)

    if [ "$error_count" -eq 0 ]; then
        print_pass "$service has no errors in recent logs"
    else
        print_fail "$service has $error_count error(s) in recent logs"
    fi
done

# =================================================================
# TEST SUITE 8: VOLUME VERIFICATION
# =================================================================
print_section "TEST SUITE 8: Docker Volume Verification"

print_test "Checking Redis data volume..."
if docker volume ls | grep -q "chainreactions-redis-data"; then
    print_pass "Redis data volume exists"
else
    print_fail "Redis data volume not found"
fi

print_test "Checking uploads volume..."
if docker volume ls | grep -q "chainreactions-uploads"; then
    print_pass "Uploads volume exists"
else
    print_fail "Uploads volume not found"
fi

# =================================================================
# TEST SUITE 9: API FUNCTIONAL TESTS (OPTIONAL)
# =================================================================
print_section "TEST SUITE 9: Basic API Functional Tests"

print_test "Testing Entity Relations API endpoint..."
response=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "http://localhost:3002/api/entity-relations/normal-search" \
    -H "Content-Type: application/json" \
    -d '{"query":"test","mode":"normal"}' || echo "000")

if [ "$response" = "200" ] || [ "$response" = "400" ]; then
    print_pass "Entity Relations API is responding (HTTP $response)"
else
    print_fail "Entity Relations API test failed (HTTP $response)"
fi

print_test "Testing Dataset Matching API endpoint..."
response=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "http://localhost:3004/api/dataset-matching/match" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test Company"}' || echo "000")

if [ "$response" = "200" ] || [ "$response" = "400" ]; then
    print_pass "Dataset Matching API is responding (HTTP $response)"
else
    print_fail "Dataset Matching API test failed (HTTP $response)"
fi

# =================================================================
# TEST SUMMARY
# =================================================================
print_section "TEST SUMMARY"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))

echo ""
echo "Total Tests:  $TOTAL_TESTS"
echo -e "${GREEN}Passed:       $TESTS_PASSED${NC}"
echo -e "${RED}Failed:       $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}║          ✅ ALL TESTS PASSED ✅                           ║${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}║     Deployment is healthy and ready for production!      ║${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                           ║${NC}"
    echo -e "${RED}║          ⚠️  SOME TESTS FAILED ⚠️                        ║${NC}"
    echo -e "${RED}║                                                           ║${NC}"
    echo -e "${RED}║       Please review failed tests above                    ║${NC}"
    echo -e "${RED}║                                                           ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""

    echo "Common troubleshooting steps:"
    echo "  1. Check service logs: $DOCKER_COMPOSE logs -f [service-name]"
    echo "  2. Restart failed services: $DOCKER_COMPOSE restart [service-name]"
    echo "  3. Verify environment variables: $DOCKER_COMPOSE config"
    echo "  4. Check network connectivity: docker network inspect chainreactions-network"
    echo "  5. Review resource usage: docker stats"
    echo ""
    exit 1
fi
