# API端点映射文档

> **目的**: 详细映射N8N工作流到TypeScript API的端点转换
> **更新日期**: 2025-09-29

---

## 📡 端点映射概览

### 当前N8N端点 → 目标TypeScript端点

| N8N端点 | 方法 | 新端点 | 状态 | 优先级 |
|---------|------|--------|------|--------|
| `/start-ai-process` | POST | `/api/dataset-search/execute` | ✅ 已存在 | P0 |
| `/is-analysis-cancelled` | GET | `/api/dataset-search/status/:id` | ✅ 已存在 | P1 |
| (隐式取消) | POST | `/api/dataset-search/cancel/:id` | ⚠️ 需增强 | P1 |

---

## 🎯 详细端点分析

### 1. 主搜索执行端点

#### N8N实现: `/start-ai-process`
- **Webhook ID**: `8da943cb-4e7b-4d61-b11e-e4e968ae415c`
- **工作流**: Dataset Search 1
- **节点**: Webhook1

#### TypeScript目标: `/api/dataset-search/execute`
- **控制器**: `DatasetSearchController.executeSearch()`
- **已存在**: ✅ 基础结构已创建

#### 请求格式对比

**N8N输入格式**:
```json
{
  "institution_name": "university of british columbia",
  "excelexist": "False",
  "user_id": "4a2f144c-62b7-4b3f-8c52-554175ff7bff",
  "date": "2024-01-01 to 2024-12-31",
  "keywords": "Military, Defense Technology"
}
```

**TypeScript输入格式** (保持完全兼容):
```json
{
  "institution_name": "university of british columbia",
  "excelexist": "False",
  "user_id": "4a2f144c-62b7-4b3f-8c52-554175ff7bff",
  "date": "2024-01-01 to 2024-12-31",
  "keywords": "Military, Defense Technology"
}
```

#### 响应格式对比

**N8N响应格式**:
```json
{
  "executionId": "mfcoo5rjr0u4b330ay",
  "pusherConfig": {
    "key": "1e7b0fcbfa9b45947a84",
    "cluster": "mt1",
    "channelName": "private-results-mfcoo5rjr0u4b330ay"
  },
  "message": "处理已开始，请连接WebSocket以接收实时结果。",
  "status": "processing"
}
```

**TypeScript目标响应** (需调整为SSE):
```json
{
  "executionId": "mfcoo5rjr0u4b330ay",
  "pusherConfig": {
    "key": "deprecated",
    "cluster": "local",
    "channelName": "sse-results-mfcoo5rjr0u4b330ay"
  },
  "message": "处理已开始，请连接SSE以接收实时结果。",
  "status": "processing",
  "sseEndpoint": "/api/dataset-search/stream/:executionId"
}
```

#### 实现细节
```typescript
// src/controllers/DatasetSearchController.ts
export class DatasetSearchController {
  async executeSearch(req: Request, res: Response): Promise<void> {
    const { institution_name, excelexist, user_id, date, keywords } = req.body;

    // 1. 生成executionId (迁移自Code1节点)
    const executionId = Date.now().toString(36) + Math.random().toString(36).substring(2);

    // 2. 条件判断逻辑 (迁移自If节点)
    if (excelexist === "True") {
      await this.executeExcelWorkflow(executionId, req.body);
    } else {
      await this.executeTextWorkflow(executionId, req.body);
    }

    // 3. 返回响应 (迁移自Respond to Webhook节点)
    res.json({
      executionId,
      pusherConfig: {
        key: "deprecated",
        cluster: "local",
        channelName: `sse-results-${executionId}`
      },
      message: "处理已开始，请连接SSE以接收实时结果。",
      status: "processing",
      sseEndpoint: `/api/dataset-search/stream/${executionId}`
    });
  }
}
```

---

### 2. 状态查询端点

#### N8N实现: `/is-analysis-cancelled`
- **Webhook ID**: `44eec383-4d36-48a2-a3ad-aa0837518c7c`
- **工作流**: Dataset Search 4
- **节点**: Check Cancel Status Trigger

