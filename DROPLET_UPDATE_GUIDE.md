# DigitalOcean Droplet 更新部署指南

## 📋 更新脚本使用方法

### 方式1：使用自动化脚本（推荐）

自动化脚本已经创建：`DROPLET_UPDATE_SCRIPT.sh`

#### 步骤1：上传脚本到Droplet

从本地执行：
```bash
# 替换为你的Droplet IP
scp DROPLET_UPDATE_SCRIPT.sh root@your-droplet-ip:/home/chainreactions/

# 或者使用DigitalOcean控制台上传
```

#### 步骤2：SSH连接到Droplet

```bash
ssh root@your-droplet-ip
```

#### 步骤3：执行更新脚本

```bash
cd /home/chainreactions/app
bash /home/chainreactions/DROPLET_UPDATE_SCRIPT.sh
```

**脚本会自动完成：**
1. ✅ 备份当前配置（.env和docker-compose.yml）
2. ✅ 从GitHub拉取最新代码
3. ✅ 检查并添加缺失的环境变量（JWT_SECRET等）
4. ✅ 移除docker-compose.yml中过时的version属性
5. ✅ 停止所有容器
6. ✅ 重新构建Docker镜像（5-15分钟）
7. ✅ 启动所有服务
8. ✅ 验证健康状态

**预期输出：**
```
========================================
   ChainReactions Backend 更新脚本
========================================
开始时间: 2025-12-31 ...

[SUCCESS] ✅ .env 文件已备份
[SUCCESS] ✅ 代码更新完成
[SUCCESS] ✅ JWT_SECRET 已生成并添加
[SUCCESS] ✅ 镜像构建完成 (耗时: 8分23秒)
[SUCCESS] ✅ 所有服务已启动

✅ Port 3002: healthy
✅ Port 3003: healthy
✅ Port 3004: healthy
✅ Port 3005: healthy
✅ Port 3006: healthy
✅ Port 3007: healthy

🎉 所有服务都运行正常！
```

---

### 方式2：手动执行（适合需要更多控制）

如果你希望逐步执行每个步骤，可以参考以下命令：

#### 步骤1：备份配置文件
```bash
cd /home/chainreactions/app
BACKUP_DIR="/home/chainreactions/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR
cp .env $BACKUP_DIR/.env.backup
cp docker-compose.yml $BACKUP_DIR/docker-compose.yml.backup
echo "备份完成: $BACKUP_DIR"
```

#### 步骤2：拉取最新代码
```bash
git fetch railway main
git reset --hard railway/main
git log --oneline -3
```

#### 步骤3：检查环境变量
```bash
# 检查JWT_SECRET
cat .env | grep JWT_SECRET

# 如果缺失，生成并添加
openssl rand -base64 32  # 生成JWT_SECRET
openssl rand -base64 32  # 生成REFRESH_TOKEN_SECRET

# 编辑.env文件添加变量
nano .env
```

#### 步骤4：更新docker-compose.yml
```bash
# 移除version属性（如果存在）
sed -i '/^version:/d' docker-compose.yml

# 验证语法
docker compose config
```

#### 步骤5：停止并重建
```bash
docker compose down
docker compose build --no-cache
```

#### 步骤6：启动服务
```bash
docker compose up -d
sleep 30
docker compose ps
```

#### 步骤7：验证健康状态
```bash
curl http://localhost:3002/api/health
curl http://localhost:3003/api/health
curl http://localhost:3004/api/health
curl http://localhost:3005/api/health
curl http://localhost:3006/api/health
curl http://localhost:3007/api/health
```

---

## 🔧 常见问题

### Q1: 脚本执行失败怎么办？

**A:** 脚本会自动备份配置文件，如果失败可以回滚：
```bash
# 查看备份
ls /home/chainreactions/backups/

# 回滚到之前的代码
git log --oneline -10  # 找到之前的commit
git reset --hard <previous-commit-hash>

# 恢复.env文件
cp /home/chainreactions/backups/<timestamp>/.env.backup .env

# 重新构建和启动
docker compose build
docker compose up -d
```

### Q2: 构建时间太长怎么办？

**A:** 正常情况构建需要5-15分钟。如果你想加快速度：
- 升级Droplet规格（更多CPU）
- 或者使用缓存构建（修改脚本中的 `--no-cache` 参数）

### Q3: 服务显示unhealthy怎么办？

**A:** 查看服务日志找出原因：
```bash
# 查看所有服务日志
docker compose logs

# 查看特定服务日志
docker compose logs user-management
docker compose logs entity-relations

# 实时跟踪日志
docker compose logs -f <service-name>
```

### Q4: 缺少其他环境变量怎么办？

**A:** 检查并添加缺失的变量：
```bash
# 检查.env文件
cat .env | grep -E "GEMINI_API_KEY|BRIGHT_DATA_API_KEY|LINKUP_API_KEY"

# 编辑.env文件
nano .env

# 添加缺失的变量后重启服务
docker compose down
docker compose up -d
```

---

## 📊 更新后验证清单

更新完成后，请验证以下项目：

- [ ] 所有容器状态为 "running" 或 "healthy"
- [ ] 所有健康检查端点返回200 OK
- [ ] 日志中没有ERROR级别的消息
- [ ] 所有环境变量正确设置
- [ ] Redis显示healthy状态
- [ ] 没有容器反复重启

---

## 🔄 如果更新失败

### 回滚步骤：

1. **停止所有容器**
   ```bash
   docker compose down
   ```

2. **恢复之前的代码**
   ```bash
   # 脚本会显示回滚commit
   git reset --hard <before-commit-hash>
   ```

3. **恢复.env文件**
   ```bash
   cp /home/chainreactions/backups/<timestamp>/.env.backup .env
   ```

4. **重新构建和启动**
   ```bash
   docker compose build
   docker compose up -d
   ```

5. **验证回滚成功**
   ```bash
   docker compose ps
   curl http://localhost:3002/api/health
   ```

---

## 💡 提示

1. **定期更新**：建议每周或每月执行一次更新
2. **监控日志**：更新后持续监控日志15-30分钟
3. **保持备份**：每次更新都会自动备份，可以随时回滚
4. **检查磁盘空间**：构建镜像需要一定空间，确保Droplet有足够空间

---

## 📞 需要帮助？

如果遇到问题，可以：
1. 查看详细日志：`docker compose logs -f`
2. 检查系统资源：`free -h` 和 `df -h`
3. 查看容器状态：`docker compose ps` 和 `docker stats`

---

**创建时间：** 2025-12-31
**脚本位置：** `/Users/kanbei/Code/chainreactions_backend/DROPLET_UPDATE_SCRIPT.sh`
**Droplet目录：** `/home/chainreactions/app`
