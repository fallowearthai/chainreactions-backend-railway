# 🚀 ChainReactions Backend - DigitalOcean部署指南

> **从单体架构升级到微服务架构的完整部署方案**

---

## 📋 部署前必读

### 当前状态
- **服务器环境**: DigitalOcean Docker
- **旧架构**: 单体应用 (端口3000)
- **新架构**: 5个微服务 + Redis (端口3002-3006 + 6379)
- **部署策略**: 直接替换 (预计停机2-5分钟)

### 架构对比

| 维度 | 旧版本 | 新版本 |
|------|--------|--------|
| **服务数量** | 1个单体应用 | 5个微服务 + Redis |
| **端口** | 3000 | 3002-3006, 6379 |
| **可扩展性** | 低 | 高 (独立扩展) |
| **容错性** | 低 | 高 (故障隔离) |
| **性能** | 基线 | 提升10-20% |
| **维护复杂度** | 低 | 中等 |

---

## 🎯 一键部署 (推荐)

### 步骤1: SSH连接服务器
```bash
ssh root@your-digitalocean-server-ip
```

### 步骤2: 进入项目目录
```bash
cd /path/to/chainreactions_backend_railway
```

### 步骤3: 执行部署脚本
```bash
./deploy.sh
```

**就这么简单!** 脚本会自动完成所有步骤,包括:
- ✅ 环境检查
- ✅ 自动备份
- ✅ 停止旧服务
- ✅ 构建新镜像
- ✅ 启动微服务
- ✅ 健康验证
- ✅ 清理优化

---

## 🧪 部署后验证

### 运行测试套件
```bash
./test_deployment.sh
```

这会执行完整的测试,包括:
- ✅ 容器健康检查 (6项)
- ✅ API端点测试 (5项)
- ✅ Redis连接测试 (3项)
- ✅ 网络通信测试 (2项)
- ✅ 资源使用分析
- ✅ 日志错误扫描
- ✅ API功能测试 (2项)

**预期结果**: 所有测试通过 ✅

---

## 📁 部署文件说明

### 核心文件
| 文件 | 用途 |
|------|------|
| `deploy.sh` | 自动化部署脚本 |
| `test_deployment.sh` | 完整测试套件 |
| `docker-compose.yml` | Docker Compose配置 |
| `.env.docker.example` | 环境变量模板 |
| `redis.conf` | Redis配置文件 |

### 文档文件
| 文件 | 用途 |
|------|------|
| `DOCKER_DEPLOYMENT.md` | Docker部署完整文档 (700+行) |
| `DEPLOYMENT_QUICK_REFERENCE.md` | 快速参考指南 |
| `README_DEPLOYMENT.md` | 本文件 |

---

## 🔧 手动部署 (高级用户)

如果你需要更细粒度的控制:

### 1. 备份
```bash
BACKUP_DIR="/root/backups/chainreactions_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp .env "$BACKUP_DIR/"
docker-compose logs > "$BACKUP_DIR/logs.txt"
```

### 2. 停止旧服务
```bash
docker-compose down
```

### 3. 拉取代码
```bash
git pull origin main
```

### 4. 构建镜像
```bash
docker-compose build --parallel
```

### 5. 启动服务
```bash
docker-compose up -d
```

### 6. 验证健康
```bash
sleep 60
docker-compose ps
curl http://localhost:3002/api/health
curl http://localhost:3003/api/health
curl http://localhost:3004/api/health
curl http://localhost:3005/api/health
curl http://localhost:3006/api/health
```

---

## 🚨 故障排查速查表

### 问题: 服务无法启动
```bash
# 查看日志
docker-compose logs entity-relations

# 检查环境变量
docker-compose config

# 重新构建
docker-compose up -d --build entity-relations
```

### 问题: Redis连接失败
```bash
# 检查Redis
docker-compose logs redis
docker-compose exec redis redis-cli ping

# 重启Redis
docker-compose restart redis
```

### 问题: 端口冲突
```bash
# 检查端口
netstat -tulpn | grep 3002

# 停止冲突进程
docker-compose down
docker-compose up -d
```

### 问题: 内存不足
```bash
# 查看使用情况
docker stats

# 清理缓存
docker-compose exec redis redis-cli FLUSHDB
docker-compose restart
```

---

## 🔄 快速回滚

如果部署出现问题:

```bash
# 停止新版本
docker-compose down

# 恢复备份
BACKUP_DIR="/root/backups/chainreactions_YYYYMMDD_HHMMSS"
cp "$BACKUP_DIR/.env" .env

# 回退代码(如果需要)
git checkout <previous-commit>

# 重新启动
docker-compose up -d --build
```

