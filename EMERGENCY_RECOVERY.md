# 🚨 Emergency Recovery Guide - Docker Build Issues

> **当 Docker 构建卡住或失败时使用本指南**

---

## 当前问题：构建卡在 36/61 步骤

### 症状
- Docker build 在某个步骤卡住不动
- 内存占用高或磁盘空间不足
- 构建时间超过预期（>15分钟无进展）

---

## 📋 立即执行（在服务器上）

### 步骤1：停止当前构建
```bash
# 按 Ctrl+C 停止当前运行的 deploy.sh
# 或者在另一个终端强制停止
pkill -f "docker compose build"
pkill -f "docker-compose build"
```

### 步骤2：检查资源状态
```bash
# 检查磁盘空间
df -h

# 检查内存使用
free -h

# 检查 Docker 磁盘占用
docker system df
```

### 步骤3：清理 Docker 资源
```bash
# 停止所有容器
docker compose down

# 清理所有未使用的资源（包括镜像、容器、网络、缓存）
docker system prune -af --volumes

# 清理构建缓存
docker builder prune -af

# 验证清理效果
docker system df
```

**预期释放空间**：几百MB到几GB不等

### 步骤4：拉取最新代码
```bash
# 进入项目目录
cd /home/chainreactions/app

# 拉取最新的优化版本
git pull origin main

# 验证最新 commit
git log -1 --oneline
# 应该看到：db81359a 🔧 Optimize Docker build for resource-constrained servers
```

### 步骤5：重新部署（新的顺序构建方式）
```bash
# 执行优化后的部署脚本
./deploy.sh
```

**新的构建流程**：
- ✅ 自动清理 Docker 缓存
- ✅ 显示可用磁盘和内存
- ✅ 顺序构建服务（redis → entity-relations → entity-search → dataset-matching → data-management → dataset-search）
- ✅ 每个服务独立构建，显示清晰进度
- ✅ 构建失败时自动报告失败服务

**预期时间**：15-20分钟

---

## 🔍 如果仍然失败

### 方法A：手动清理后重试
```bash
# 删除所有镜像（包括正在使用的）
docker compose down
docker rmi -f $(docker images -q)

# 重新构建
./deploy.sh
```

### 方法B：逐个服务手动构建
```bash
# 清理环境
docker compose down
docker system prune -af

# 逐个构建服务
docker compose build redis
docker compose build entity-relations
docker compose build entity-search
docker compose build dataset-matching
docker compose build data-management
docker compose build dataset-search

# 启动所有服务
docker compose up -d

# 等待60秒
sleep 60

# 检查健康状态
docker compose ps
curl http://localhost:3002/api/health
curl http://localhost:3003/api/health
curl http://localhost:3004/api/health
curl http://localhost:3005/api/health
curl http://localhost:3006/api/health
```

### 方法C：增加交换空间（如果内存不足）
```bash
# 检查当前交换空间
swapon --show

# 创建 2GB 交换文件
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 验证交换空间
free -h

# 重新运行部署
./deploy.sh

# 部署完成后可选：移除交换文件
sudo swapoff /swapfile
sudo rm /swapfile
```

---

## 📊 诊断命令速查表

### Docker 资源占用
```bash
# 查看 Docker 磁盘占用
docker system df -v

# 查看容器资源使用
docker stats --no-stream

# 查看所有镜像大小
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# 查看构建历史
docker history chainreactions-entity-relations:latest
```

### 系统资源
```bash
# CPU 和内存
top -bn1 | head -20

# 磁盘使用
df -h /

# 内存详情
free -m

# 进程列表
ps aux | grep docker
```

### 构建日志
```bash
# 查看详细构建日志
docker compose build entity-relations --progress=plain

# 查看容器日志
docker compose logs entity-relations
docker compose logs dataset-matching
```

---

## 🎯 常见错误及解决方案

### 错误1：`no space left on device`
**原因**：磁盘空间不足

