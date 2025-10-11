# 🐳 ChainReactions Unified OSINT Platform - Docker Deployment Guide

## 📋 Overview

This guide covers Docker deployment of the ChainReactions Unified OSINT Platform with all 6 integrated services:

1. **Entity Relations** (DeepThinking + Normal modes)
2. **Entity Search** (Linkup API integration)
3. **Dataset Matching** (Advanced entity matching)
4. **Data Management** (CSV upload and parsing)
5. **Dataset Search** (SSE streaming search)
6. **Demo Email Service** (Gmail SMTP integration)

## 🚀 Quick Start

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- All required API keys (see `.env.docker.example`)

### Step 1: Configure Environment Variables

```bash
# Copy the Docker environment template
cp .env.docker.example .env.docker

# Edit with your actual API keys
nano .env.docker
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
| **Email Service** | `GMAIL_USER` | Gmail address |
| | `GMAIL_APP_PASSWORD` | Gmail app password |

### Step 2: Start the Platform

```bash
# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 3: Verify Deployment

```bash
# Check application health
curl http://localhost:3000/api/health

# View service information
curl http://localhost:3000/api

# Test email service
curl http://localhost:3000/api/test-email
```

## 📊 Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Port 3000 (External)                  │
│  ChainReactions Unified OSINT Platform                  │
├─────────────────────────────────────────────────────────┤
│  • Entity Relations (DeepThinking + Normal)             │
│  • Entity Search (Linkup API)                           │
│  • Dataset Matching (Algorithms + Cache)                │
│  • Data Management (CSV + Parsing)                      │
│  • Dataset Search (SSE Streaming)                       │
│  • Demo Email Service (Gmail SMTP)                      │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Port 6379 (Internal)                   │
│                   Redis Cache                           │
│  • Dataset Matching Cache                               │
│  • Session Storage                                      │
│  • Search Result Caching                                │
└─────────────────────────────────────────────────────────┘
```

## 🔧 Configuration Options

### Production Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `3000` | Application port |
| `REDIS_URL` | `redis://redis:6379` | Redis connection URL |

### Redis Configuration

The Redis service is configured with:

- **Memory Limit**: 256MB with LRU eviction
- **Persistence**: RDB snapshots + AOF logging
- **Network**: Internal Docker network access only
- **Health Checks**: Automatic health monitoring

### Performance Tuning

| Setting | Value | Purpose |
|---------|-------|---------|
| `maxmemory` | 256mb | Memory limit |
| `maxmemory-policy` | allkeys-lru | Eviction policy |
| `save 900 1` | - | Snapshot every 15min if 1+ changes |
| `appendonly` | yes | AOF persistence |
| `timeout` | 300s | Client timeout |

## 🛠️ Management Commands

### Service Management

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Scale application (if needed)
docker-compose up -d --scale chainreactions-app=2
```

### Log Management

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f chainreactions-app
docker-compose logs -f redis

# View last 100 lines
docker-compose logs --tail=100
```

### Maintenance

```bash
# Clean up unused images
docker image prune

# View resource usage
docker stats

# Access application shell
docker-compose exec chainreactions-app sh

# Access Redis CLI
docker-compose exec redis redis-cli
```

## 🔍 Monitoring and Health Checks

### Application Health Endpoints

- **Main Health**: `GET /api/health`
- **Service Info**: `GET /api`
- **Email Test**: `GET /api/test-email`

### Health Check Configuration

- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3 attempts
- **Start Period**: 60 seconds

### Monitoring Redis

```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# View memory usage
docker-compose exec redis redis-cli info memory

# View connected clients
docker-compose exec redis redis-cli info clients
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Application Fails to Start
```bash
# Check logs
docker-compose logs chainreactions-app

# Verify environment variables
docker-compose config

# Check if all API keys are set
docker-compose exec chainreactions-app env | grep -E "(API_KEY|GEMINI|LINKUP|SUPABASE|GMAIL)"
```

#### 2. Redis Connection Issues
```bash
# Check Redis status
docker-compose exec redis redis-cli ping

# Verify Redis network
docker-compose exec chainreactions-app ping redis

# Check Redis logs
docker-compose logs redis
```

#### 3. Email Service Issues
```bash
# Test email service
curl http://localhost:3000/api/test-email

# Verify Gmail credentials
docker-compose exec chainreactions-app env | grep GMAIL
```

#### 4. Port Conflicts
```bash
# Check port usage
netstat -tulpn | grep :3000
netstat -tulpn | grep :6379

# Stop conflicting services
sudo systemctl stop nginx  # If nginx is using port 3000
```

### Debug Mode

For development and debugging:

```bash
# Run with development environment
docker-compose -f docker-compose.yml -f docker-compose.override.yml up

# Access container shell
docker-compose exec chainreactions-app sh

# View real-time logs
docker-compose logs -f --tail=100
```

## 🔒 Security Considerations

### API Key Management

- ✅ Never commit `.env.docker` to version control
- ✅ Use strong, unique API keys
- ✅ Rotate API keys regularly
- ✅ Monitor API usage and costs

### Network Security

- ✅ Only Port 3000 exposed externally
- ✅ Redis on internal network only
- ✅ Application runs as non-root user
- ✅ Health checks limited to localhost

### Container Security

- ✅ Minimal Alpine Linux base images
- ✅ Non-root user execution
- ✅ Read-only filesystem where possible
- ✅ Security updates via Docker base images

## 📈 Performance Optimization

### Scaling Options

1. **Vertical Scaling**: Increase container resources
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2.0'
         memory: 2G
   ```

2. **Horizontal Scaling**: Multiple application instances
   ```bash
   docker-compose up -d --scale chainreactions-app=3
   ```

3. **External Redis**: Use managed Redis service for production

### Resource Monitoring

```bash
# Monitor container resources
docker stats

# Check disk usage
docker-compose exec df -h

# Monitor API response times
curl -w "@curl-format.txt" http://localhost:3000/api/health
```

## 🔄 Backup and Recovery

### Data Backup

```bash
# Backup Redis data
docker-compose exec redis redis-cli BGSAVE
docker cp chainreactions-redis:/data/dump.rdb ./redis-backup.rdb

# Backup logs
docker-compose logs --no-color > application-logs.txt
```

### Disaster Recovery

```bash
# Restore Redis data
docker cp ./redis-backup.rdb chainreactions-redis:/data/dump.rdb
docker-compose restart redis

# Redeploy from scratch
docker-compose down
docker-compose up -d --build
```

## 📞 Support

For issues with Docker deployment:

1. Check this guide first
2. Review application logs: `docker-compose logs`
3. Verify all required API keys are set
4. Ensure Docker and Docker Compose are up to date
5. Check system resources (memory, disk space)

**Platform Version**: 3.0.0
**Last Updated**: 2025-10-10