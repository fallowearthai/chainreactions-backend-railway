# 🚀 ChainReactions Backend - 部署快速参考

## 📋 部署前准备

### 1. 环境要求
- ✅ Docker Engine 20.10+
- ✅ Docker Compose 2.0+
- ✅ 至少 2GB RAM
- ✅ 至少 10GB 磁盘空间
- ✅ SSH访问权限到服务器

### 2. 所需API密钥
确保你有以下API密钥:
- `GEMINI_API_KEY` - Google Gemini AI
- `BRIGHT_DATA_API_KEY` + `BRIGHT_DATA_SERP_ZONE` - Bright Data SERP
- `LINKUP_API_KEY` - Linkup API (主要)
- `LINKUP_API_KEY_2` - Linkup API (次要)
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` - Supabase数据库

---

## 🚀 一键部署

### 自动化部署脚本
```bash
# SSH连接到DigitalOcean服务器
ssh root@your-server-ip

# 进入项目目录
cd /path/to/chainreactions_backend_railway

# 给脚本添加执行权限
chmod +x deploy.sh

# 执行部署
./deploy.sh
```

部署脚本会自动完成:
- ✅ 环境检查
- ✅ 自动备份
- ✅ 停止旧服务
- ✅ 拉取最新代码
- ✅ 构建Docker镜像
- ✅ 启动所有微服务
- ✅ 健康检查验证
- ✅ 资源监控
- ✅ 清理旧镜像

---

## 🧪 部署后测试

### 运行测试脚本
```bash
# 给测试脚本添加执行权限
chmod +x test_deployment.sh

# 运行完整测试套件
./test_deployment.sh
```

测试包括:
- ✅ 容器健康检查
- ✅ 健康端点测试
- ✅ Redis连接测试
- ✅ 网络连通性测试
- ✅ 资源使用分析
- ✅ 日志错误检查
- ✅ API功能测试

---

## 🔧 手动部署步骤

如果你偏好手动控制,按以下步骤操作:

### 步骤 1: 备份当前部署
```bash
# 创建备份目录
BACKUP_DIR="/root/backups/chainreactions_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 备份环境变量
cp .env "$BACKUP_DIR/.env.backup"

# 备份日志
docker-compose logs --no-color > "$BACKUP_DIR/logs.txt"

# 备份Redis数据
docker run --rm -v chainreactions-redis-data:/data -v "$BACKUP_DIR":/backup alpine \
  tar czf /backup/redis-data.tar.gz -C /data .
```

### 步骤 2: 停止旧服务
```bash
docker-compose down
```

### 步骤 3: 拉取最新代码
```bash
git pull origin main
```

### 步骤 4: 配置环境变量
```bash
# 如果是首次部署
cp .env.docker.example .env
nano .env  # 填入你的API密钥

# 如果是更新部署
# 环境变量已经存在,无需修改
```

### 步骤 5: 构建镜像
```bash
# 并行构建所有服务(更快)
docker-compose build --parallel

# 或者单独构建某个服务
docker-compose build entity-relations
```

### 步骤 6: 启动服务
```bash
# 后台启动所有服务
docker-compose up -d

# 查看启动日志
docker-compose logs -f
```

### 步骤 7: 验证部署
```bash
# 等待60秒让服务启动
sleep 60

# 检查所有容器状态
docker-compose ps

# 测试健康端点
curl http://localhost:3002/api/health  # Entity Relations
curl http://localhost:3003/api/health  # Entity Search
curl http://localhost:3004/api/health  # Dataset Matching
curl http://localhost:3005/api/health  # Data Management
curl http://localhost:3006/api/health  # Dataset Search

# 测试Redis
docker-compose exec redis redis-cli ping
```

---

## 📊 服务管理命令

### 查看状态
```bash
# 查看所有容器状态
docker-compose ps

# 查看资源使用
docker stats

# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f entity-relations
docker-compose logs -f entity-search
docker-compose logs -f dataset-matching
docker-compose logs -f data-management
docker-compose logs -f dataset-search
docker-compose logs -f redis
```

### 重启服务
```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart entity-relations
docker-compose restart entity-search
docker-compose restart dataset-matching
docker-compose restart data-management
docker-compose restart dataset-search
docker-compose restart redis
```

### 停止服务
```bash
# 停止所有服务
docker-compose down

# 停止但保留数据卷
docker-compose stop

# 停止特定服务
docker-compose stop entity-relations
```

### 更新服务
```bash
# 拉取最新代码
git pull origin main

# 重新构建并重启特定服务
docker-compose up -d --build entity-relations

# 重新构建并重启所有服务
docker-compose up -d --build
```

---

## 🚨 故障排查

### 服务启动失败
```bash
# 查看具体错误日志
docker-compose logs entity-relations

