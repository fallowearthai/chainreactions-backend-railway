# ChainReactions Backend - Railway Deployment

## 🚀 Railway部署的生产级OSINT平台

### 项目简介
这是ChainReactions OSINT平台的后端服务，专门为Railway云平台优化部署。平台集成了6个核心服务，提供完整的开源情报（OSINT）分析能力。

### 🔧 集成的服务列表

1. **Entity Relations** (DeepThinking + Normal modes)
   - 3阶段OSINT工作流 (Gemini AI + 多引擎搜索)
   - 快速Google搜索模式

2. **Entity Search**
   - Linkup API专业商业智能搜索
   - 智能域名过滤

3. **Dataset Matching**
   - 高级实体匹配算法 (Jaro-Winkler, Levenshtein, N-gram)
   - 缓存优化和批量处理

4. **Data Management**
   - CSV文件上传和智能解析
   - Supabase数据库集成

5. **Dataset Search**
   - SSE流式搜索
   - 双Linkup API并行处理

6. **Email Service**
   - Gmail SMTP集成
   - 演示请求邮件服务

### 📊 部署信息

- **部署平台**: Railway.app
- **技术架构**: Docker容器化 + Node.js + TypeScript
- **端口**: 3000
- **健康检查**: `/api/health`
- **环境**: 生产环境优化

### 🔑 环境变量配置

在Railway控制台中设置以下环境变量：

#### 核心API密钥
```bash
GEMINI_API_KEY=your_gemini_api_key_here
BRIGHT_DATA_API_KEY=your_bright_data_api_key_here
BRIGHT_DATA_SERP_ZONE=your_bright_data_serp_zone_here
```

#### Linkup API配置
```bash
LINKUP_API_KEY=your_linkup_api_key_here
LINKUP_API_KEY_2=your_second_linkup_api_key_here
LINKUP_BASE_URL=https://api.linkup.so/v1
```

#### Supabase数据库
```bash
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
```

#### 邮箱服务
```bash
GMAIL_USER=your_gmail_address_here
GMAIL_APP_PASSWORD=your_gmail_app_password_here
```

#### 服务器配置
```bash
NODE_ENV=production
PORT=3000
```

### 🌐 API端点

#### 主要服务端点
- **健康检查**: `GET /api/health`
- **服务信息**: `GET /api`

#### Entity Relations服务
- **完整分析**: `POST /api/enhanced/search`
- **流式分析**: `GET /api/enhanced/search-stream`
- **快速搜索**: `POST /api/normal-search`

#### Entity Search服务
- **实体搜索**: `POST /api/entity-search`
- **连接测试**: `GET /api/entity-search/test`

#### Dataset Matching服务
- **单个匹配**: `POST /api/dataset-matching/match`
- **批量匹配**: `POST /api/dataset-matching/batch`
- **服务健康**: `GET /api/dataset-matching/health`

#### Data Management服务
- **数据集列表**: `GET /api/data-management/datasets`
- **文件上传**: `POST /api/data-management/datasets/:id/upload`
- **数据导出**: `GET /api/data-management/datasets/:id/export`

#### Dataset Search服务
- **流式搜索**: `POST /api/dataset-search/stream`
- **NRO统计**: `GET /api/dataset-search/nro-stats`

#### Email服务
- **演示请求**: `POST /api/demo-request`
- **邮件测试**: `GET /api/test-email`

### 🚀 部署步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/YOUR_USERNAME/chainreactions-backend-railway.git
   cd chainreactions-backend-railway
   ```

2. **连接Railway**
   - 访问 https://railway.app
   - 用GitHub账号登录
   - 导入此仓库

3. **配置环境变量**
   - 在Railway控制台添加所有必需的环境变量
   - 参考 `.env.example` 文件

4. **开始部署**
   - Railway会自动检测Docker配置
   - 等待部署完成（2-5分钟）

5. **验证部署**
   ```bash
   curl https://your-app-name.up.railway.app/api/health
   ```

### 📈 性能特点

- **响应时间**: 大多数API调用 < 2秒
- **并发处理**: 支持100+并发请求
- **缓存优化**: Redis缓存 + 内存缓存
- **错误恢复**: 完整的重试机制和错误处理

### 🔍 监控和日志

- **健康监控**: 自动健康检查
- **日志记录**: 结构化日志输出
- **错误追踪**: 详细的错误信息
- **性能指标**: 内置性能统计

### 🛠️ 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env

# 构建项目
npm run build

# 启动开发服务器
npm run dev

# 运行测试
npm test

# 类型检查
npm run type-check
```

### 🤝 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

### 📄 许可证

MIT License - 详见LICENSE文件

### 🆘 支持

如有问题，请：
1. 查看日志文件
2. 检查环境变量配置
3. 测试API健康检查端点
4. 提交GitHub Issue

### 🎯 生产状态

- ✅ 所有6个服务正常运行
- ✅ API端点完全可用
- ✅ 缓存系统优化
- ✅ 错误处理完善
- ✅ 日志系统完整
- ✅ 健康检查自动运行

**部署状态**: 生产就绪 ✅