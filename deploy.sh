#!/bin/bash

# =================================================================
# ChainReactions Backend - Docker Deployment Script
# =================================================================
# Purpose: Deploy microservices architecture to Docker
# Architecture: 5 Microservices + Redis Cache
# Updated: October 2025 - Phase 4 Direct Connection Architecture
# =================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_step() {
    echo -e "\n${BLUE}===================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================================${NC}\n"
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

# =================================================================
# STAGE 1: PRE-DEPLOYMENT CHECKS
# =================================================================
print_step "STAGE 1: Pre-Deployment Checks"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi
print_success "Docker is installed"

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi
print_success "Docker Compose is installed"

# Check if .env file exists
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating from template..."
    if [ -f .env.docker.example ]; then
        cp .env.docker.example .env
        print_success ".env file created from .env.docker.example"
        print_warning "Please edit .env file with your actual API keys before running services"
    else
        print_error ".env.docker.example file not found. Please create .env file manually."
        exit 1
    fi
else
    print_success ".env file exists"
fi

# Check if docker-compose.yml exists
if [ ! -f docker-compose.yml ]; then
    print_error "docker-compose.yml file not found. Please ensure you're in the project root."
    exit 1
fi
print_success "docker-compose.yml file exists"

# Check critical environment variables
source .env
if [ -z "$SUPABASE_URL" ] || [ "$SUPABASE_URL" = "your_supabase_url_here" ]; then
    print_error "SUPABASE_URL not configured in .env file"
    exit 1
fi

if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "your_gemini_api_key_here" ]; then
    print_error "GEMINI_API_KEY not configured in .env file"
    exit 1
fi

print_success "Critical environment variables are configured"

# =================================================================
# STAGE 2: AUTOMATIC BACKUP
# =================================================================
print_step "STAGE 2: Automatic Backup"

# Create backup directory with timestamp
BACKUP_DIR="./backups/chainreactions_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup .env file
if [ -f .env ]; then
    cp .env "$BACKUP_DIR/.env.backup"
    print_success ".env file backed up to $BACKUP_DIR"
fi

# Backup current container logs if containers are running
if docker ps | grep -q "chainreactions"; then
    mkdir -p "$BACKUP_DIR/logs"
    for service in entity-relations entity-search dataset-matching data-management dataset-search redis; do
        if docker ps | grep -q "$service"; then
            docker logs "chainreactions-$service" > "$BACKUP_DIR/logs/$service.log" 2>&1 || true
        fi
    done
    print_success "Container logs backed up to $BACKUP_DIR/logs"
fi

# Backup Redis data if Redis container is running
if docker ps | grep -q "redis"; then
    mkdir -p "$BACKUP_DIR/redis"
    docker exec chainreactions-redis redis-cli BGSAVE || true
    sleep 2
    if docker exec chainreactions-redis test -f /data/dump.rdb; then
        docker cp chainreactions-redis:/data/dump.rdb "$BACKUP_DIR/redis/dump.rdb"
        print_success "Redis data backed up to $BACKUP_DIR/redis"
    fi
fi

# Backup uploaded files if they exist
if [ -d "./uploads" ]; then
    cp -r ./uploads "$BACKUP_DIR/"
    print_success "Uploads directory backed up to $BACKUP_DIR"
fi

print_success "Automatic backup completed: $BACKUP_DIR"

# =================================================================
# STAGE 3: STOP OLD SERVICES
# =================================================================
print_step "STAGE 3: Stop Old Services"

# Stop and remove existing containers
if docker-compose ps | grep -q "Up"; then
    print_warning "Stopping existing containers..."
    docker-compose down
    print_success "Existing containers stopped"
else
    print_success "No running containers found"
fi

# Wait for ports to be released
sleep 3

# =================================================================
# STAGE 4: CLEANUP OLD IMAGES (OPTIONAL)
# =================================================================
print_step "STAGE 4: Cleanup Old Images"

# Remove dangling images
docker image prune -f > /dev/null 2>&1 || true
print_success "Dangling images cleaned up"

# =================================================================
# STAGE 5: BUILD DOCKER IMAGES
# =================================================================
print_step "STAGE 5: Build Docker Images"

# Build all services
print_warning "Building Docker images (this may take 5-10 minutes)..."

# Build in parallel for faster deployment
docker-compose build --parallel

print_success "All Docker images built successfully"

