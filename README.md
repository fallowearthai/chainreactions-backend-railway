# ChainReactions Backend - Unified OSINT Platform

> **商业级开源情报（OSINT）平台** - 基于 Node.js + TypeScript 的微服务架构，提供6大核心功能的统一API服务。

## 🚀 项目概述

ChainReactions 是一个功能完整的 OSINT（Open-Source Intelligence）平台，将原本分散的6个独立服务统一为单一API入口，提供专业的商业情报分析能力。

### 🎯 核心功能

1. **🧠 Entity Relations (DeepThinking + Normal 模式)**
   - **DeepThinking 模式**: 3阶段AI工作流 + 多引擎SERP搜索
   - **Normal 模式**: 快速Google Web搜索分析
   - **执行时间**: DeepThinking ~107秒，Normal ~10-30秒

2. **🔍 Entity Search**
   - Linkup API 专业商业情报集成
   - 智能域名过滤（排除12+低质量源）
   - 高精度JSON解析，4层回退机制

3. **🎯 Dataset Matching**
   - 高级实体匹配算法（Jaro-Winkler, Levenshtein, N-gram）
   - 8种匹配类型，质量评估机制
   - 内存缓存优化，支持批量处理

4. **📊 Data Management**
   - CSV文件智能上传和解析
   - 自动字段映射和元数据保留
   - Supabase数据库集成

5. **🔎 Dataset Search**
   - SSE流式搜索，实时进度更新
   - 双API并行处理，84%速度提升
   - 加拿大NRO数据库集成

6. **📧 Demo Email Service**
   - Gmail SMTP集成
   - HTML邮件模板
   - 演示请求自动处理

## 🏗️ 技术架构

### 统一服务架构
```
Port 3000 (统一入口)
├── Entity Relations (DeepThinking + Normal)
├── Entity Search (Linkup API)
├── Dataset Matching (高级算法)
├── Data Management (CSV处理)
├── Dataset Search (SSE流式)
└── Email Service (Gmail SMTP)
```

### 技术栈
- **运行时**: Node.js + TypeScript
- **框架**: Express.js REST APIs
- **AI引擎**: Google Gemini 2.5 Flash (支持Thinking模式)
- **搜索API**: Bright Data SERP API + Linkup API
- **数据库**: Supabase (PostgreSQL)
- **缓存**: Redis + 内存缓存
- **邮件**: Nodemailer + Gmail SMTP
- **容器化**: Docker + Docker Compose

## 🚀 快速开始

### 环境要求
- Node.js 18+
- Docker & Docker Compose
- Redis (可选，支持内存缓存回退)

### 安装步骤

1. **克隆仓库**
```bash
git clone <repository-url>
cd chainreactions_backend
```

2. **环境配置**
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量，填入你的API密钥
nano .env
```

3. **安装依赖**
```bash
npm install
```

4. **Docker 部署**
```bash
# 构建并启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

5. **本地开发**
```bash
# 开发模式（热重载）
npm run dev

# 生产构建
npm run build

# 启动生产服务
npm start
```

## 📋 API 端点

### Entity Relations
- `POST /api/enhanced/search` - DeepThinking 3阶段分析
- `GET /api/enhanced/search-stream` - SSE流式进度
- `POST /api/normal-search` - Normal 模式搜索

### Entity Search
- `POST /api/entity-search` - 实体搜索（支持域名过滤）

### Dataset Matching
- `POST /api/dataset-matching/match` - 单实体匹配
- `POST /api/dataset-matching/batch` - 批量匹配
- `GET /api/dataset-matching/stats` - 服务统计

### Data Management
- `GET /api/data-management/datasets` - 数据集列表
- `POST /api/data-management/datasets/:id/upload` - CSV上传
- `GET /api/data-management/datasets/:id/entries` - 数据条目

### Dataset Search
- `POST /api/dataset-search/stream` - 开始流式搜索
- `GET /api/dataset-search/stream/:id/status` - 搜索状态

### Email Service
- `POST /api/demo-request` - 发送演示请求
- `GET /api/test-email` - 测试邮件服务

### 系统端点
- `GET /api/health` - 健康检查
- `GET /api` - 服务信息概览

## 📚 文档导航

### 核心文档
- **[CLAUDE.md](./CLAUDE.md)** - 开发指南和架构详细说明
- **[docs/COMMERCIAL_OPTIMIZATION_PLAN.md](./docs/COMMERCIAL_OPTIMIZATION_PLAN.md)** - 商业化优化计划
- **[docs/PROGRESS_TRACKING.md](./docs/PROGRESS_TRACKING.md)** - 项目进度跟踪

### 部署文档
- **[DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)** - Docker部署指南
- **[README-railway.md](./README-railway.md)** - Railway部署说明
- **[INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md)** - 集成总结

## 🔧 环境变量配置

### 必需的API密钥
```bash
# AI和搜索API
GEMINI_API_KEY=your_gemini_api_key
BRIGHT_DATA_API_KEY=your_bright_data_key
BRIGHT_DATA_SERP_ZONE=your_serp_zone
LINKUP_API_KEY=your_linkup_key
LINKUP_API_KEY_2=your_linkup_key_2

# 数据库
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 邮件服务
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password
```

### 服务器配置
```bash
PORT=3000
NODE_ENV=production
REDIS_URL=redis://redis:6379
```

## 📊 性能基准

