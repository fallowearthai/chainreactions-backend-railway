# DigitalOcean Environment Variables Checklist

**Use this checklist when configuring environment variables in DigitalOcean App Platform.**

---

## 🔑 Entity Relations Service (Port 3002)

| Variable Name | Value | Sensitive | Notes |
|--------------|-------|-----------|-------|
| GEMINI_API_KEY | your_gemini_api_key | ✅ Yes | Get from Google AI Studio |
| BRIGHT_DATA_API_KEY | your_bright_data_api_key | ✅ Yes | Get from Bright Data dashboard |
| BRIGHT_DATA_SERP_ZONE | your_serp_zone_name | ❌ No | SERP zone name in Bright Data |
| REDIS_HOST | redis | ❌ No | If using Redis |
| REDIS_PORT | 6379 | ❌ No | Default Redis port |
| REDIS_PASSWORD | your_redis_password | ✅ Yes | Optional but recommended |
| NODE_ENV | production | ❌ No | Required |
| PORT | 3002 | ❌ No | Required |
| ENABLE_ENHANCED_GROUNDING | true | ❌ No | Feature flag |
| GROUNDING_CONFIDENCE_THRESHOLD | 0.7 | ❌ No | 0.0 to 1.0 |

---

## 🔑 Entity Search Service (Port 3003)

| Variable Name | Value | Sensitive | Notes |
|--------------|-------|-----------|-------|
| LINKUP_API_KEY | your_linkup_api_key | ✅ Yes | Get from Linkup dashboard |
| LINKUP_BASE_URL | https://api.linkup.ai | ❌ No | Default API URL |
| NODE_ENV | production | ❌ No | Required |
| PORT | 3003 | ❌ No | Required |

---

## 🔑 Dataset Matching Service (Port 3004)

| Variable Name | Value | Sensitive | Notes |
|--------------|-------|-----------|-------|
| SUPABASE_URL | your_supabase_project_url | ✅ Yes | Get from Supabase project settings |
| SUPABASE_ANON_KEY | your_supabase_anon_key | ✅ Yes | Get from Supabase project settings |
| REDIS_HOST | redis | ❌ No | If using Redis |
| REDIS_PORT | 6379 | ❌ No | Default Redis port |
| REDIS_PASSWORD | your_redis_password | ✅ Yes | Optional but recommended |
| NODE_ENV | production | ❌ No | Required |
| PORT | 3004 | ❌ No | Required |

---

## 🔑 Data Management Service (Port 3005)

| Variable Name | Value | Sensitive | Notes |
|--------------|-------|-----------|-------|
| SUPABASE_URL | your_supabase_project_url | ✅ Yes | Same as Dataset Matching |
| SUPABASE_SERVICE_ROLE_KEY | your_supabase_service_role_key | ✅ Yes | Get from Supabase project settings |
| UPLOAD_PATH | /app/uploads | ❌ No | File upload directory |
| NODE_ENV | production | ❌ No | Required |
| PORT | 3005 | ❌ No | Required |

---

## 🔑 Dataset Search Service (Port 3006)

| Variable Name | Value | Sensitive | Notes |
|--------------|-------|-----------|-------|
| SUPABASE_URL | your_supabase_project_url | ✅ Yes | Same as Dataset Matching |
| SUPABASE_ANON_KEY | your_supabase_anon_key | ✅ Yes | Same as Dataset Matching |
| LINKUP_API_KEY_2 | your_second_linkup_api_key | ✅ Yes | Different from Entity Search |
| NODE_ENV | production | ❌ No | Required |
| PORT | 3006 | ❌ No | Required |

---

## 🔑 User Management Service (Port 3007)

| Variable Name | Value | Sensitive | Notes |
|--------------|-------|-----------|-------|
| SUPABASE_URL | your_supabase_project_url | ✅ Yes | Same as other services |
| SUPABASE_ANON_KEY | your_supabase_anon_key | ✅ Yes | Same as other services |
| SUPABASE_SERVICE_ROLE_KEY | your_supabase_service_role_key | ✅ Yes | Same as Data Management |
| JWT_SECRET | generate_random_32_chars | ✅ Yes | Min 32 characters, use password manager |
| REFRESH_TOKEN_SECRET | generate_random_32_chars | ✅ Yes | Min 32 characters, different from JWT_SECRET |
| FRONTEND_URL | https://chainreactions.site | ❌ No | Production frontend URL |
| ALLOWED_ORIGINS | https://chainreactions.site,https://www.chainreactions.site,https://chainreactions-frontend-dev.vercel.app | ❌ No | Comma-separated CORS origins |
| NODE_ENV | production | ❌ No | Required |
| PORT | 3007 | ❌ No | Required |

