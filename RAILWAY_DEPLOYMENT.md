# 🚀 ChainReactions Backend 部署指南

**GitHub仓库**: https://github.com/fallowearthai/chainreactions-backend-railway.git

**代码已成功推送！✅**

---

## 📋 快速开始

### 方案选择

- **Railway** (推荐⭐): 最简单，5分钟完成部署，自动扩展
- **DigitalOcean**: 更多控制，成本更低，需要服务器管理经验

---

## 🎯 方案1: Railway部署 (推荐，5分钟)

### 为什么选择Railway?

✅ **零配置** - 自动检测Docker配置
✅ **一键部署** - 从GitHub直接部署
✅ **自动扩展** - 根据流量自动扩展
✅ **免费额度** - 每月$5免费额度
✅ **自动HTTPS** - 自动配置SSL证书
✅ **内置监控** - 日志、指标、警报

### 部署步骤

#### 1️⃣ 访问Railway

访问 https://railway.app/ 并登录（使用GitHub账号）

#### 2️⃣ 创建新项目

1. 点击 **"New Project"** 按钮
2. 选择 **"Deploy from GitHub repo"**
3. 找到并选择: `fallowearthai/chainreactions-backend-railway`
4. 点击 **"Import"**

#### 3️⃣ 配置服务

Railway会自动识别7个服务:

- ✅ entity-relations (端口 3002)
- ✅ entity-search (端口 3003)
- ✅ dataset-matching (端口 3004)
- ✅ data-management (端口 3005)
- ✅ dataset-search (端口 3006)
- ✅ user-management (端口 3007)
- ✅ redis (端口 6379)

#### 4️⃣ 设置环境变量

在Railway控制台，为每个服务添加环境变量：

**Entity Relations**:
```bash
GEMINI_API_KEY=your_gemini_api_key
BRIGHT_DATA_API_KEY=your_bright_data_key
BRIGHT_DATA_SERP_ZONE=your_serp_zone
ENABLE_ENHANCED_GROUNDING=true
ENABLE_DEEP_THINKING=true
NODE_ENV=production
REDIS_URL=redis://default:<password>@<hostname>:6379
```

**Entity Search**:
```bash
LINKUP_API_KEY=your_linkup_api_key
LINKUP_BASE_URL=https://api.linkup.ai
NODE_ENV=production
REDIS_URL=redis://default:<password>@<hostname>:6379
```

**Dataset Matching**:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
NODE_ENV=production
REDIS_URL=redis://default:<password>@<hostname>:6379
```

**Data Management**:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
UPLOAD_PATH=/tmp/uploads
NODE_ENV=production
REDIS_URL=redis://default:<password>@<hostname>:6379
```

**Dataset Search**:
```bash
LINKUP_API_KEY_2=your_linkup_api_key_2
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
NODE_ENV=production
REDIS_URL=redis://default:<password>@<hostname>:6379
```

**User Management**:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_jwt_secret_min_32_chars
NODE_ENV=production
REDIS_URL=redis://default:<password>@<hostname>:6379
```

**Redis**:
- 无需配置，Railway自动管理

#### 5️⃣ 部署

1. 点击每个服务的 **"Deploy"** 按钮
2. 等待构建完成（约5-10分钟）
3. 查看日志确认无错误

#### 6️⃣ 获取服务URL

部署完成后，Railway会生成公网URL：

```
https://entity-relations-production.up.railway.app
https://entity-search-production.up.railway.app
https://dataset-matching-production.up.railway.app
https://data-management-production.up.railway.app
https://dataset-search-production.up.railway.app
https://user-management-production.up.railway.app
```

#### 7️⃣ 更新前端配置

在前端项目的环境变量中添加Railway域名：

```bash
VITE_API_ENTITY_RELATIONS_URL=https://entity-relations-production.up.railway.app
VITE_API_ENTITY_SEARCH_URL=https://entity-search-production.up.railway.app
VITE_API_DATASET_MATCHING_URL=https://dataset-matching-production.up.railway.app
VITE_API_DATA_MANAGEMENT_URL=https://data-management-production.up.railway.app
VITE_API_DATASET_SEARCH_URL=https://dataset-search-production.up.railway.app
VITE_API_USER_MANAGEMENT_URL=https://user-management-production.up.railway.app
```

#### 8️⃣ 测试部署

```bash
# 测试每个服务
curl https://entity-relations-production.up.railway.app/api/health
curl https://entity-search-production.up.railway.app/api/health
curl https://dataset-matching-production.up.railway.app/api/health
curl https://data-management-production.up.railway.app/api/health
curl https://dataset-search-production.up.railway.app/api/health
curl https://user-management-production.up.railway.app/api/health
```

### Railway费用估算

- **免费额度**: $5/月
- **超出后**: ~$30-50/月（取决于流量）
- **包含**: 容器 + Redis + 数据库

---

## 🖥️ 方案2: DigitalOcean部署 (30分钟)

### 为什么选择DigitalOcean?

✅ **成本更低** - $12/月起
✅ **更多控制** - 完全服务器控制
✅ **固定IP** - 便于配置
✅ **可预测** - 成本可预测

### 部署步骤

#### 1️⃣ 创建Droplet

1. 登录 https://cloud.digitalocean.com/
2. 点击 **"Create"** → **"Droplets"**
3. 选择配置:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic, 2GB RAM, 1 vCPU, 50GB SSD ($12/月)
   - **Region**: 选择离用户最近的区域
   - **Authentication**: SSH Keys (推荐)
4. 点击 **"Create Droplet"**

#### 2️⃣ 连接到Droplet

```bash
ssh root@your-droplet-ip
```

#### 3️⃣ 安装Docker

```bash
# 更新系统
apt update && apt upgrade -y

# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 安装Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

#### 4️⃣ 克隆代码

```bash
cd /root
git clone https://github.com/fallowearthai/chainreactions-backend-railway.git chainreactions_backend
cd chainreactions_backend

# 首次部署需要运行设置脚本
bash scripts/setup-symlinks.sh
node scripts/fix-import-paths-correct.js
```

#### 5️⃣ 配置环境变量

```bash
# 复制环境变量模板
for service in entity-relations entity-search dataset-matching data-management dataset-search user-management; do
  cp services/$service/.env.example services/$service/.env
done

# 编辑每个服务的环境变量
nano services/entity-relations/.env
nano services/entity-search/.env
# ... 依此类推
```

#### 6️⃣ 构建和启动

```bash
# 构建所有服务
docker-compose build

# 启动所有服务
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

#### 7️⃣ 配置Nginx反向代理

```bash
# 安装Nginx
apt install nginx -y

# 创建配置
nano /etc/nginx/sites-available/chainreactions
```

Nginx配置:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Entity Relations
    location /api/entity-relations/ {
        rewrite ^/api/entity-relations/(.*)$ /$1 break;
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Entity Search
    location /api/entity-search/ {
        rewrite ^/api/entity-search/(.*)$ /$1 break;
        proxy_pass http://localhost:3003;
        # ... 相同的proxy设置
    }

    # ... 其他服务类似配置
}

# 启用配置
ln -s /etc/nginx/sites-available/chainreactions /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

#### 8️⃣ 配置SSL证书

```bash
# 安装Certbot
apt install certbot python3-certbot-nginx -y

# 获取SSL证书
certbot --nginx -d your-domain.com

# 自动续期
certbot renew --dry-run
```

#### 9️⃣ 配置防火墙

```bash
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable
```

#### 🔟 设置自动启动

```bash
# 创建systemd服务
nano /etc/systemd/system/chainreactions.service
```

```ini
[Unit]
Description=ChainReactions Backend Services
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/root/chainreactions_backend
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable chainreactions.service
systemctl start chainreactions.service
```

### DigitalOcean费用估算

- **Droplet**: $12/月 (2GB RAM)
- **带宽**: 包含1TB流量
- **总计**: $12/月 + 超出流量费用

---

## 🔍 健康检查

部署完成后，验证所有服务正常运行：

```bash
# 测试所有服务
curl https://your-domain.com/api/health
curl https://your-domain.com:3002/api/health
curl https://your-domain.com:3003/api/health
curl https://your-domain.com:3004/api/health
curl https://your-domain.com:3005/api/health
curl https://your-domain.com:3006/api/health
curl https://your-domain.com:3007/api/health
```

预期响应:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "service": "entity-relations",
  "version": "1.0.0"
}
```

---

## 🛠️ 故障排查

### 问题1: 服务无法启动

**症状**: 服务退出或重启

**解决方案**:
```bash
# 查看日志
docker-compose logs [service-name]

# 检查环境变量
docker-compose exec [service-name] env | grep SUPABASE

# 检查Redis连接
docker-compose logs redis
```

### 问题2: 构建失败

**症状**: docker-compose build 失败

**解决方案**:
```bash
# 确保运行了设置脚本
bash scripts/setup-symlinks.sh
node scripts/fix-import-paths-correct.js

# 清理Docker缓存
docker system prune -a

# 重新构建
docker-compose build --no-cache
```

### 问题3: 内存不足

**症状**: 服务被OOM killer杀掉

**解决方案**:
```bash
# 检查内存
free -h

# 创建swap文件
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 问题4: 无法连接Supabase

**症状**: 日志显示"Supabase connection failed"

**解决方案**:
```bash
# 检查环境变量
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# 测试连接
curl -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/"
```

---

## 📊 监控和维护

### Railway监控

- 访问Railway控制台
- 查看实时日志
- 设置警报和通知
- 监控资源使用

### DigitalOcean监控

```bash
# 查看日志
docker-compose logs -f

# 查看资源使用
htop

# 重启服务
docker-compose restart [service-name]

# 更新代码
git pull
docker-compose build
docker-compose up -d

# 清理
docker system prune -a
```

---

## 📚 相关文档

- **Docker构建修复**: DOCKER_BUILD_FIX.md
- **Railway文档**: https://docs.railway.app/
- **DigitalOcean文档**: https://docs.digitalocean.com/
- **Docker文档**: https://docs.docker.com/
- **Nginx文档**: https://nginx.org/en/docs/

---

## 💡 最佳实践

1. **环境变量** - 使用环境变量管理配置
2. **日志监控** - 定期查看日志
3. **备份** - 定期备份Supabase数据
4. **安全** - 启用HTTPS，配置防火墙
5. **更新** - 保持依赖最新
6. **监控** - 设置资源警报

---

## 🎉 完成！

您的ChainReactions Backend已成功部署！

**下一步**:
1. 测试所有API端点
2. 配置前端连接
3. 设置监控和警报
4. 开始使用！🚀

---

**需要帮助?**
- 查看日志: `docker-compose logs -f`
- 检查文档: DOCKER_BUILD_FIX.md
- GitHub Issues: https://github.com/fallowearthai/chainreactions-backend-railway/issues

**Happy Coding! 💻**