# 检查环境变量
docker-compose config

# 检查容器内的环境变量
docker-compose exec entity-relations env | grep API_KEY

# 重新构建并启动
docker-compose up -d --build entity-relations
```

### Redis连接问题
```bash
# 检查Redis状态
docker-compose logs redis

# 测试Redis连接
docker-compose exec redis redis-cli ping

# 查看Redis内存使用
docker-compose exec redis redis-cli info memory

# 重启Redis
docker-compose restart redis
```

### 端口冲突
```bash
# 检查端口占用
netstat -tulpn | grep 3002
netstat -tulpn | grep 3003
netstat -tulpn | grep 3004
netstat -tulpn | grep 3005
netstat -tulpn | grep 3006
netstat -tulpn | grep 6379

# 杀掉占用端口的进程
kill -9 <PID>

# 重启Docker服务
docker-compose down
docker-compose up -d
```

### 内存不足
```bash
# 查看系统内存
free -h

# 查看容器内存使用
docker stats

# 清理Redis缓存
docker-compose exec redis redis-cli FLUSHDB

# 重启服务释放内存
docker-compose restart
```

### 磁盘空间不足
```bash
# 查看磁盘使用
docker system df

# 清理未使用的镜像
docker image prune -a -f

# 清理未使用的容器
docker container prune -f

# 清理未使用的卷
docker volume prune -f

# 清理所有未使用的资源
docker system prune -a -f
```

---

## 🔄 回滚部署

如果新版本有问题,快速回滚:

```bash
# 1. 停止当前服务
docker-compose down

# 2. 恢复备份的.env
BACKUP_DIR="/root/backups/chainreactions_YYYYMMDD_HHMMSS"
cp "$BACKUP_DIR/.env.backup" .env

# 3. 回退Git提交(如果需要)
git log  # 找到之前的commit hash
git checkout <previous-commit-hash>

# 4. 恢复Redis数据(如果需要)
docker run --rm -v chainreactions-redis-data:/data -v "$BACKUP_DIR":/backup alpine \
  tar xzf /backup/redis-data.tar.gz -C /data

# 5. 重新构建并启动
docker-compose up -d --build

# 6. 验证回滚
docker-compose ps
curl http://localhost:3002/api/health
```

---

## 📈 性能监控

### 实时监控
```bash
# 查看容器资源使用
docker stats

# 持续监控日志
docker-compose logs -f --tail=100

# 监控Redis命令
docker-compose exec redis redis-cli monitor

# 查看Redis缓存统计
docker-compose exec redis redis-cli info stats
```

### 性能指标
```bash
# Redis内存使用
docker-compose exec redis redis-cli info memory | grep used_memory_human

# Redis连接客户端数
docker-compose exec redis redis-cli info clients | grep connected_clients

# Redis缓存命中率
docker-compose exec redis redis-cli info stats | grep keyspace_hits
docker-compose exec redis redis-cli info stats | grep keyspace_misses

# 容器启动时间
docker-compose ps -a
```

---

## 🔐 生产环境安全建议

### 1. 移除Redis外部端口暴露
编辑 `docker-compose.yml`:
```yaml
redis:
  # 注释掉以下行
  # ports:
  #   - "6379:6379"
```

### 2. 设置Redis密码
编辑 `redis.conf`:
```conf
requirepass your_strong_redis_password_here
```

更新 `docker-compose.yml`:
```yaml
environment:
  - REDIS_PASSWORD=your_strong_redis_password_here
```

### 3. 限制日志大小
编辑 `docker-compose.yml`:
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 4. 设置资源限制
编辑 `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
    reservations:
      cpus: '0.5'
      memory: 256M
```

---

## 📞 获取帮助

### 检查点清单
- [ ] 所有5个微服务容器状态为 "Up (healthy)"
- [ ] Redis容器状态为 "Up (healthy)"
- [ ] 所有健康端点返回200状态码
- [ ] Redis PING命令返回PONG
- [ ] 无错误日志或异常
- [ ] 资源使用在正常范围内
- [ ] API功能测试通过

### 日志收集
如果需要支持,收集以下信息:
```bash
# 系统信息
uname -a
docker --version
docker-compose --version

# 容器状态
docker-compose ps

# 日志
docker-compose logs > deployment_logs.txt

# 资源使用
docker stats --no-stream > resource_usage.txt

# 环境配置(移除敏感信息)
docker-compose config > config.txt
```

---

## 📝 版本信息

- **架构版本**: 4.0.0 (微服务架构)
- **更新日期**: 2025年10月20日
- **部署目标**: DigitalOcean Docker
- **服务数量**: 5个微服务 + Redis

---

**下一步**: 更新前端配置,使其连接到新的微服务端口(3002-3006)
