#!/bin/bash

# =================================================================
# ChainReactions Backend - DigitalOcean Deployment Script
# =================================================================
# Purpose: Deploy microservices architecture to DigitalOcean Docker
# Architecture: 5 Microservices + Redis Cache
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

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_warning "Please run as root or with sudo"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi
print_success "Docker is installed"

# Detect Docker Compose command (v1 or v2)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
    print_success "Docker Compose v1 detected (docker-compose)"
elif docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
    print_success "Docker Compose v2 detected (docker compose)"
else
    print_error "Docker Compose is not installed. Please install Docker Compose."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found. Please create it from .env.docker.example"
    exit 1
fi
print_success ".env file exists"

# Verify critical environment variables
print_step "Verifying Environment Variables"

REQUIRED_VARS=(
    "GEMINI_API_KEY"
    "BRIGHT_DATA_API_KEY"
    "LINKUP_API_KEY"
    "LINKUP_API_KEY_2"
    "SUPABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" .env || grep -q "^${var}=your_" .env; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    print_error "Missing or incomplete environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    exit 1
fi
print_success "All required environment variables are set"

# =================================================================
# STAGE 2: BACKUP CURRENT DEPLOYMENT
# =================================================================
print_step "STAGE 2: Creating Backup"

BACKUP_DIR="/root/backups/chainreactions_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
print_success "Backup directory created: $BACKUP_DIR"

# Backup .env file
cp .env "$BACKUP_DIR/.env.backup"
print_success ".env file backed up"

# Backup current logs if services are running
if $DOCKER_COMPOSE ps | grep -q "Up"; then
    $DOCKER_COMPOSE logs --no-color > "$BACKUP_DIR/logs_before_upgrade.txt" 2>/dev/null || true
    print_success "Container logs backed up"
fi

# Backup Redis data if exists
if docker volume ls | grep -q "chainreactions-redis-data"; then
    docker run --rm -v chainreactions-redis-data:/data -v "$BACKUP_DIR":/backup alpine \
        tar czf /backup/redis-data.tar.gz -C /data . 2>/dev/null || true
    print_success "Redis data backed up"
fi

# Backup upload files if exists
if docker volume ls | grep -q "chainreactions-uploads"; then
    docker run --rm -v chainreactions-uploads:/data -v "$BACKUP_DIR":/backup alpine \
        tar czf /backup/uploads-data.tar.gz -C /data . 2>/dev/null || true
    print_success "Upload files backed up"
fi

echo -e "\n${GREEN}Backup completed: $BACKUP_DIR${NC}\n"

# =================================================================
# STAGE 3: STOP OLD SERVICES
# =================================================================
print_step "STAGE 3: Stopping Current Services"

if $DOCKER_COMPOSE ps | grep -q "Up"; then
    $DOCKER_COMPOSE down
    print_success "Services stopped"
else
    print_warning "No running services found"
fi

# =================================================================
# STAGE 4: PULL LATEST CODE
# =================================================================
print_step "STAGE 4: Pulling Latest Code"

# Check if git repository
if [ -d ".git" ]; then
    git pull origin main
    print_success "Latest code pulled from repository"
else
    print_warning "Not a git repository. Skipping code pull."
fi

# =================================================================
# STAGE 5: BUILD DOCKER IMAGES
# =================================================================
print_step "STAGE 5: Building Docker Images"

echo "This may take 5-10 minutes on first build..."
$DOCKER_COMPOSE build --parallel

print_success "All Docker images built successfully"

# =================================================================
# STAGE 6: START MICROSERVICES
# =================================================================
print_step "STAGE 6: Starting Microservices"

$DOCKER_COMPOSE up -d

print_success "All services started in detached mode"

# =================================================================
# STAGE 7: HEALTH CHECKS
# =================================================================
print_step "STAGE 7: Performing Health Checks"

echo "Waiting for services to start (60 seconds)..."
sleep 60

# Check container status
print_step "Container Status"
$DOCKER_COMPOSE ps

# Array of services with ports
declare -A SERVICES=(
    ["entity-relations"]="3002"
    ["entity-search"]="3003"
    ["dataset-matching"]="3004"
    ["data-management"]="3005"
    ["dataset-search"]="3006"
)

FAILED_SERVICES=()

echo ""
for service in "${!SERVICES[@]}"; do
    port="${SERVICES[$service]}"

    # Check if service is healthy
    if $DOCKER_COMPOSE ps | grep "$service" | grep -q "Up (healthy)"; then
        # Test health endpoint
        if curl -s "http://localhost:$port/api/health" > /dev/null 2>&1; then
            print_success "$service (port $port) is healthy"
        else
            print_warning "$service is running but health check failed"
            FAILED_SERVICES+=("$service")
        fi
    else
        print_error "$service is not healthy"
        FAILED_SERVICES+=("$service")
    fi
done

# Check Redis
if $DOCKER_COMPOSE exec -T redis redis-cli ping > /dev/null 2>&1; then
    print_success "Redis is healthy"
else
    print_error "Redis health check failed"
    FAILED_SERVICES+=("redis")
fi

# =================================================================
# STAGE 8: DEPLOYMENT SUMMARY
# =================================================================
print_step "DEPLOYMENT SUMMARY"

if [ ${#FAILED_SERVICES[@]} -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}║          ✅ DEPLOYMENT SUCCESSFUL ✅                      ║${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}All 5 microservices + Redis are running and healthy!${NC}"
    echo ""
    echo "Service URLs:"
    echo "  • Entity Relations:   http://localhost:3002/api/health"
    echo "  • Entity Search:      http://localhost:3003/api/health"
    echo "  • Dataset Matching:   http://localhost:3004/api/health"
    echo "  • Data Management:    http://localhost:3005/api/health"
    echo "  • Dataset Search:     http://localhost:3006/api/health"
    echo ""
    echo "Backup location: $BACKUP_DIR"
    echo ""
    echo "Next steps:"
    echo "  1. Update frontend to connect to ports 3002-3006"
    echo "  2. Configure Nginx/CloudFlare routing"
    echo "  3. Monitor logs: $DOCKER_COMPOSE logs -f"
    echo ""
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                           ║${NC}"
    echo -e "${RED}║          ⚠️  DEPLOYMENT INCOMPLETE ⚠️                    ║${NC}"
    echo -e "${RED}║                                                           ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    print_error "Failed services: ${FAILED_SERVICES[*]}"
    echo ""
    echo "Troubleshooting steps:"
    echo "  1. Check logs: $DOCKER_COMPOSE logs ${FAILED_SERVICES[0]}"
    echo "  2. Verify environment variables: $DOCKER_COMPOSE config"
    echo "  3. Check resources: docker stats"
    echo "  4. Restart service: $DOCKER_COMPOSE restart ${FAILED_SERVICES[0]}"
    echo ""
    echo "Backup location: $BACKUP_DIR"
    echo ""
    exit 1
fi

# =================================================================
# STAGE 9: RESOURCE MONITORING
# =================================================================
print_step "Resource Usage"
docker stats --no-stream

# =================================================================
# STAGE 10: CLEANUP
# =================================================================
print_step "Cleaning Up Old Images"
docker image prune -a -f > /dev/null 2>&1
print_success "Unused Docker images removed"

echo ""
print_success "Deployment completed successfully!"
echo ""
