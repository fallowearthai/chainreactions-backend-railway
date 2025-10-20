# 🐳 ChainReactions Backend - Docker Deployment Guide

## 📋 Overview

This guide covers Docker deployment of the ChainReactions Backend using a **microservices architecture** with 5 independent services + Redis cache.

### Architecture: Microservices (Phase 4 - Direct Connection)

| Service | Port | Purpose |
|---------|------|---------|
| **Entity Relations** | 3002 | DeepThinking 3-Stage OSINT + Normal Search |
| **Entity Search** | 3003 | Linkup API business intelligence |
| **Dataset Matching** | 3004 | Advanced entity matching algorithms |
| **Data Management** | 3005 | CSV processing & Supabase integration |
| **Dataset Search** | 3006 | SSE streaming search + NRO data |
| **Redis Cache** | 6379 | Shared caching layer (internal) |

## 🚀 Quick Start

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- All required API keys (see `.env.docker.example`)

### Step 1: Configure Environment Variables

```bash
# Navigate to the backend directory
cd /path/to/chainreactions_backend

# Copy the Docker environment template
cp .env.docker.example .env

# Edit with your actual API keys
nano .env
```

### Required API Keys

| Service | Environment Variable | Description |
|---------|---------------------|-------------|
| **Entity Relations** | `GEMINI_API_KEY` | Google Gemini API key |
| | `BRIGHT_DATA_API_KEY` | Bright Data SERP API |
| | `BRIGHT_DATA_SERP_ZONE` | SERP zone identifier |
| **Entity Search** | `LINKUP_API_KEY` | Primary Linkup API key |
| **Dataset Search** | `LINKUP_API_KEY_2` | Secondary Linkup API key |
| **Dataset Matching** | `SUPABASE_URL` | Supabase project URL |
| | `SUPABASE_ANON_KEY` | Supabase anonymous key |
| | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

### Step 2: Start All Services

```bash
# Build and start all microservices
docker-compose up -d

# Check service status
docker-compose ps

# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f entity-relations
```

### Step 3: Verify Deployment

```bash
# Check all microservices health
curl http://localhost:3002/api/health  # Entity Relations
curl http://localhost:3003/api/health  # Entity Search
curl http://localhost:3004/api/health  # Dataset Matching
curl http://localhost:3005/api/health  # Data Management
curl http://localhost:3006/api/health  # Dataset Search

# Check Redis
docker-compose exec redis redis-cli ping
```

## 📊 Microservices Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND APPLICATION                     │
│                  (Direct Connection Pattern)                │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Entity Relations│  │  Entity Search  │  │Dataset Matching │
│   Port 3002     │  │   Port 3003     │  │   Port 3004     │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                     │
         │         ┌──────────┼──────────┐          │
         │         │          │          │          │
         ▼         ▼          ▼          ▼          ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Data Management │  │ Dataset Search  │  │  Redis Cache    │
│   Port 3005     │  │   Port 3006     │  │  Port 6379      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## 🔧 Service Configuration

### 1. Entity Relations (Port 3002)

**Features**:
- DeepThinking 3-Stage OSINT workflow
- Normal Search mode
- Enhanced Grounding mode
- Gemini AI integration
- Bright Data SERP (Google, Bing, Baidu, Yandex)
- SSE streaming support

**Health Check**: `GET /api/health`

**Key Environment Variables**:
```env
GEMINI_API_KEY=...
BRIGHT_DATA_API_KEY=...
BRIGHT_DATA_SERP_ZONE=...
```

### 2. Entity Search (Port 3003)

**Features**:
- Linkup API integration
- 8 risk keyword analysis
- Multi-language search support
- Automatic severity assessment

**Health Check**: `GET /api/health`

**Key Environment Variables**:
```env
LINKUP_API_KEY=...
GEMINI_API_KEY=...
```

### 3. Dataset Matching (Port 3004)

**Features**:
- 5 advanced matching algorithms
- In-memory caching system
- Batch processing capabilities
- Geographic matching
- Affiliated companies integration

**Health Check**: `GET /api/health`

**Key Environment Variables**:
```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 4. Data Management (Port 3005)

**Features**:
- CSV upload and parsing
- Intelligent data validation
- Supabase integration
- Batch processing

**Health Check**: `GET /api/health`

**Key Environment Variables**:
```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
UPLOAD_PATH=./uploads
```

### 5. Dataset Search (Port 3006)

**Features**:
- SSE streaming search
- Canadian NRO data integration
- Dual API key processing
- Real-time progress updates

**Health Check**: `GET /api/health`

**Key Environment Variables**:
```env
LINKUP_API_KEY_2=...
SUPABASE_URL=...
```

### 6. Redis Cache (Port 6379)

**Features**:
- Shared caching layer for all services
- Dataset matching cache
- Search result caching
- LRU eviction policy

**Configuration**: See `redis.conf`

**Memory Limit**: 256MB

## 🛠️ Management Commands

### Service Management

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d entity-relations

# Stop all services
docker-compose down

# Stop specific service
docker-compose stop entity-search

# Rebuild and restart all services
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build dataset-matching

# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart data-management
```