---

## 🔑 Redis (Shared Cache)

| Variable Name | Value | Sensitive | Notes |
|--------------|-------|-----------|-------|
| REDIS_HOST | redis | ❌ No | Service name or IP |
| REDIS_PORT | 6379 | ❌ No | Default Redis port |
| REDIS_PASSWORD | your_redis_password | ✅ Yes | Optional but recommended |

---

## 📋 How to Get API Keys

### Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create new API key
4. Copy and save securely

### Bright Data API Key
1. Log in to [Bright Data dashboard](https://brightdata.com)
2. Go to API & Management
3. Create API key
4. Configure SERP zone and note zone name

### Linkup API Key
1. Go to [Linkup](https://linkup.ai)
2. Sign up for account
3. Get API key from dashboard
4. You need 2 different keys for Entity Search and Dataset Search

### Supabase Credentials
1. Go to [Supabase dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings → API
4. Copy:
   - Project URL (SUPABASE_URL)
   - anon/public key (SUPABASE_ANON_KEY)
   - service_role key (SUPABASE_SERVICE_ROLE_KEY)

### Generate JWT Secrets
Use a secure random generator:
```bash
# Generate 32-character random string
openssl rand -base64 32
# or
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Generate 2 different secrets:
- JWT_SECRET (for access tokens)
- REFRESH_TOKEN_SECRET (for refresh tokens)

---

## ✅ Pre-Deployment Verification

Before deploying, verify you have:

- [ ] Gemini API key
- [ ] Bright Data API key
- [ ] Bright Data SERP zone name
- [ ] Linkup API key #1 (for Entity Search)
- [ ] Linkup API key #2 (for Dataset Search)
- [ ] Supabase project URL
- [ ] Supabase anon key
- [ ] Supabase service_role key
- [ ] JWT_SECRET (32+ characters)
- [ ] REFRESH_TOKEN_SECRET (32+ characters)
- [ ] Redis password (if using Redis)

---

## 🔒 Security Reminders

### DO ✅
- Use DigitalOcean encrypted environment variables for all sensitive data
- Generate new random secrets for each deployment
- Use different API keys for development and production
- Rotate secrets periodically (recommended: every 90 days)
- Store secrets in a secure password manager

### DO NOT ❌
- Don't commit real API keys to git
- Don't share secrets via email, chat, or tickets
- Don't use the same secrets across environments
- Don't use weak or predictable secrets
- Don't hardcode secrets in code

---

## 🚀 Deployment Order

Deploy services in this order to minimize errors:

1. **First** - User Management (3007)
   - Required by: All other services (for authentication)

2. **Second** - Data Management (3005)
   - Required by: Dataset Matching, Dataset Search

3. **Third** - Dataset Matching (3004)
   - Requires: Supabase, Redis

4. **Fourth** - Dataset Search (3006)
   - Requires: Supabase, Linkup API

5. **Fifth** - Entity Search (3003)
   - Requires: Linkup API

6. **Last** - Entity Relations (3002)
   - Requires: Gemini, Bright Data

7. **After all services** - Configure Redis
   - Update Redis connection strings in services if needed

---

## 🧪 Testing Environment Variables

After deployment, test that variables are correctly set:

```bash
# Test each service health endpoint
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
  "port": 3002
}
```

If you get errors:
1. Check service logs in DigitalOcean dashboard
2. Verify environment variables are set
3. Ensure API keys are valid and not expired
4. Check database connectivity

---

**Last Updated:** 2025-12-31
**Total Services:** 6 microservices + Redis
**Total Environment Variables:** ~40 variables
**Sensitive Variables:** 14 variables (mark as encrypted in DigitalOcean)