### Entity Relations - DeepThinking 模式
- **总执行时间**: ~107秒
- **成功率**: 100%
- **结果质量**: 每次分析20+优化搜索结果

### Entity Relations - Normal 模式
- **执行时间**: 10-30秒
- **搜索引擎**: Google Web Search (Gemini原生集成)

### Dataset Search
- **双API处理**: 84%速度提升 (164s → 27s for 6 entities)
- **并行执行**: 2个API键轮询分发

## 🚨 开发规则

### ⚠️ 系统提示词修改规则
- **严禁**未经明确用户批准修改AI系统提示词
- 提示词经过精心设计，确保特定AI行为和输出格式
- 包括DeepThinking和Normal模式的所有系统指令

### 代码质量标准
- 遵循现有TypeScript约定
- 保持一致的错误处理模式
- 保留API响应格式以确保前端兼容性
- 所有外部服务配置使用环境变量

## 🔍 故障排除

### 健康检查失败
```bash
# 检查容器状态
docker ps

# 查看容器日志
docker logs chainreactions-app

# 重启容器
docker-compose restart
```

### CORS问题
- 检查 `src/app.ts` 中的CORS配置
- 验证Nginx代理头
- 使用浏览器DevTools网络标签测试

### 端口冲突
```bash
# 检查端口占用
lsof -i :3000

# 终止进程
kill -9 PID
```

### Redis连接问题
- 服务自动回退到内存缓存
- 检查Redis容器状态: `docker ps | grep redis`
- 查看Redis日志: `docker logs chainreactions-redis`

## 🚨 已知问题

### Entity Relations Thinking Mode - Gemini API响应解析问题

**问题描述** (2025年10月13日):
- **错误**: `AI silence detected - thinking completed but no response generated`
- **位置**: `ResultIntegrationService.ts` Stage 3 AI分析
- **症状**: API调用成功但无输出token生成

**解决方案**:
1. 增强响应验证机制
2. 工具配置优化
3. 智能重试逻辑
4. 降级策略实施

## 🎯 商业化状态

### ✅ 已实现功能
- 完整的6大核心服务
- 统一API入口（Port 3000）
- Docker容器化部署
- 生产环境运行稳定
- 前端集成完善

### 🚀 商业化优化计划
详见 [docs/COMMERCIAL_OPTIMIZATION_PLAN.md](./docs/COMMERCIAL_OPTIMIZATION_PLAN.md)

### 📈 演进路线
1. **Phase 1**: 系统稳定化（当前进行中）
2. **Phase 2**: SaaS架构重构（内部微服务化）
3. **Phase 3**: 企业级功能完善

## 🧪 Example Usage

### Basic Search
```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "Target_institution": "Hong Kong Polytechnic University",
    "Risk_Entity": "Huawei",
    "Location": "China"
  }'
```

### Multi-Engine Search
```bash
curl -X POST http://localhost:3000/api/multisearch/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "HongZhiWei Technologies NanoAcademic",
    "location": "China",
    "languages": ["english", "chinese"],
    "max_results_per_engine": 10
  }'
```

## 🏗 Project Structure

```
src/
├── app.ts                          # Express server setup
├── controllers/                    # Request handlers
│   ├── SearchController.ts         # Original Gemini search
│   ├── MetaController.ts          # Meta prompting endpoints
│   └── MultiSearchController.ts   # Multi-engine search
├── services/                      # Business logic
│   ├── GeminiService.ts           # Google Gemini API
│   ├── SearchService.ts           # Core OSINT logic
│   ├── MetaPromptService.ts       # Search strategy analysis
│   ├── MultiSearchEngineService.ts # Engine orchestration
│   └── searchEngines/             # Individual search engines
├── types/                         # TypeScript definitions
└── utils/                         # Utility functions
```

## 🔍 Search Engine Support

### Currently Implemented
- **Google**: Global search engine with comprehensive coverage
- **Baidu**: Chinese search engine for native Chinese content and sources
- **Yandex**: Russian search engine for Cyrillic content and Eastern European sources

## 🌍 Geographic Intelligence

The system automatically selects appropriate search engines based on location:

- **China/Hong Kong/Taiwan**: Google + Baidu for comprehensive coverage
- **Russia/Eastern Europe**: Google + Yandex for native content access
- **Other Regions**: Google + Yandex for global coverage
- **Global**: Google baseline with regional engines based on context

## 🛡 Known Limitations

This system addresses several critical challenges in OSINT research:

1. **Model Response Inconsistency**: Multi-engine approach reduces single-point-of-failure
2. **Source Accessibility**: Result verification and link checking planned
3. **Search Depth**: Multiple engines provide broader coverage
4. **Geographic Restrictions**: Uncensored engines for restricted regions
5. **Entity Name Variations**: Multi-language search with name standardization

See `CLAUDE.md` for detailed technical documentation and known issues.

## 📈 Performance & Scalability

- **Parallel Search Execution**: Multiple engines searched concurrently
- **Result Deduplication**: Intelligent duplicate detection and scoring
- **Rate Limiting**: Configurable request limits per engine
- **Caching**: Planned result caching for improved performance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🆘 Support

For issues, feature requests, or questions:
- Create an issue in the GitHub repository
- Check `CLAUDE.md` for detailed technical documentation
- Review API endpoint documentation for usage examples

---

**⚠️ Security Notice**: Never commit `.env` files containing API keys to version control. Always use `.env.example` for sharing configuration templates.