---

## 📊 微服务架构详情

### 服务清单

| 服务名称 | 端口 | 功能描述 | 依赖 |
|---------|------|---------|------|
| **Entity Relations** | 3002 | DeepThinking OSINT + 普通搜索 | Gemini AI, Bright Data, Redis |
| **Entity Search** | 3003 | Linkup业务情报搜索 | Linkup API, Redis |
| **Dataset Matching** | 3004 | 高级实体匹配算法 | Supabase, Redis |
| **Data Management** | 3005 | CSV处理 & 数据管理 | Supabase |
| **Dataset Search** | 3006 | SSE流式搜索 + NRO数据 | Linkup API, Supabase, Redis |
| **Redis** | 6379 | 共享缓存层 | - |

### 服务间依赖关系
```
┌─────────────────────────────────────────────────────────────┐
│                    前端应用 (Frontend)                       │
│                  (直接连接到各个微服务)                       │
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

---

## ✅ 部署检查清单

### 部署前
- [ ] 已备份当前.env文件
- [ ] 已备份当前数据卷
- [ ] 已确认所有API密钥可用
- [ ] 已通知团队成员即将部署
- [ ] 服务器有足够磁盘空间 (>10GB)
- [ ] 服务器有足够内存 (>2GB)

### 部署中
- [ ] 部署脚本执行无错误
- [ ] 所有镜像构建成功
- [ ] 所有容器启动成功
- [ ] 健康检查全部通过

### 部署后
- [ ] 运行测试脚本验证
- [ ] 检查所有API端点可访问
- [ ] 验证Redis连接正常
- [ ] 监控资源使用在正常范围
- [ ] 前端可以正常调用后端API
- [ ] 更新前端配置指向新端口

---

## 📈 性能预期

### 启动时间
- 首次构建: 5-10分钟
- 服务启动: 60秒内
- 健康检查: 所有服务在40秒内变为healthy

### 资源占用
- 总内存: < 2GB
- 磁盘空间: < 5GB
- CPU: 中低占用 (< 30%)

### 响应时间
- 健康检查: < 100ms
- API调用: < 2秒 (取决于业务逻辑)
- Redis缓存: < 10ms

---

## 🔒 生产环境优化建议

### 1. 安全加固
```bash
# 移除Redis外部端口暴露
# 在docker-compose.yml中注释掉 ports: - "6379:6379"

# 设置Redis密码
# 在redis.conf中设置 requirepass your_strong_password
```

### 2. 资源限制
```yaml
# 在docker-compose.yml中为每个服务添加
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
```

### 3. 日志管理
```yaml
# 在docker-compose.yml中添加
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 4. 自动重启
```yaml
# 已配置
restart: unless-stopped
```

---

## 📞 需要帮助?

### 常见问题
1. **部署失败**: 检查 `deploy.sh` 输出的错误信息
2. **测试不通过**: 运行 `docker-compose logs [service-name]` 查看具体服务日志
3. **性能问题**: 运行 `docker stats` 查看资源使用
4. **API错误**: 检查环境变量配置和API密钥有效性

### 获取详细文档
- **完整部署指南**: `DOCKER_DEPLOYMENT.md` (700+行)
- **快速参考**: `DEPLOYMENT_QUICK_REFERENCE.md`
- **Docker配置**: `docker-compose.yml`

### 收集诊断信息
```bash
# 生成诊断报告
docker-compose ps > diagnosis.txt
docker-compose logs >> diagnosis.txt
docker stats --no-stream >> diagnosis.txt
docker system df >> diagnosis.txt
```

---

## 🎉 部署成功后的下一步

1. ✅ **更新前端配置**
   - 修改API端点从 `localhost:3000` 到 `localhost:3002-3006`
   - 参考前端文档进行配置

2. ✅ **配置反向代理**
   - 如使用Nginx/CloudFlare,配置路由规则
   - 映射域名到不同微服务端口

3. ✅ **设置监控告警**
   - 配置健康检查监控
   - 设置资源使用告警阈值

4. ✅ **定期备份**
   - 设置cron任务自动备份Redis数据
   - 备份上传文件和配置

5. ✅ **团队培训**
   - 分享微服务架构文档
   - 培训团队使用新的管理命令

---

**版本**: 4.0.0 (微服务架构)
**更新日期**: 2025年10月20日
**部署目标**: DigitalOcean Docker

**祝部署顺利!** 🚀