#### TypeScript目标: `/api/dataset-search/status/:id`
- **控制器**: `DatasetSearchController.getExecutionStatus()`
- **已存在**: ✅ 基础结构已创建

#### 请求格式对比

**N8N查询参数**:
```
GET /is-analysis-cancelled?executionId=mfcoo5rjr0u4b330ay
```

**TypeScript查询格式**:
```
GET /api/dataset-search/status/mfcoo5rjr0u4b330ay
```

#### 响应格式对比

**N8N响应**:
```json
{
  "executionId": "mfcoo5rjr0u4b330ay",
  "isCancelled": false
}
```

**TypeScript响应** (增强版):
```json
{
  "executionId": "mfcoo5rjr0u4b330ay",
  "isCancelled": false,
  "status": "processing|completed|cancelled|error",
  "progress": {
    "current": 5,
    "total": 20,
    "percentage": 25
  },
  "lastUpdated": "2025-09-29T10:58:00Z"
}
```

#### 实现细节
```typescript
// 扩展现有方法
async getExecutionStatus(req: Request, res: Response): Promise<void> {
  const { id: executionId } = req.params;

  // 迁移Redis查询逻辑
  const isCancelled = await this.executionStateService.checkCancelFlag(executionId);
  const progress = await this.getExecutionProgress(executionId);

  res.json({
    executionId,
    isCancelled,
    status: isCancelled ? 'cancelled' : progress.status,
    progress: progress.details,
    lastUpdated: new Date().toISOString()
  });
}
```

---

### 3. 取消执行端点

#### N8N实现: (隐式，通过webhook body)
- **工作流**: Dataset Search 4
- **Redis操作**: 设置`cancel_flag:${executionId}`

#### TypeScript目标: `/api/dataset-search/cancel/:id`
- **控制器**: `DatasetSearchController.cancelExecution()`
- **状态**: ⚠️ 需要从现有DELETE端点修改

#### 请求格式

**N8N方式** (推断):
```json
POST /webhook-endpoint
{
  "executionId": "mfcoo5rjr0u4b330ay"
}
```

**TypeScript方式**:
```
DELETE /api/dataset-search/execution/mfcoo5rjr0u4b330ay
```

#### 响应格式

**N8N响应格式**:
```json
{
  "success": true,
  "message": "Cancel request for execution ID mfcoo5rjr0u4b330ay has been successfully logged to Redis."
}
```

**TypeScript响应** (保持兼容):
```json
{
  "success": true,
  "message": "Cancel request for execution ID mfcoo5rjr0u4b330ay has been successfully logged.",
  "executionId": "mfcoo5rjr0u4b330ay",
  "cancelledAt": "2025-09-29T10:58:00Z"
}
```

#### 实现细节
```typescript
// 修改现有cancelExecution方法
async cancelExecution(req: Request, res: Response): Promise<void> {
  const { id: executionId } = req.params;

  try {
    // 迁移Redis set逻辑
    await this.executionStateService.setCancelFlag(executionId);

    res.json({
      success: true,
      message: `Cancel request for execution ID ${executionId} has been successfully logged.`,
      executionId,
      cancelledAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to process cancellation request: executionId was missing, invalid, or not found."
    });
  }
}
```

---

## 🌊 实时通信迁移

### N8N实时通信: Pusher WebSocket
```javascript
// N8N配置
pusherConfig: {
  key: "1e7b0fcbfa9b45947a84",
  cluster: "mt1",
  channelName: "private-results-{{executionId}}"
}
```

### TypeScript替代: Server-Sent Events (SSE)

#### 新增端点: `/api/dataset-search/stream/:executionId`

**实现**:
```typescript
// src/controllers/DatasetSearchController.ts
async streamProgress(req: Request, res: Response): Promise<void> {
  const { executionId } = req.params;

  // 设置SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 实时推送逻辑
  const stream = this.realTimeService.createProgressStream(executionId);
  stream.on('data', (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });

  stream.on('end', () => {
    res.end();
  });
}
```

**前端适配**:
```typescript
// 前端需要修改WebSocket为EventSource
const eventSource = new EventSource(`/api/dataset-search/stream/${executionId}`);
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // 处理进度更新
};
```

