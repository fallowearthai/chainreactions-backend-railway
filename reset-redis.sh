#!/bin/bash

# =================================================================
# Redis Reset Script - Fix Redis Configuration Issues
# =================================================================

set -e

echo "🔄 Starting Redis reset process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
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

# Step 1: Stop all services
print_step "Stopping all services"
docker compose down || print_warning "Services were already stopped"

# Step 2: Remove Redis volume to clear corrupted data
print_step "Removing Redis data volume"
if docker volume ls | grep -q "chainreactions-redis-data"; then
    docker volume rm chainreactions-redis-data
    print_success "Redis data volume removed"
else
    print_warning "Redis data volume not found"
fi

# Step 3: Remove Redis container to ensure clean state
print_step "Removing Redis container"
if docker ps -a | grep -q "chainreactions-redis"; then
    docker rm chainreactions-redis || print_warning "Redis container already removed"
    print_success "Redis container removed"
else
    print_warning "Redis container not found"
fi

# Step 4: Start only Redis first
print_step "Starting Redis service with new configuration"
docker compose up -d redis

# Step 5: Wait for Redis to be healthy
print_step "Waiting for Redis to start..."
sleep 10

# Check Redis health
for i in {1..30}; do
    if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        print_success "Redis is responding to ping"
        break
    else
        echo "Attempt $i/30: Redis not ready yet..."
        sleep 2
    fi

    if [ $i -eq 30 ]; then
        print_error "Redis failed to start after 60 seconds"
        echo "Redis logs:"
        docker compose logs redis
        exit 1
    fi
done

# Step 6: Verify Redis configuration
print_step "Verifying Redis configuration"
echo "Redis info:"
docker compose exec -T redis redis-cli info server | head -10

echo ""
echo "Memory configuration:"
docker compose exec -T redis redis-cli config get "*memory*"

echo ""
print_success "Redis reset completed successfully!"

# Step 7: Start all other services
print_step "Starting all other services"
docker compose up -d

print_success "All services started!"
echo ""
echo "Check service status with: docker compose ps"
echo "Check logs with: docker compose logs -f"