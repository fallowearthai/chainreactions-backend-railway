# DigitalOcean Deployment Guide

**Deployment Date:** 2025-12-31
**Architecture:** 6 Microservices + Redis
**Node.js Version:** 20-alpine

---

## 🚀 Quick Start Deployment

### Prerequisites
- DigitalOcean account with App Platform or Kubernetes access
- Git repository (GitHub/GitLab) containing this code
- Supabase project (PostgreSQL database)
- Redis instance (optional, for caching)

### Deployment Steps

#### Option 1: DigitalOcean App Platform (Recommended)

1. **Push Code to Git Repository**
   ```bash
   git add .
   git commit -m "Prepare for DigitalOcean deployment"
   git push origin main
   ```

2. **Create New App in DigitalOcean**
   - Go to DigitalOcean Dashboard → Apps → Create App
   - Select your git repository
   - Choose deployment branch (main)

3. **Configure Services** (6 separate apps or one app with multiple components)

   For each service:
   - **Component Name**: entity-relations, entity-search, etc.
   - **Build Command**: `npm run build`
   - **Run Command**: `npm start`
   - **HTTP Port**: 3002, 3003, 3004, 3005, 3006, 3007

4. **Add Environment Variables** (see details below)

5. **Deploy**
   - Click "Deploy" and wait for build to complete
   - DigitalOcean will provision resources and deploy all services

#### Option 2: Docker Swarm / Kubernetes

1. **Build Docker Images**
   ```bash
   docker-compose build
   ```

2. **Push to Container Registry**
   ```bash
   docker tag chainreactions-entity-relations registry.digitalocean.com/your-registry/entity-relations:latest
   docker push registry.digitalocean.com/your-registry/entity-relations:latest
   # Repeat for all services
   ```

3. **Deploy with docker-compose or kubectl**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   # or
   kubectl apply -f k8s/
   ```

---

## 🔑 Environment Variables Configuration

### Required Environment Variables per Service

#### 1. Entity Relations Service (Port 3002)

```bash
# AI Service Integration
GEMINI_API_KEY=<your_gemini_api_key>
BRIGHT_DATA_API_KEY=<your_bright_data_api_key>
BRIGHT_DATA_SERP_ZONE=<your_serp_zone_name>

# Redis (Optional)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# Application
NODE_ENV=production
PORT=3002

# Grounding Feature Flags
ENABLE_ENHANCED_GROUNDING=true
GROUNDING_CONFIDENCE_THRESHOLD=0.7
```

**Sensitive Variables:** GEMINI_API_KEY, BRIGHT_DATA_API_KEY

---

#### 2. Entity Search Service (Port 3003)

```bash
# Business Intelligence API
LINKUP_API_KEY=<your_linkup_api_key>
LINKUP_BASE_URL=https://api.linkup.ai

# Application
NODE_ENV=production
PORT=3003
```

**Sensitive Variables:** LINKUP_API_KEY

---

#### 3. Dataset Matching Service (Port 3004)

```bash
# Database
SUPABASE_URL=<your_supabase_project_url>
SUPABASE_ANON_KEY=<your_supabase_anon_key>

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# Application
NODE_ENV=production
PORT=3004
```

**Sensitive Variables:** SUPABASE_URL, SUPABASE_ANON_KEY

---

#### 4. Data Management Service (Port 3005)

```bash
# Database
SUPABASE_URL=<your_supabase_project_url>
SUPABASE_SERVICE_ROLE_KEY=<your_supabase_service_role_key>

# File Upload
UPLOAD_PATH=/app/uploads

# Application
NODE_ENV=production
PORT=3005
```

**Sensitive Variables:** SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

---

#### 5. Dataset Search Service (Port 3006)

```bash
# Database
SUPABASE_URL=<your_supabase_project_url>
SUPABASE_ANON_KEY=<your_supabase_anon_key>

# Business Intelligence API
LINKUP_API_KEY_2=<your_second_linkup_api_key>

# Application
NODE_ENV=production
PORT=3006
```

**Sensitive Variables:** SUPABASE_URL, SUPABASE_ANON_KEY, LINKUP_API_KEY_2

---

#### 6. User Management Service (Port 3007)

```bash
# Database
SUPABASE_URL=<your_supabase_project_url>
SUPABASE_ANON_KEY=<your_supabase_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_supabase_service_role_key>

# JWT Authentication
JWT_SECRET=<your_jwt_secret_min_32_chars>
REFRESH_TOKEN_SECRET=<your_refresh_secret_min_32_chars>

# Frontend Integration
FRONTEND_URL=https://chainreactions.site
ALLOWED_ORIGINS=https://chainreactions.site,https://www.chainreactions.site,https://chainreactions-frontend-dev.vercel.app

