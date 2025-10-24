#!/bin/bash

# =================================================================
# ChainReactions Backend - Optimized Deployment Script
# =================================================================
# Purpose: Fast, reliable deployment with minimal resource usage
# Version: 2.0 - Optimized for Production
# =================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
print_step() {
    echo -e "\n${BLUE}===================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "\n${BLUE}$2${NC}"
    echo -e "\n"
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

print_header() {
    echo -e "${BLUE}🚀 ChainReactions Backend Deployment${NC}"
    echo -e "${BLUE}Version: 2.0 - Optimized Production${NC}"
}

# =================================================================
# STAGE 1: PRE-DEPLOYMENT CHECKS
# =================================================================
print_step "STAGE 1: Pre-Deployment Checks"

# Check if Docker is running
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi
print_success "Docker is installed"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi
print_success "Docker Compose is available"

# Check if .env file exists
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating from template..."
    if [ -f .env.docker.example ]; then
        cp .env.docker.example .env
        print_success ".env file created from .env.docker.example"
    else
        print_error ".env.docker.example file not found. Please create .env file manually."
        exit 1
    fi
else
    print_success ".env file exists"
fi

# Check critical environment variables
source .env
REQUIRED_VARS=("GEMINI_API_KEY" "BRIGHT_DATA_API_KEY" "BRIGHT_DATA_SERP_ZONE" "SUPABASE_URL" "SUPABASE_ANON_KEY" "SUPABASE_SERVICE_ROLE_KEY")

MISSING_VARS=()
for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ] || [ "${VAR}" = "your_${VAR}_here" ]; then
        MISSING_VARS+=("$VAR")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    print_error "Missing required environment variables: ${MISSING_VARS[*]}"
    print_error "Please update .env file with the required API keys."
    exit 1
fi

print_success "All required environment variables are configured"

# Clean up any existing containers
print_step "STAGE 2: Cleanup Existing Deployment"

echo "🧹 Stopping any existing containers..."
docker-compose -f docker-compose.yml down --remove-orphans 2>/dev/null || true
sleep 3

# Clean up unused Docker images
print_step "STAGE 3: Clean Up Docker Images"

echo "🧹 Removing unused Docker images..."
docker image prune -f 2>/dev/null || true
print_success "Docker cleanup completed"

# =================================================================
# STAGE 4: BUILD AND DEPLOY
# =================================================================
print_step "STAGE 4: Build and Deploy Services"

echo "🏗 Building and starting optimized services..."

# Use the optimized docker-compose file
COMPOSE_FILE="docker-compose.optimized.yml"

# Pull latest base images
echo "📦 Pulling latest base images..."
docker-compose -f $COMPOSE_FILE pull --quiet
print_success "Base images updated"

# Build all services
echo "🔨 Building services (this may take 3-5 minutes)..."
start_time=$(date +%s)

# Build with progress indicator
docker-compose -f $COMPOSE_FILE build --parallel 2>&1 | while IFS= read -r line; do
    echo -e "\r$line"
    if [[ $line =~ ^Building.*([0-9]+)% ]]; then
        progress=${BASH_REMATCH[1]}
        echo -e "\r🏗 Build progress: $progress%..."
    fi
done

end_time=$(date +%s)
duration=$((end_time - start_time))
print_success "Build completed in ${duration} seconds"

# Start services with dependency management
echo "🚀 Starting services with optimized configuration..."

# Start Redis first (critical dependency)
echo "📊 Starting Redis cache..."
docker-compose -f $COMPOSE_FILE up -d redis 2>/dev/null || true
print_success "Redis started"

# Wait for Redis to be healthy
echo "⏳ Waiting for Redis to be healthy..."
REDIS_HEALTHY=false
for i in {1..30}; do
    if docker-compose -f $COMPOSE_FILE exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        REDIS_HEALTHY=true
        print_success "Redis is healthy after $i seconds"
        break
    fi
    sleep 1
done

if [ "$REDIS_HEALTHY" = false ]; then
    print_error "Redis failed to start within 30 seconds"
    print_error "Check Redis logs: docker-compose logs redis"
    exit 1
fi

# Start core services in parallel with optimized ordering
echo "🔄 Starting core microservices..."
SERVICES=("entity-relations" "entity-search" "dataset-matching")

for SERVICE in "${SERVICES[@]}"; do
    echo "🚀 Starting $SERVICE service..."
    docker-compose -f $COMPOSE_FILE up -d $SERVICE 2>/dev/null &

    # Add small delay between services to prevent resource spikes
    sleep 2