---

## 🗄️ 数据流映射

### N8N数据流 → TypeScript服务流

#### 阶段1: 请求处理
```
N8N: Webhook1 → Code1 → If
↓
TypeScript:
  executeSearch() → generateExecutionId() → routeWorkflow()
```

#### 阶段2: 数据准备
```
N8N: Get Initial Params → Code1 → HTTP Request → Code → Split Out
↓
TypeScript:
  KeywordProcessingService.parseKeywords() →
  ExternalDataService.getRiskOrganizations() →
  ExternalDataService.combineDataSources() →
  Array.forEach(entity)
```

#### 阶段3: 搜索执行
```
N8N: Loop Over Items → Set Current NRO Data1 → call_linkup_request
↓
TypeScript:
  entities.forEach(entity =>
    OSINTAnalysisService.analyzeRelationship(institution, entity) →
    LinkupSearchService.searchRelationship()
  )
```

#### 阶段4: 结果处理
```
N8N: 清理answer和url格式1 → 清理answer和url格式2 → Code3 → If1 → [Create a row | no evidence]
↓
TypeScript:
  OSINTAnalysisService.parseAnalysisResult() →
  SupabaseService.storeSearchResult() →
  RealTimeService.sendProgress()
```

#### 阶段5: 完成通知
```
N8N: Code2 → no evidence1
↓
TypeScript:
  RealTimeService.sendCompletion() →
  SupabaseService.storeCompletionEvent()
```

---

## ⚙️ 环境变量映射

### N8N配置 → TypeScript环境变量

```bash
# N8N中的硬编码值 → .env文件
LINKUP_API_KEY=00ebe384-1321-47b2-b963-adaa2cc696dc
LINKUP_API_URL=https://api.linkup.so/v1/search

# GitHub数据源
RISK_ORGANIZATIONS_URL=http://raw.githubusercontent.com/BlearKK/list_storage/refs/heads/main/Named%20Research%20Organizations.json

# Pusher替代 (如果保留WebSocket)
PUSHER_KEY=deprecated
PUSHER_CLUSTER=local

# Redis配置 (新增)
REDIS_URL=redis://localhost:6379
REDIS_TTL=3600

# 服务配置
DATASET_SEARCH_PORT=3004
DATASET_SEARCH_TIMEOUT=300000
```

---

## 🧪 测试映射

### N8N测试数据 → TypeScript测试用例

#### 测试用例1: 基础文本搜索
```json
{
  "input": {
    "institution_name": "university of british columbia",
    "excelexist": "False",
    "user_id": "4a2f144c-62b7-4b3f-8c52-554175ff7bff",
    "keywords": "Military, Defense Technology"
  },
  "expected": {
    "executionId": "string",
    "status": "processing",
    "pusherConfig": "object"
  }
}
```

#### 测试用例2: 取消功能
```json
{
  "steps": [
    "POST /api/dataset-search/execute",
    "DELETE /api/dataset-search/execution/:id",
    "GET /api/dataset-search/status/:id"
  ],
  "expected": {
    "isCancelled": true,
    "status": "cancelled"
  }
}
```

---

## 📋 实施清单

### API端点迁移任务
- [x] 分析现有N8N端点
- [x] 映射到TypeScript端点
- [ ] 增强`executeSearch`方法
- [ ] 修改`cancelExecution`方法
- [ ] 实现SSE流式端点
- [ ] 添加进度跟踪功能
- [ ] 实现错误处理
- [ ] 添加请求验证
- [ ] 创建API文档

### 兼容性确保任务
- [ ] 保持请求/响应格式一致
- [ ] 实现Pusher → SSE适配层
- [ ] 前端WebSocket → EventSource迁移
- [ ] 错误码映射
- [ ] 超时处理一致性

### 测试验证任务
- [ ] 单元测试覆盖
- [ ] 集成测试设计
- [ ] 性能基准测试
- [ ] 并发测试
- [ ] 错误场景测试

---

*本文档提供了从N8N工作流到TypeScript API的完整端点映射指南，确保迁移过程中保持功能完整性和前端兼容性。*