# Application
NODE_ENV=production
PORT=3007
```

**Sensitive Variables:** SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, REFRESH_TOKEN_SECRET

---

#### 7. Redis (Shared Cache)

```bash
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<your_redis_password>  # Optional but recommended
```

---

## 🔒 Security Best Practices

### 1. Environment Variable Management

**DO NOT:**
- ❌ Commit real API keys to git
- ❌ Use .env files in production
- ❌ Share secrets via chat/email

**DO:**
- ✅ Use DigitalOcean environment variables (encrypted)
- ✅ Use DigitalOcean App Secrets for sensitive data
- ✅ Rotate secrets periodically
- ✅ Use different API keys for dev/staging/production

### 2. CORS Configuration

All services are configured to accept requests from:
- `https://chainreactions.site` (Production)
- `https://www.chainreactions.site` (Production with www)
- `https://chainreactions-frontend-dev.vercel.app` (Staging)

### 3. Database Security

- **Supabase:** Ensure Row Level Security (RLS) policies are enabled
- **Service Role Key:** Never expose SERVICE_ROLE_KEY to frontend
- **Anon Key:** Only use ANON_KEY in frontend applications

### 4. Health Checks

All services expose health check endpoints:
```bash
GET /api/health
```

DigitalOcean will automatically check these endpoints for service health.

---

## 🌐 Production URLs

After deployment, your services will be accessible at:

```
Entity Relations:    https://entity-relations.your-app.ondigitalocean.app
Entity Search:       https://entity-search.your-app.ondigitalocean.app
Dataset Matching:    https://dataset-matching.your-app.ondigitalocean.app
Data Management:     https://data-management.your-app.ondigitalocean.app
Dataset Search:      https://dataset-search.your-app.ondigitalocean.app
User Management:     https://user-management.your-app.ondigitalocean.app
```