### Log Management

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f entity-relations
docker-compose logs -f entity-search
docker-compose logs -f dataset-matching
docker-compose logs -f data-management
docker-compose logs -f dataset-search
docker-compose logs -f redis

# View last 100 lines
docker-compose logs --tail=100

# View logs since timestamp
docker-compose logs --since 2025-10-20T10:00:00
```

### Maintenance

```bash
# Clean up unused images
docker image prune -a

# View resource usage
docker stats

# Access service shell
docker-compose exec entity-relations sh
docker-compose exec entity-search sh
docker-compose exec dataset-matching sh
docker-compose exec data-management sh
docker-compose exec dataset-search sh

# Access Redis CLI
docker-compose exec redis redis-cli

# View Redis info
docker-compose exec redis redis-cli info

# Monitor Redis commands
docker-compose exec redis redis-cli monitor
```

## 🔍 Monitoring and Health Checks

### Health Check Endpoints

Each microservice provides its own health endpoint:

```bash
# Entity Relations
curl http://localhost:3002/api/health

# Entity Search
curl http://localhost:3003/api/health

# Dataset Matching
curl http://localhost:3004/api/health

# Data Management
curl http://localhost:3005/api/health

# Dataset Search
curl http://localhost:3006/api/health
```

### Service Information Endpoints

```bash
# Get detailed service information
curl http://localhost:3002/api  # Entity Relations info
curl http://localhost:3003/api  # Entity Search info
curl http://localhost:3004/api  # Dataset Matching info
curl http://localhost:3005/api  # Data Management info
curl http://localhost:3006/api  # Dataset Search info
```

### Health Check Configuration

Each service has independent health checks:

- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3 attempts
- **Start Period**: 40 seconds

### Monitoring Redis

```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# View memory usage
docker-compose exec redis redis-cli info memory

# View connected clients
docker-compose exec redis redis-cli info clients

# View all keys
docker-compose exec redis redis-cli keys '*'

# Monitor cache hit ratio
docker-compose exec redis redis-cli info stats | grep keyspace
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Service Fails to Start

```bash
# Check service logs
docker-compose logs entity-relations

# Verify environment variables
docker-compose config

# Check if all API keys are set
docker-compose exec entity-relations env | grep -E "(API_KEY|GEMINI|LINKUP|SUPABASE)"

# Rebuild service
docker-compose up -d --build entity-relations
```

#### 2. Redis Connection Issues

```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# Verify Redis network connectivity from service
docker-compose exec entity-relations ping redis

# Check Redis logs
docker-compose logs redis

# Restart Redis
docker-compose restart redis
```

#### 3. Port Conflicts

```bash
# Check port usage on host
lsof -i :3002
lsof -i :3003
lsof -i :3004
lsof -i :3005
lsof -i :3006
lsof -i :6379

# Stop conflicting services
# Then restart docker-compose
docker-compose down && docker-compose up -d
```

#### 4. Service Health Check Failures

```bash
# Check if service is running
docker-compose ps

# View service logs
docker-compose logs entity-search

# Access service shell
docker-compose exec entity-search sh

# Test health endpoint from inside container
docker-compose exec entity-search wget -O- http://localhost:3003/api/health

# Check service dependencies
docker-compose exec entity-search ping redis
```

#### 5. High Memory Usage

```bash
# Check container resource usage
docker stats

# View Redis memory usage
docker-compose exec redis redis-cli info memory

# Clear Redis cache if needed
docker-compose exec redis redis-cli FLUSHDB

# Restart services to free memory
docker-compose restart
```

### Debug Mode

For development and debugging:

```bash
# View real-time logs with timestamps
docker-compose logs -f --tail=100 --timestamps

# Access service shell for debugging
docker-compose exec entity-relations sh

# Run commands inside container
docker-compose exec entity-relations npm run type-check

# Check environment variables
docker-compose exec entity-relations env

# Test internal service-to-service connectivity
docker-compose exec entity-search ping entity-relations
docker-compose exec dataset-matching ping redis
```

## 🔒 Security Considerations

### API Key Management

- ✅ Never commit `.env` to version control
- ✅ Use strong, unique API keys
- ✅ Rotate API keys regularly
- ✅ Monitor API usage and costs
- ✅ Set appropriate rate limits

### Network Security

- ✅ Services communicate via internal Docker network
- ✅ Only necessary ports exposed externally (3002-3006, 6379)
- ✅ Redis accessible only within Docker network in production
- ✅ Health checks limited to localhost
- ✅ CORS configured per service

### Container Security

- ✅ Minimal Alpine Linux base images (Node 18)
- ✅ Non-root user execution in all services
- ✅ Build dependencies installed and removed in single layer
- ✅ Security updates via Docker base images
- ✅ Separate Dockerfiles for each service

### Production Security Recommendations

