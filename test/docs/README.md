# Entity Search Service - Google Search Version (测试版本)

## 概述

这是 entity-search 服务的 Google Search 版本测试实现,使用 Gemini API 替代 Linkup API。

## 主要变更

### 1. 搜索引擎变更
- **从**: Linkup API
- **到**: Google Search (via Gemini 2.5 Flash + google_search tool)

### 2. 核心功能

#### GeminiSearchService (`GeminiSearchService.ts`)
- 使用 Gemini 2.5 Flash 模型
- 启用 `google_search` tool 进行实时网络搜索
- 提取 grounding metadata (sources, evidence, search queries)
- 专注于商业情报分析(简化版,不需要 OSINT 复杂逻辑)

#### 关键特性
1. **Grounding Metadata 提取**:
   - `grounding_chunks`: 搜索来源(URL + 标题)
   - `grounding_supports`: 证据与来源的映射关系
   - `web_search_queries`: 执行的搜索查询

2. **System Prompt 优化**:
   - 专注于商业情报分析
   - 返回结构化 JSON(公司信息、供应商、合作伙伴)
   - 要求所有 vendors/partnerships 包含 source_url

3. **响应格式**:
   ```json
   {
     "success": true,
     "data": {
       "company_name": "官方注册名称",
       "english_name": "英文名称",
       "previous_names": ["历史名称"],
       "description": "业务描述",
       "headquarters": "总部地址",
       "sectors": ["行业领域"],
       "vendors": [{
         "name": "供应商名称",
         "details": "关系详情",
         "source_url": "来源URL"
       }],
       "partnerships": [{
         "partner_name": "合作伙伴",
         "details": "合作详情",
         "source_url": "来源URL"
       }],
       "sources": [{
         "id": 1,
         "title": "来源标题",
         "url": "来源URL",
         "type": "government|academic|commercial|news|..."
       }],
       "key_evidence": [{
         "text": "证据文本",
         "source_indices": [1, 3]  // 对应 sources 的 id
       }],
       "search_queries": ["执行的搜索查询"],
       "quality_metrics": {
         "sources_count": 10,
         "evidence_count": 15,
         "vendors_count": 3,
         "partnerships_count": 5
       }
     }
   }
   ```

## 文件结构

```
test/
├── GeminiSearchService.ts       # 核心搜索服务(替代 LinkupService)
├── EntitySearchController.ts    # 控制器(更新为使用 GeminiSearchService)
├── app.ts                        # Express 应用入口
├── .env.example                  # 环境变量模板
└── README.md                     # 本文档
```

## 环境配置

### 必需环境变量
```bash
# Gemini API 配置
GEMINI_API_KEY=your_gemini_api_key_here

# 服务端口
PORT=3003

# 环境
NODE_ENV=development
```

### 可选环境变量
```bash
# Redis (用于服务发现)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
```

## API 端点

### 1. POST /api/entity-search
搜索公司实体信息

**请求**:
```json
{
  "company_name": "Tesla Inc",
  "location": "United States"  // 可选
}
```

**响应**: 见上文"响应格式"部分

### 2. GET /api/health
健康检查

**响应**:
```json
{
  "status": "healthy",
  "service": "Entity Search Service",
  "version": "2.0.0",
  "search_engine": "Google Search (via Gemini API)",
  "configuration": {
    "gemini_api_configured": true
  }
}
```

### 3. GET /api/info
服务信息

**响应**: 完整的服务能力和 API 文档

## 与原 Linkup 版本的对比

| 特性 | Linkup 版本 | Google Search 版本 |
|------|------------|-------------------|
| 搜索引擎 | Linkup API | Google Search |
| AI 模型 | 无(直接 API) | Gemini 2.5 Flash |
| Grounding | 有限支持 | 完整 grounding metadata |
| 证据映射 | 无 | 完整 evidence-to-source 映射 |
| 搜索查询追踪 | 无 | 完整 search queries 追踪 |
| 来源分类 | 基础 | 详细分类(gov/edu/news/...) |
| 成本 | Linkup 定价 | Gemini API 定价 |

## 实施建议

### 方案 A: 完全替换 (推荐)
1. 复制 `test/` 中的文件到 `services/entity-search/src/`
2. 删除 `LinkupService.ts` 和 `responseParser.ts`
3. 更新 `.env` 配置 `GEMINI_API_KEY`
4. 重新构建和部署

### 方案 B: 双模式保留
1. 保留 LinkupService
2. 添加 GeminiSearchService
3. 在 Controller 中根据参数选择服务
4. 更灵活但维护成本高

## 测试验证

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 添加 GEMINI_API_KEY

# 2. 测试 API 调用
curl -X POST http://localhost:3003/api/entity-search \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Tesla Inc",
    "location": "United States"
  }'

# 3. 健康检查
curl http://localhost:3003/api/health
```

## 优势

1. **更高质量的来源**: Google Search 覆盖面更广
2. **Grounding 透明度**: 完整的证据到来源映射
3. **成本控制**: 单一 Gemini API,无需多个 API 订阅
4. **搜索追踪**: 可查看实际执行的搜索查询
5. **来源分类**: 自动识别政府、学术、新闻等来源类型

## 注意事项

1. **API 配额**: 确保 Gemini API 有足够配额
2. **响应时间**: Google Search 可能比直接 API 稍慢(60-120s)
3. **JSON 解析**: 已实现健壮的 JSON 提取和清理
4. **前端兼容**: 响应格式保持向后兼容

## 下一步

1. **审查代码**: 检查 `test/` 目录中的实现
2. **测试功能**: 使用真实 API key 测试
3. **确认迁移**: 决定是否迁移到生产环境
4. **更新文档**: 更新主 README 和 CLAUDE.md
