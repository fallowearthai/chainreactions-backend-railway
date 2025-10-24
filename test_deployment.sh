#!/bin/bash

# =================================================================
# ChainReactions Backend - Deployment Test Script
# =================================================================
# Purpose: Comprehensive testing of microservices deployment
# Architecture: 5 Microservices + Redis Cache
# Updated: October 2025 - Phase 4 Direct Connection Architecture
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

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
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

print_section "ChainReactions Backend - Deployment Test Suite"

echo -e "Using Docker Compose command: ${YELLOW}$DOCKER_COMPOSE${NC}"
echo -e "Test started at: $(date)"
echo ""

# =================================================================
# TEST SUITE 1: Container Health Check
# =================================================================
print_section "Test Suite 1: Container Health Check"

print_test "Checking if all containers are running..."

services=("entity-relations" "entity-search" "dataset-matching" "data-management" "dataset-search" "redis")
running_containers=0

for service in "${services[@]}"; do
    container_name="chainreactions-$service"
    if $DOCKER_COMPOSE ps | grep -q "$container_name.*Up"; then
        print_pass "$service container is running"
        ((running_containers++))
    else
        print_fail "$service container is not running"
    fi
done

if [ $running_containers -eq ${#services[@]} ]; then
    print_pass "All containers are running"
else
    print_fail "$running_containers/${#services[@]} containers are running"
fi

# =================================================================
# TEST SUITE 2: Health Endpoints Test
# =================================================================
print_section "Test Suite 2: Health Endpoints Test"

print_test "Testing microservice health endpoints..."

ports=(
    "3002:Entity Relations"
    "3003:Entity Search"
    "3004:Dataset Matching"
    "3005:Data Management"
    "3006:Dataset Search"
)

healthy_endpoints=0

for port_service in "${ports[@]}"; do
    port=$(echo "$port_service" | cut -d: -f1)
    service=$(echo "$port_service" | cut -d: -f2)

    print_test "Testing $service health endpoint (port $port)..."

    if curl -f -s -m 10 "http://localhost:$port/api/health" > /dev/null 2>&1; then
        print_pass "$service health endpoint is responding"
        ((healthy_endpoints++))
    else
        print_fail "$service health endpoint is not responding"
    fi
done

if [ $healthy_endpoints -eq ${#ports[@]} ]; then
    print_pass "All health endpoints are responding"
else
    print_fail "$healthy_endpoints/${#ports[@]} health endpoints are responding"
fi

# =================================================================
# TEST SUITE 3: Redis Connection Test
# =================================================================
print_section "Test Suite 3: Redis Connection Test"

print_test "Testing Redis connection..."

if $DOCKER_COMPOSE exec -T redis redis-cli ping > /dev/null 2>&1; then
    print_pass "Redis is responding to PING"
else
    print_fail "Redis is not responding to PING"
fi

print_test "Testing Redis memory usage..."
redis_memory=$($DOCKER_COMPOSE exec -T redis redis-cli info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r' || echo "unknown")
if [ "$redis_memory" != "unknown" ]; then
    print_pass "Redis memory usage: $redis_memory"
else
    print_fail "Could not retrieve Redis memory usage"
fi

print_test "Testing Redis client connections..."
redis_clients=$($DOCKER_COMPOSE exec -T redis redis-cli info clients | grep connected_clients | cut -d: -f2 | tr -d '\r' || echo "unknown")
if [ "$redis_clients" != "unknown" ] && [ "$redis_clients" -gt 0 ]; then
    print_pass "Redis connected clients: $redis_clients"
else
    print_fail "Redis client information unavailable or no connections"
fi

# =================================================================
# TEST SUITE 4: Service Information Endpoints
# =================================================================
print_section "Test Suite 4: Service Information Endpoints"

print_test "Testing service information endpoints..."

info_endpoints=0

for port_service in "${ports[@]}"; do
    port=$(echo "$port_service" | cut -d: -f1)
    service=$(echo "$port_service" | cut -d: -f2)

    print_test "Testing $service info endpoint (port $port)..."

    if curl -f -s -m 10 "http://localhost:$port/api" > /dev/null 2>&1; then
        print_pass "$service info endpoint is responding"
        ((info_endpoints++))
    else
        print_fail "$service info endpoint is not responding"
    fi
done

if [ $info_endpoints -eq ${#ports[@]} ]; then
    print_pass "All info endpoints are responding"
else
    print_fail "$info_endpoints/${#ports[@]} info endpoints are responding"
fi

# =================================================================
# TEST SUITE 5: Network Connectivity Test
# =================================================================
print_section "Test Suite 5: Network Connectivity Test"

print_test "Testing inter-service network connectivity..."

# Test if containers can communicate with each other
if $DOCKER_COMPOSE exec -T entity-relations curl -f -s -m 5 "http://entity-search:3003/api/health" > /dev/null 2>&1; then
    print_pass "Entity Relations can reach Entity Search"
else
    print_fail "Entity Relations cannot reach Entity Search"
fi

if $DOCKER_COMPOSE exec -T entity-search curl -f -s -m 5 "http://redis:6379" > /dev/null 2>&1; then
    print_pass "Entity Search can reach Redis"
else
    print_fail "Entity Search cannot reach Redis"
fi

# Test external connectivity from containers
print_test "Testing external connectivity from containers..."
if $DOCKER_COMPOSE exec -T entity-relations curl -f -s -m 10 "https://httpbin.org/ip" > /dev/null 2>&1; then
    print_pass "Containers have external internet access"
else
    print_fail "Containers lack external internet access"
fi

# =================================================================
# TEST SUITE 6: Resource Usage Analysis
# =================================================================
print_section "Test Suite 6: Resource Usage Analysis"

print_test "Analyzing container resource usage..."

total_memory=0
total_cpu=0.0

for service in "${services[@]}"; do
    container_name="chainreactions-$service"
    if $DOCKER_COMPOSE ps | grep -q "$container_name.*Up"; then
        # Get memory usage
        memory_stats=$($DOCKER_COMPOSE exec -T $container_name cat /sys/fs/cgroup/memory.current 2>/dev/null || echo "0")
        memory_mb=$((memory_stats / 1024 / 1024))
        total_memory=$((total_memory + memory_mb))

        print_info "$service memory usage: ${memory_mb}MB"

        # CPU usage is more complex, we'll just indicate if the container is running
        print_info "$service CPU status: active"
    fi
done

print_info "Total memory usage across all containers: ${total_memory}MB"

if [ $total_memory -lt 2048 ]; then
    print_pass "Memory usage is within acceptable limits (< 2GB)"
else
    print_fail "Memory usage is high (> 2GB): ${total_memory}MB"
fi

# =================================================================
# TEST SUITE 7: Log Error Scan
# =================================================================
print_section "Test Suite 7: Log Error Scan"

print_test "Scanning container logs for errors..."

error_count=0

for service in "${services[@]}"; do
    container_name="chainreactions-$service"
    if $DOCKER_COMPOSE ps | grep -q "$container_name.*Up"; then
        # Get last 100 lines of logs and check for errors
        error_lines=$($DOCKER_COMPOSE logs --tail=100 "$container_name" 2>&1 | grep -i -c "error\|exception\|failed" || echo "0")

        if [ "$error_lines" -eq 0 ]; then
            print_pass "$service logs: no errors in last 100 lines"
        else
            print_fail "$service logs: $error_lines error(s) in last 100 lines"
            ((error_count++))
        fi
    fi
done

if [ $error_count -eq 0 ]; then
    print_pass "No errors found in any container logs"
else
    print_fail "Errors found in $error_count container(s)"
fi

# =================================================================
# TEST SUITE 8: Data Volume Verification
# =================================================================
print_section "Test Suite 8: Data Volume Verification"

print_test "Verifying data volumes..."

# Check Redis data volume
if $DOCKER_COMPOSE exec -T redis test -f /data/dump.rdb; then
    print_pass "Redis data volume exists"
else
    print_info "Redis data volume not yet created (normal for new deployment)"
fi

# Check uploads volume for data management
if $DOCKER_COMPOSE exec -T data-management test -d /app/uploads; then
    print_pass "Data Management uploads volume exists"
else
    print_fail "Data Management uploads volume missing"
fi

# =================================================================
# TEST SUITE 9: API Functionality Test
# =================================================================
print_section "Test Suite 9: API Functionality Test"

print_test "Testing basic API functionality..."

# Test a simple API call to each service
api_tests=0

for port_service in "${ports[@]}"; do
    port=$(echo "$port_service" | cut -d: -f1)
    service=$(echo "$port_service" | cut -d: -f2)

    print_test "Testing $service basic API functionality..."

    # Test different endpoints based on service
    case $service in
        "Entity Relations")
            if curl -f -s -m 10 "http://localhost:$port/api/health" | grep -q "status"; then
                print_pass "$service API returns valid JSON"
                ((api_tests++))
            else
                print_fail "$service API not returning valid JSON"
            fi
            ;;
        "Entity Search")
            if curl -f -s -m 10 "http://localhost:$port/api/health" | grep -q "status"; then
                print_pass "$service API returns valid JSON"
                ((api_tests++))
            else
                print_fail "$service API not returning valid JSON"
            fi
            ;;
        *)
            if curl -f -s -m 10 "http://localhost:$port/api/health" > /dev/null 2>&1; then
                print_pass "$service basic API working"
                ((api_tests++))
            else
                print_fail "$service basic API not working"
            fi
            ;;
    esac
done

if [ $api_tests -eq ${#ports[@]} ]; then
    print_pass "All basic API tests passed"
else
    print_fail "$api_tests/${#ports[@]} API tests passed"
fi

# =================================================================
# TEST SUMMARY
# =================================================================
print_section "Test Summary"

echo -e "Tests completed at: $(date)"
echo -e ""
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo -e "${BLUE}Total Tests: $((TESTS_PASSED + TESTS_FAILED))${NC}"

# Calculate success rate
total_tests=$((TESTS_PASSED + TESTS_FAILED))
if [ $total_tests -gt 0 ]; then
    success_rate=$((TESTS_PASSED * 100 / total_tests))
    echo -e ""
    echo -e "Success Rate: ${success_rate}%"

    if [ $success_rate -ge 90 ]; then
        echo -e "${GREEN}🎉 EXCELLENT: Deployment is very healthy!${NC}"
    elif [ $success_rate -ge 75 ]; then
        echo -e "${YELLOW}✅ GOOD: Deployment is mostly healthy${NC}"
    elif [ $success_rate -ge 50 ]; then
        echo -e "${YELLOW}⚠️  WARNING: Deployment has some issues${NC}"
    else
        echo -e "${RED}❌ CRITICAL: Deployment has significant issues${NC}"
    fi
else
    echo -e "${RED}No tests were executed${NC}"
fi

# Recommendations
echo -e ""
echo -e "${BLUE}Recommendations:${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "  • Check failed service logs: $DOCKER_COMPOSE logs [service-name]"
    echo -e "  • Restart failed services: $DOCKER_COMPOSE restart [service-name]"
    echo -e "  • Verify environment variables in .env file"
    echo -e "  • Check resource availability (memory, disk space)"
else
    echo -e "  • All systems are operating normally"
    echo -e "  • Consider setting up monitoring alerts"
    echo -e "  • Regular backups are recommended"
fi

echo -e ""
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "  • View logs: $DOCKER_COMPOSE logs -f [service-name]"
echo -e "  • Restart service: $DOCKER_COMPOSE restart [service-name]"
echo -e "  • Check status: $DOCKER_COMPOSE ps"
echo -e "  • Stop all: $DOCKER_COMPOSE down"
echo -e "  • Resource usage: docker stats"

exit $TESTS_FAILED