```bash
# Remove external Redis port exposure
# Edit docker-compose.yml and remove:
# ports:
#   - "6379:6379"

# Set Redis password
# Edit redis.conf and set:
# requirepass your_strong_password_here

# Update docker-compose.yml:
# REDIS_PASSWORD=your_strong_password_here
```

## 📈 Performance Optimization

### Scaling Options

#### 1. Vertical Scaling

Increase container resources in `docker-compose.yml`:

```yaml
services:
  entity-relations:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

#### 2. Horizontal Scaling

Scale specific services:

```bash
# Scale entity-relations to 3 instances
docker-compose up -d --scale entity-relations=3

# Scale dataset-matching to 2 instances
docker-compose up -d --scale dataset-matching=2
```

**Note**: Requires load balancer (e.g., Nginx, Traefik) for distribution

#### 3. External Redis

Use managed Redis service for production:

```yaml
services:
  entity-relations:
    environment:
      - REDIS_URL=redis://your-managed-redis-host:6379
      - REDIS_PASSWORD=your_redis_password
```

### Resource Monitoring

```bash
# Monitor all container resources
docker stats

# Monitor specific service
docker stats chainreactions-entity-relations

# Check disk usage
docker system df

# View container sizes
docker ps --size
```

### Redis Performance Tuning

Edit `redis.conf` for production:

```conf
# Increase memory limit
maxmemory 512mb

# Adjust save frequency (less frequent = better performance)
save 3600 1
save 300 100

# Disable AOF for better write performance (less durability)
appendonly no
```

## 🔄 Backup and Recovery

### Data Backup

```bash
# Backup Redis data
docker-compose exec redis redis-cli BGSAVE
docker cp chainreactions-redis:/data/dump.rdb ./backups/redis-$(date +%Y%m%d).rdb

# Backup uploaded files
docker cp chainreactions-data-management:/app/uploads ./backups/uploads-$(date +%Y%m%d)

# Backup all service logs
docker-compose logs --no-color > ./backups/logs-$(date +%Y%m%d).txt

# Backup environment configuration
cp .env ./backups/.env-$(date +%Y%m%d)
```

### Disaster Recovery

```bash
# Restore Redis data
docker cp ./backups/redis-20251020.rdb chainreactions-redis:/data/dump.rdb
docker-compose restart redis

# Restore uploaded files
docker cp ./backups/uploads-20251020 chainreactions-data-management:/app/uploads

# Full redeploy from scratch
docker-compose down -v  # Remove volumes
docker-compose up -d --build  # Rebuild and start
```

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh - Automated backup script

BACKUP_DIR="./backups/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# Backup Redis
docker-compose exec redis redis-cli BGSAVE
sleep 5
docker cp chainreactions-redis:/data/dump.rdb "$BACKUP_DIR/redis.rdb"

# Backup uploads
docker cp chainreactions-data-management:/app/uploads "$BACKUP_DIR/uploads"

# Backup logs
docker-compose logs --no-color > "$BACKUP_DIR/logs.txt"

# Backup environment
cp .env "$BACKUP_DIR/.env"

echo "Backup completed: $BACKUP_DIR"
```

## 🌐 Frontend Integration

The frontend should connect directly to each microservice:

```typescript
// Frontend configuration example
const BACKEND_SERVICES = {
  entityRelations: 'http://localhost:3002',
  entitySearch: 'http://localhost:3003',
  datasetMatching: 'http://localhost:3004',
  dataManagement: 'http://localhost:3005',
  datasetSearch: 'http://localhost:3006'
};

// Example API calls
const searchResults = await fetch(
  `${BACKEND_SERVICES.entitySearch}/api/entity-search`,
  { method: 'POST', body: JSON.stringify({ company: 'Example Corp' }) }
);

const matchResults = await fetch(
  `${BACKEND_SERVICES.datasetMatching}/api/dataset-matching/match`,
  { method: 'POST', body: JSON.stringify({ name: 'Entity Name' }) }
);
```

## 📞 Support

For issues with Docker deployment:

1. Check this guide first
2. Review service logs: `docker-compose logs [service-name]`
3. Verify all required API keys are set in `.env`
4. Ensure Docker and Docker Compose are up to date
5. Check system resources (memory, disk space)
6. Test each service health endpoint individually

### Useful Commands Summary

```bash
# Quick diagnostic
docker-compose ps                    # Check service status
docker-compose logs -f --tail=50    # View recent logs
docker stats                        # Monitor resources
docker system df                    # Check disk usage

# Full restart
docker-compose down && docker-compose up -d --build

# Clean slate
docker-compose down -v              # Remove volumes
docker system prune -a              # Remove all unused data
docker-compose up -d --build        # Fresh start
```

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Redis Configuration Guide](https://redis.io/docs/management/config/)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

---

**Platform Version**: 4.0.0 (Microservices Architecture)
**Last Updated**: October 20, 2025
**Architecture**: Phase 4 - Direct Connection (No API Gateway)