# =================================================================
# STAGE 6: START MICROSERVICES
# =================================================================
print_step "STAGE 6: Start Microservices"

# Start Redis first (dependency for other services)
print_warning "Starting Redis cache..."
docker-compose up -d redis

# Wait for Redis to be healthy
print_warning "Waiting for Redis to be healthy..."
REDIS_HEALTHY=false
for i in {1..30}; do
    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        REDIS_HEALTHY=true
        print_success "Redis is healthy"
        break
    fi
    echo -n "."
    sleep 2
done

if [ "$REDIS_HEALTHY" = false ]; then
    print_error "Redis failed to start properly"
    exit 1
fi

# Start all microservices
print_warning "Starting all microservices..."
docker-compose up -d

print_success "All microservices started"

# =================================================================
# STAGE 7: HEALTH CHECKS
# =================================================================
print_step "STAGE 7: Health Checks"

# Wait for services to start
print_warning "Waiting 60 seconds for services to fully start..."
sleep 60

# Check container status
print_warning "Checking container status..."
FAILED_SERVICES=""

for service in entity-relations entity-search dataset-matching data-management dataset-search redis; do
    CONTAINER_NAME="chainreactions-$service"
    if docker ps | grep -q "$CONTAINER_NAME"; then
        HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "unknown")
        if [ "$HEALTH_STATUS" = "healthy" ]; then
            print_success "$service: healthy"
        else
            print_error "$service: $HEALTH_STATUS"
            FAILED_SERVICES="$FAILED_SERVICES $service"
        fi
    else
        print_error "$service: container not running"
        FAILED_SERVICES="$FAILED_SERVICES $service"
    fi
done

# Test service health endpoints if no failed services
if [ -z "$FAILED_SERVICES" ]; then
    print_warning "Testing health endpoints..."

    for port in 3002 3003 3004 3005 3006; do
        if curl -f -s "http://localhost:$port/api/health" > /dev/null; then
            print_success "Port $port: health endpoint responding"
        else
            print_warning "Port $port: health endpoint not responding"
        fi
    done

    # Test Redis connection
    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        print_success "Redis: responding to ping"
    else
        print_error "Redis: not responding"
        FAILED_SERVICES="$FAILED_SERVICES redis"
    fi
fi

# =================================================================
# STAGE 8: DEPLOYMENT SUMMARY
# =================================================================
print_step "STAGE 8: Deployment Summary"

if [ -z "$FAILED_SERVICES" ]; then
    print_success "🎉 Deployment completed successfully!"
    echo -e "\n${GREEN}All services are running and healthy:${NC}"
    echo -e "  • Entity Relations:    http://localhost:3002"
    echo -e "  • Entity Search:       http://localhost:3003"
    echo -e "  • Dataset Matching:    http://localhost:3004"
    echo -e "  • Data Management:     http://localhost:3005"
    echo -e "  • Dataset Search:      http://localhost:3006"
    echo -e "  • Redis Cache:         localhost:6379"
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo -e "  1. Run ./test_deployment.sh to verify functionality"
    echo -e "  2. Update frontend configuration to use direct connections"
    echo -e "  3. Configure reverse proxy if needed"
else
    print_error "Deployment completed with issues in services:$FAILED_SERVICES"
    echo -e "\n${YELLOW}Troubleshooting:${NC}"
    echo -e "  1. Check logs: docker-compose logs [service-name]"
    echo -e "  2. Restart failed service: docker-compose restart [service-name]"
    echo -e "  3. Check backup directory: $BACKUP_DIR"
    exit 1
fi

# =================================================================
# STAGE 9: RESOURCE MONITORING
# =================================================================
print_step "STAGE 9: Resource Monitoring"

echo -e "\n${BLUE}Current resource usage:${NC}"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# =================================================================
# STAGE 10: CLEANUP OPTIMIZATION
# =================================================================
print_step "STAGE 10: Cleanup Optimization"

# Remove unused images to free space
docker image prune -f > /dev/null 2>&1 || true
print_success "Unused Docker images cleaned up"

# Show disk usage
echo -e "\n${BLUE}Docker disk usage:${NC}"
docker system df

print_success "Deployment process completed successfully!"
echo -e "\n${GREEN}Backup location: $BACKUP_DIR${NC}"
echo -e "${YELLOW}Save this backup directory for rollback if needed${NC}"