**Custom Domain Setup:**
1. Go to App Settings → Domains
2. Add custom domain: `api.chainreactions.site`
3. Update DNS records (A record or CNAME)
4. Enable SSL/TLS certificate (automatic with Let's Encrypt)

---

## 📊 Service Dependencies

### Database Connections
- **Entity Relations** → Supabase PostgreSQL
- **Entity Search** → Linkup API
- **Dataset Matching** → Supabase PostgreSQL + Redis
- **Data Management** → Supabase PostgreSQL
- **Dataset Search** → Supabase PostgreSQL
- **User Management** → Supabase PostgreSQL + Auth

### External APIs
- **Gemini AI** (Google) → Entity Relations service
- **Bright Data SERP** → Entity Relations service
- **Linkup API** → Entity Search + Dataset Search services

---

## 🧪 Post-Deployment Testing

### 1. Health Check

```bash
# Test all services
curl https://entity-relations.your-app.ondigitalocean.app/api/health
curl https://entity-search.your-app.ondigitalocean.app/api/health
curl https://dataset-matching.your-app.ondigitalocean.app/api/health
curl https://data-management.your-app.ondigitalocean.app/api/health
curl https://dataset-search.your-app.ondigitalocean.app/api/health
curl https://user-management.your-app.ondigitalocean.app/api/health
```

Expected response:
```json
{
  "status": "operational",
  "service": "<service-name>",
  "version": "1.0.0",
  "timestamp": "2025-12-31T12:00:00.000Z"
}
```

### 2. CORS Testing

```bash
curl -H "Origin: https://chainreactions.site" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://entity-relations.your-app.ondigitalocean.app/api/health
```

Should return CORS headers:
```
Access-Control-Allow-Origin: https://chainreactions.site
Access-Control-Allow-Credentials: true
```

### 3. Database Connectivity

Check logs in DigitalOcean dashboard:
- Go to your App → Logs
- Filter by service name
- Look for database connection messages

---

## 🔄 Update Deployment

### To update a service:

1. **Push changes to git**
   ```bash
   git add .
   git commit -m "Update service"
   git push origin main
   ```

2. **Trigger deployment in DigitalOcean**
   - Go to your App → Deployments
   - Click "Deploy" button
   - DigitalOcean will pull latest code and rebuild

### Automatic Deployments:
- Enable automatic deployments in App Settings
- Every push to main branch triggers deployment
- Recommended: Enable for development/staging, disable for production

---

## 🐛 Troubleshooting

### Service Fails to Start

**Symptoms:** Health check returns 502/503

**Solutions:**
1. Check logs in DigitalOcean dashboard
2. Verify all environment variables are set
3. Ensure database is accessible
4. Check Node.js version compatibility (Node 20)

### Database Connection Errors

**Symptoms:** Logs show "ECONNREFUSED" or "connection timeout"

**Solutions:**
1. Verify SUPABASE_URL is correct
2. Check Supabase service status
3. Verify firewall allows outbound PostgreSQL connections (port 5432)
4. Ensure Supabase project is not paused

### CORS Errors

**Symptoms:** Browser console shows CORS policy errors

**Solutions:**
1. Verify FRONTEND_URL or ALLOWED_ORIGINS includes your domain
2. Check that domain protocol matches (http vs https)
3. Clear browser cache and test again
4. Verify service CORS configuration

### Out of Memory

**Symptoms:** Service crashes with "JavaScript heap out of memory"

**Solutions:**
1. Upgrade App Platform container size (Basic → Professional)
2. Add memory limits to docker-compose if using Kubernetes
3. Check for memory leaks in service code

---

## 📈 Monitoring and Alerts

### DigitalOcean Monitoring

1. **Metrics** (built-in)
   - CPU usage
   - Memory usage
   - Bandwidth
   - Response times

2. **Alerts**
   - Configure alert policies in DigitalOcean
   - Get notified via email/Slack/PagerDuty
   - Recommended alerts:
     * CPU > 80% for 5 minutes
     * Memory > 85% for 5 minutes
     * Health check fails 3 times in a row

3. **Logs**
   - Real-time logs in DigitalOcean dashboard
   - Download logs for analysis
   - Set up log archiving (optional)

### External Monitoring (Optional)

- **Uptime monitoring:** UptimeRobot, Pingdom
- **APM:** New Relic, DataDog, Sentry
- **Log aggregation:** ELK Stack, LogDNA

---

## 💰 Cost Estimates (DigitalOcean App Platform)

### Basic Tier (Starting)
- **Container size:** 0.1 vCPU, 256MB RAM
- **Cost per service:** ~$5/month
- **Total (6 services):** ~$30/month
- **Redis:** ~$15/month
- **Total monthly cost:** ~$45/month

### Professional Tier (Recommended for Production)
- **Container size:** 1 vCPU, 2GB RAM
- **Cost per service:** ~$40/month
- **Total (6 services):** ~$240/month
- **Redis (dedicated):** ~$60/month
- **Total monthly cost:** ~$300/month

### Dedicated CPU (High Performance)
- **Container size:** 4 vCPU, 8GB RAM
- **Cost per service:** ~$200/month
- **Total (6 services):** ~$1,200/month
- **Redis (dedicated):** ~$120/month
- **Total monthly cost:** ~$1,320/month

**Additional costs:**
- Bandwidth overage: $0.10/GB
- Storage: $0.25/GB/month
- Load balancer: Included in App Platform

---

## 🔐 Backup and Disaster Recovery

### Database Backups

**Supabase (included):**
- Daily backups (last 30 days)
- Point-in-time recovery (7 days)
- Manual backups before major changes

**Backup Procedure:**
1. Go to Supabase dashboard
2. Database → Backups
3. Click "Create backup"
4. Wait for completion

### Disaster Recovery

**If deployment fails:**
1. Rollback to previous deployment in DigitalOcean dashboard
2. Check database backups in Supabase
3. Verify environment variables
4. Review logs for errors

**If database is corrupted:**
1. Restore from most recent backup
2. Verify data integrity
3. Test all services
4. Monitor for issues

---

## 📝 Deployment Checklist

### Pre-Deployment
- [ ] All code committed to git repository
- [ ] Environment variables documented
- [ ] Database created in Supabase
- [ ] Redis instance provisioned (if using)
- [ ] Custom domain configured (optional)
- [ ] DNS records updated (if using custom domain)

### Deployment
- [ ] DigitalOcean app created
- [ ] Git repository connected
- [ ] Build settings configured
- [ ] Environment variables added (all sensitive variables encrypted)
- [ ] Health check endpoints configured
- [ ] Deployment triggered

### Post-Deployment
- [ ] All health endpoints return 200 OK
- [ ] CORS testing passed
- [ ] Database connectivity verified
- [ ] External API keys working
- [ ] Frontend can connect to all services
- [ ] Monitoring and alerts configured
- [ ] Log access verified
- [ ] Backup strategy confirmed

### Security Verification
- [ ] No .env files in git repository
- [ ] All API keys stored as encrypted variables
- [ ] RLS policies enabled in Supabase
- [ ] HTTPS enforced (SSL certificates active)
- [ ] Firewall rules configured
- [ ] Rate limiting enabled

---

## 🎯 Next Steps After Deployment

1. **Performance Testing**
   - Load test each service
   - Identify bottlenecks
   - Optimize slow queries

2. **Monitoring Setup**
   - Configure alert policies
   - Set up log aggregation
   - Create custom dashboards

3. **CI/CD Pipeline**
   - Configure automated testing
   - Set up staging environment
   - Implement blue-green deployment

4. **Documentation**
   - Document API endpoints
   - Create runbooks for common issues
   - Document escalation procedures

5. **Scaling Preparation**
   - Configure auto-scaling rules
   - Set up load balancers
   - Plan capacity upgrades

---

## 📞 Support Resources

### DigitalOcean Documentation
- [App Platform Documentation](https://docs.digitalocean.com/products/app-platform/)
- [Deploying with Git](https://docs.digitalocean.com/products/app-platform/how-to/deploy-with-git/)
- [Environment Variables](https://docs.digitalocean.com/products/app-platform/how-to/configure-apps/#environment-variables)

### Supabase Documentation
- [Project Settings](https://supabase.com/docs/guides/platform/projects)
- [Database Backup](https://supabase.com/docs/guides/platform/backups)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

### ChainReactions Backend
- Repository: `/Users/kanbei/Code/chainreactions_backend`
- Architecture Documentation: `CLAUDE.md`
- Deployment Scripts: `./scripts/`

---

**Last Updated:** 2025-12-31
**Deployment Status:** Ready for Production
**Node.js Version:** 20-alpine
**Services:** 6 microservices + Redis