**解决**：
```bash
# 清理 Docker
docker system prune -af --volumes
docker builder prune -af

# 清理系统日志
sudo journalctl --vacuum-time=3d

# 清理 APT 缓存（Ubuntu/Debian）
sudo apt-get clean
```

### 错误2：`Cannot allocate memory`
**原因**：内存不足

**解决**：
```bash
# 方法1: 添加交换空间（见上文方法C）

# 方法2: 重启 Docker 服务
sudo systemctl restart docker

# 方法3: 减少并发（已在新版本deploy.sh中实现）
```

### 错误3：构建卡住不动超过10分钟
**原因**：网络问题或资源耗尽

**解决**：
```bash
# 停止构建
pkill -f "docker compose build"

# 清理资源
docker system prune -af

# 重启 Docker
sudo systemctl restart docker

# 重新构建
./deploy.sh
```

### 错误4：`failed to compute cache key: "/tsconfig.json": not found`
**原因**：.dockerignore 排除了必需文件（已修复）

**解决**：
```bash
# 拉取最新代码（包含修复）
git pull origin main

# 验证修复
grep -n "tsconfig.json" services/entity-relations/.dockerignore
# 不应该找到该行

# 重新构建
./deploy.sh
```

---

## ✅ 验证部署成功

### 快速验证
```bash
# 检查所有容器状态
docker compose ps

# 应该看到6个服务都是 "Up (healthy)"
```

### 完整验证
```bash
# 运行完整测试套件
./test_deployment.sh

# 预期结果：所有测试通过 ✅
```

### 手动验证各服务
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

# Redis
docker compose exec redis redis-cli ping
```

**预期响应**：所有服务返回 200 OK + 健康状态 JSON

---

## 📞 需要更多帮助？

### 收集诊断信息
```bash
# 生成完整诊断报告
{
  echo "=== System Info ==="
  uname -a
  echo ""
  echo "=== Docker Version ==="
  docker --version
  docker compose version
  echo ""
  echo "=== Disk Usage ==="
  df -h
  echo ""
  echo "=== Memory Usage ==="
  free -h
  echo ""
  echo "=== Docker System Info ==="
  docker system df
  echo ""
  echo "=== Container Status ==="
  docker compose ps
  echo ""
  echo "=== Recent Logs ==="
  docker compose logs --tail=50
} > /tmp/diagnostic_report.txt

# 查看报告
cat /tmp/diagnostic_report.txt
```

### 回滚到备份
```bash
# 查找最近的备份
ls -lh /root/backups/

# 恢复备份（替换时间戳）
BACKUP_DIR="/root/backups/chainreactions_YYYYMMDD_HHMMSS"

# 停止服务
docker compose down

# 恢复环境变量
cp "$BACKUP_DIR/.env.backup" .env

# 恢复 Redis 数据
docker run --rm -v chainreactions-redis-data:/data -v "$BACKUP_DIR":/backup alpine \
  tar xzf /backup/redis-data.tar.gz -C /data

# 重新启动
docker compose up -d
```

---

## 🔄 优化建议

### 长期解决方案

1. **升级服务器配置**
   - 建议：至少 4GB RAM + 40GB 磁盘
   - 当前最低要求：2GB RAM + 20GB 磁盘

2. **定期清理**
   ```bash
   # 添加到 crontab，每周清理一次
   0 3 * * 0 docker system prune -af
   ```

3. **监控资源使用**
   ```bash
   # 实时监控
   watch -n 5 'docker stats --no-stream'
   ```

4. **使用 Docker Hub 缓存**
   ```bash
   # 配置 Docker Hub 镜像加速（可选）
   # 编辑 /etc/docker/daemon.json
   {
     "registry-mirrors": ["https://mirror.gcr.io"]
   }
   ```

---

**最后更新**：2025年10月20日
**版本**：4.0.1 - Resource-Optimized Build
**目标**：DigitalOcean Docker with Limited Resources

---

## 📝 变更日志

- **2025-10-20**：添加顺序构建优化，解决并行构建内存问题
- **2025-10-20**：添加自动资源清理步骤
- **2025-10-20**：修复 tsconfig.json .dockerignore 问题
