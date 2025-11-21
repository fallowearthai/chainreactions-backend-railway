# 🔒 DigitalOcean 部署安全配置指南

## 📋 部署前安全检查清单

### ✅ **已修复的配置问题**
- [x] 所有 Dockerfile 端口配置已修复
- [x] user-management 服务已添加到 docker-compose.yml
- [x] Redis 端口外部暴露已移除
- [x] Redis 密码认证已启用
- [x] 所有服务使用正确的端口映射
- [x] 生产环境变量模板已创建

### 🚨 **部署前必须配置的安全项**

#### **1. 环境变量设置**
```bash
# 创建生产环境文件
cp .env.production.example .env

# 设置强密码和密钥
JWT_SECRET=generated_strong_secret_32_chars_minimum
REFRESH_TOKEN_SECRET=generated_strong_secret_32_chars_minimum
REDIS_PASSWORD=generated_strong_redis_password_16_chars_minimum
```

#### **2. API 密钥配置**
- Gemini API Key: 从 Google AI Studio 获取
- Bright Data API Key: 从 Bright Data 控制台获取
- Linkup API Key: 从 Linkup 控制台获取
- Supabase Keys: 从 Supabase 项目设置获取

#### **3. 防火墙配置 (UFW)**
```bash
# 启用 UFW 防火墙
sudo ufw enable

# 只允许必要端口
sudo ufw allow ssh          # SSH (端口 22)
sudo ufw allow 80           # HTTP
sudo ufw allow 443          # HTTPS
sudo ufw allow 3001:3007/tcp # 微服务端口（可选择性暴露）

# 拒绝 Redis 端口（内部使用）
sudo ufw deny 6379
```

#### **4. Docker 网络安全**
- ✅ Redis 只在内部 Docker 网络中可访问
- ✅ 所有容器以非 root 用户运行
- ✅ 使用自定义 Docker 网络隔离

#### **5. SSL/TLS 证书配置**
```bash
# 使用 Let's Encrypt 获取免费证书
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com

# 或使用 DigitalOcean 托管证书
```

## 🔧 **推荐的安全架构**

### **生产环境端口暴露策略**

```yaml
# 对外暴露的服务（通过负载均衡器）
frontend:          3001 → 80/443 (HTTP/HTTPS)
user-management:   3007 → 仅内部访问（API Gateway）

# 微服务端口（仅内部访问）
entity-relations:  3002 → 仅内部
entity-search:     3003 → 仅内部
dataset-matching:  3004 → 仅内部
data-management:   3005 → 仅内部
dataset-search:    3006 → 仅内部
```

### **网络架构图**

```
Internet → [Load Balancer/NGINX] → Frontend (3001)
                              → API Gateway → user-management (3007)
                                            → entity-relations (3002)
                                            → entity-search (3003)
                                            → dataset-matching (3004)
                                            → data-management (3005)
                                            → dataset-search (3006)

Internal Network: Redis (6379) [仅内部访问]
```

## 🛡️ **高级安全配置**

### **1. Nginx 反向代理配置**
```nginx
# /etc/nginx/sites-available/chainreactions
server {
    listen 80;
    server_name your-domain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 配置
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # 前端
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API 路由
    location /api/auth/ {
        proxy_pass http://localhost:3007/;
        proxy_set_header Host $host;
        # ... 其他代理头
    }
}
```

### **2. 速率限制配置**
```bash
# Nginx 速率限制
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

    server {
        location /api/auth/ {
            limit_req zone=auth burst=5 nodelay;
            proxy_pass http://localhost:3007/;
        }

        location /api/ {
            limit_req zone=api burst=20 nodelay;
            # 代理到相应微服务
        }
    }
}
```

### **3. 容器安全扫描**
```bash
# 使用 Docker Scout 扫描安全漏洞
docker scout cview chainreactions-entity-relations:latest

# 使用 Trivy 进行漏洞扫描
trivy image chainreactions-entity-relations:latest
```

### **4. 监控和日志**
```bash
# 设置 logrotate
sudo nano /etc/logrotate.d/chainreactions

/var/log/chainreactions/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}
```

## 🚀 **部署脚本**

### **自动化部署脚本**
```bash
#!/bin/bash
# deploy.sh - DigitalOcean 生产部署脚本

set -e

echo "🚀 开始部署 ChainReactions 后端服务..."

# 检查环境变量
if [ ! -f .env ]; then
    echo "❌ 错误: .env 文件不存在，请先配置环境变量"
    exit 1
fi

# 拉取最新代码
git pull origin main

# 构建并启动服务
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 检查服务状态
sleep 30
docker-compose ps

# 健康检查
echo "🔍 执行健康检查..."
for port in 3002 3003 3004 3005 3006 3007; do
    if curl -f http://localhost:$port/api/health; then
        echo "✅ 端口 $port 服务正常"
    else
        echo "❌ 端口 $port 服务异常"
        exit 1
    fi
done

echo "🎉 部署完成！"
```

## 📊 **监控和维护**

### **关键监控指标**
- 容器资源使用率
- API 响应时间
- 错误率和成功率
- 认证失败次数
- 数据库连接数

### **安全监控**
```bash
# 监控异常登录尝试
sudo journalctl -u sshd | grep "Failed password"

# 监控 Docker 容器异常
docker events --filter event=die

# 监控磁盘使用
df -h
du -sh /var/lib/docker/
```

## 🆘 **故障排除**

### **常见安全问题**
1. **容器无法启动**: 检查环境变量配置
2. **Redis 连接失败**: 验证密码和网络配置
3. **API 调用被拒绝**: 检查速率限制和 CORS 配置
4. **SSL 证书问题**: 验证证书有效期和域名匹配

### **紧急响应**
```bash
# 立即停止所有服务
docker-compose down

# 查看日志
docker-compose logs [service-name]

# 重启特定服务
docker-compose restart [service-name]
```

---

**⚠️ 重要提醒**:
- 在生产环境部署前，务必完成所有安全配置
- 定期更新系统和容器镜像
- 实施备份策略和灾难恢复计划
- 监控安全公告和漏洞更新