done

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service health
echo "🔍 Checking service health..."
ALL_HEALTHY=true
for SERVICE in "${SERVICES[@]}"; do
    if docker-compose -f $COMPOSE_FILE exec -T $SERVICE wget --no-verbose --tries=1 --spider "http://localhost:${SERVICE: -2:3002:3003:3004:3005:3006}/api/health" -O- "|| exit 1" 2>/dev/null | grep -q "connected"; then
        echo -e "${GREEN}✅ $SERVICE: Healthy${NC}"
    else
        echo -e "${RED}❌ $SERVICE: Failed${NC}"
        ALL_HEALTHY=false
    fi
done

if [ "$ALL_HEALTHY" = false ]; then
    print_error "Some services failed health checks"
    echo "📋 Service Status:"
    for SERVICE in "${SERVICES[@]}"; do
        STATUS=$(docker-compose -f $COMPOSE_FILE exec -T $SERVICE wget --no-verbose --tries=1 --spider "http://localhost:${SERVICE: -2:3002:3003:3004:3005:3006}/api/health" -O- "|| exit 1" 2>/dev/null | grep -q "connected" && echo "Healthy" || echo "Failed")
        echo -e "  $SERVICE: $STATUS"
    done
    echo -e "\n📋 Check logs with: docker-compose logs [service-name]"
    exit 1
fi

# =================================================================
# STAGE 5: DEPLOYMENT SUMMARY
# =================================================================
print_step "STAGE 5: Deployment Summary"

echo "🎉 Deployment Summary"
echo "=================="

# Get service information
echo "📊 Service Information:"
for SERVICE in "${SERVICES[@]}"; do
    HEALTH_CHECK=$(docker-compose -f $COMPOSE_FILE exec -T $SERVICE wget --no-verbose --tries=1 --spider "http://localhost:${SERVICE: -2:3002:3003:3004:3005:3006}/api/health" -O- "|| exit 1" 2>/dev/null | grep -q "connected" && echo "✅" || echo "❌")
    CONTAINER_ID=$(docker-compose -f $COMPOSE_FILE ps -q $SERVICE | awk '{print $2}')
    if [ -n "$CONTAINER_ID" ]; then
        CONTAINER_ID=$(docker-compose -f $COMPOSE_FILE ps -q $SERVICE | awk 'NR==1 {print $2}')
    fi
    echo -e "  $SERVICE: Port $(${SERVICE: -2:3002:3003:3004:3005:3006}), Container: $CONTAINER_ID, Health: $HEALTH_CHECK"
done

# Get Redis information
REDIS_ID=$(docker-compose -f $COMPOSE_FILE ps -q redis | awk 'NR==1 {print $2}')
REDIS_HEALTH=$(docker-compose -f $COMPOSE_FILE exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG" && echo "✅" || echo "❌")
echo -e "  Redis: Container $REDIS_ID, Health: $REDIS_HEALTH"

# Show network information
echo ""
echo "🌐 Network Configuration:"
docker network ls chainreactions-network --format "table {{.Name}}\t{{.Driver}}\t{{.Scope}}"

# Show volume information
echo ""
echo "💾 Volume Information:"
docker volume ls --format "table {{.Name}}\t{{.Driver}}\t{{.Mountpoint}}"

# Resource usage
echo ""
echo "📈 Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# URLs for testing
echo ""
echo "🔗 Service URLs for Testing:"
echo -e "  Entity Relations:  http://localhost:3002/api/health"
echo -e "  Entity Search:    http://localhost:3003/api/health"
echo -e "  Dataset Matching: http://localhost:3004/api/health"
echo -e "  Data Management:  http://localhost:3005/api/health"
echo -e "  Dataset Search:    http://localhost:3006/api/health"
echo -e "  Frontend should connect to: http://localhost:3001 (if running)"

# Deployment time info
DEPLOY_TIME=$(date +"%Y-%m-%d %H:%M:%S")
echo -e "⏰ Deployment completed at: $DEPLOY_TIME"

# Next steps
echo ""
echo "📋 Next Steps:"
echo "  1. Test services: curl http://localhost:[PORT]/api/health"
echo "  2. View logs: docker-compose logs [service-name]"
echo "  3. Stop services: docker-compose down"
echo "  4. Update environment: edit .env file"
echo "  5. Redeploy: ./deploy-optimized.sh"

echo ""
print_success "🎉 Optimized deployment completed successfully!"
echo -e "${GREEN}All services are running and healthy!${NC}"
echo -e "${BLUE}Ready for frontend connection.${NC}"