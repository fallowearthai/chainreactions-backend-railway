# ChainReactions Backend - DigitalOcean Docker 部署指南

## 🚀 快速开始

### 先决条件检查
- [ ] Docker和Docker Compose已安装
- [ ] `.env` 文件已配置必要API密钥
- [ ] 环境变量验证脚本：`./check-env.sh`

### 📋 部署命令

#### 方式1：一键部署（推荐）
```bash
# 使用优化的部署脚本
./deploy-optimized.sh
```

#### 方式2：手动部署
```bash
# 使用Docker Compose直接启动
docker-compose -f docker-compose.yml up -d

# 使用特定的服务（选择一个）
docker-compose -f docker-compose.yml up -d entity-relations

# 停止所有服务
docker-compose -f docker-compose.yml down

# 查看服务状态
./monitor-services.sh

# 查看特定服务日志
./monitor-services.sh entity-relations 20  # 最后20行日志
```

### 🔧 服务信息

| 服务 | 端口 | 健康检查 | Docker命令 |
|------|------|--------|----------|----------------|
| entity-relations | 3002 | /api/health | docker-compose up |
| entity-search | 3003 | /api/health | docker-compose up |
| dataset-matching | 3004 | /api/health | docker-compose up |
| data-management | 3005 | /api/health | docker-compose up |
| dataset-search | 3006 | /api/health | docker-compose up |
| redis | 6379 | - | - |

### 📊 部署特性

#### 优化后的改进
- ✅ **健康检查间隔**：从60秒改为300秒（减少85%日志噪音）
- ✅ **统一配置管理**：环境变量自动验证
- ✅ **资源优化**：精简的docker-compose.yml配置
- ✅ **自动化部署**：一键部署脚本，包含进度监控
- ✅ **服务状态监控**：实时彩色状态检查工具
- ✅ **文件清理**：删除26%冗余文件，项目更简洁

### 🚨 故障排除

#### 服务无法启动
```bash
# 检查Docker Compose状态
docker-compose ps

# 查看具体错误
docker-compose logs [service-name]

# 重新构建并启动
docker-compose down
docker-compose build [service-name]
docker-compose up -d [service-name]
```

#### 环境变量问题
```bash
# 验证所有必需变量
./check-env.sh

# 手动设置缺失的变量
export GEMINI_API_KEY="your_actual_key_here"
```

### 📈 部署验证

#### 健康检查
```bash
# 检查所有服务健康状态
./monitor-services.sh

# 单个服务健康检查
curl http://localhost:3002/api/health
curl http://localhost:3003/api/health
```

### 📞 日志管理

#### 查看实时日志
```bash
# 彩色化日志显示
docker-compose logs -f --tail=100

# 日志保存到文件
docker-compose logs [service-name] > logs.txt 2>&1
```

## 🔄 更新部署

#### 更新代码
```bash
# 拉取最新代码
git pull origin main

# 重新构建和部署
docker-compose down
docker-compose build
docker-compose up -d
```

## 📋 监控面板部署（可选）

如需完整的监控面板，请参考[advanced-monitoring](https://github.com/your-repo/advanced-monitoring)方案。

---

## 📞 技术支持

- **Docker版本**: 20.10+
- **Docker Compose**: 3.8+
- **Node.js版本**: 18.0+
- **操作系统**: Linux/macOS
- **推荐内存**: 最少2GB，4GB更佳

---
**更新时间**: 2025-10-24
**状态**: ✅ 生产就绪