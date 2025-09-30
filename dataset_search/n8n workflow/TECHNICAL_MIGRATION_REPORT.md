# Dataset Search N8N工作流技术替换报告

> **文档版本**: 2.0
> **创建日期**: 2025-09-29
> **更新日期**: 2025-09-30
> **目的**: 将Dataset Search从N8N工作流迁移到纯TypeScript代码实现

---

## 📋 执行摘要

### 迁移背景
- **问题**: N8N工作流与新测试数据库不同步，导致Dataset Search功能无法正常工作
- **解决方案**: 将完整的N8N工作流逻辑迁移到TypeScript微服务，实现简化版workflow
- **核心原则**: 保持Linkup API作为主要搜索引擎，优化为SSE实时推送，移除Excel处理复杂性

### 关键发现和优化方向
- ✅ **简化数据源**: 从GitHub API迁移到Supabase Canadian NRO数据 (103个组织)
- ✅ **实时推送优化**: 从Pusher WebSocket迁移到SSE，消除数据库轮询
- ✅ **架构简化**: 移除Redis依赖，使用内存状态管理
- ✅ **性能提升**: 实现2并发搜索，减少50%执行时间 (15-20分钟 → 7-10分钟)
- ✅ **用户体验**: 每个搜索结果完成立即显示，无需等待全部完成

---

## 🏗️ 当前N8N工作流详细架构分析

### 工作流1: Dataset Search 1 (主控制器)
**文件**: `Dataset Search 1.json`
**作用**: 入口点和流程控制

#### 节点流程图:
```
Webhook1 → Extract from XLSX → Code1 → If → [Execute Sheet | Execute Workflow1] → Respond to Webhook
```

#### 详细节点分析:

1. **Webhook1** (`e6c71012-4523-4123-a718-f9ad07e387eb`)
   - **端点**: `/start-ai-process` (POST)
   - **参数解析**:
     - `institution_name`: 目标机构名称
     - `excelexist`: 是否包含Excel文件 ("True"/"False")
     - `user_id`: 用户标识符
     - `date`: 时间范围 (可选)
     - `keywords`: 关键词列表 (可选)
   - **二进制数据**: 支持Excel文件上传 (`excel_list`)

2. **Code1** (JavaScript执行节点)
   ```javascript
   // 核心逻辑
   const institutionName = $('Webhook1').first().json.body.institution_name;
   const timeperiod = $('Webhook1').first().json.body.date;
   const keywords = $('Webhook1').first().json.body.keywords;
   const exist_excel = $('Webhook1').first().json.body.excelexist
   const user_id = $('Webhook1').first().json.body.user_id

   // 生成唯一ID
   const executionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
   ```

3. **条件判断If**
   - **条件**: `$json.exist_excel === "True"`
   - **True路径**: 调用"Dataset Search 5"工作流 (Excel处理)
   - **False路径**: 调用"Dataset Search 2"工作流 (文本搜索)

4. **响应格式**:
   ```json
   {
     "executionId": "唯一执行ID",
     "pusherConfig": {
       "key": "1e7b0fcbfa9b45947a84",
       "cluster": "mt1",
       "channelName": "private-results-{{executionId}}"
     },
     "message": "处理已开始，请连接WebSocket以接收实时结果。",
     "status": "processing"
   }
   ```

### 工作流2: Dataset Search 2 (核心搜索引擎)
**文件**: `Dataset Search 2.json`
**作用**: OSINT分析和关系检测的主要逻辑

#### 完整数据流程:
```
When Executed → Get Initial Params → Code1 → HTTP Request → Code → Split Out →
Loop Over Items → [取消检查] → Set Current NRO Data1 → Prompt generate1 →
call_linkup_request → Wait → 清理answer和url格式1 → 清理answer和url格式2 →
Code3 → If1 → [Create a row | no evidence] → Loop继续 → Code2(完成通知)
```

#### 关键节点深度分析:

1. **关键词处理 (Code1)**
   ```javascript
   const keywords = $input.first().json.keywords;
   let keywordsList;

   // 智能解析逻辑
   if (keywords && typeof keywords === 'string' && keywords.startsWith('[') && keywords.endsWith(']')) {
     keywordsList = JSON.parse(keywords);  // JSON数组格式
   } else if (typeof keywords === 'string') {
     if (keywords.trim() === '') {
       keywordsList = [];
     } else {
       keywordsList = keywords.split(',').map(item => item.trim());  // 逗号分割
     }
   }

   // 转换为标准格式
   const formattedKeywords = keywordsList.map(keyword => ({ "Name": keyword }));
   ```

2. **风险数据获取 (HTTP Request)**
   - **URL**: `http://raw.githubusercontent.com/BlearKK/list_storage/refs/heads/main/Named%20Research%20Organizations.json`
   - **超时**: 10秒
   - **作用**: 获取已知风险组织列表

3. **数据合并 (Code)**
   ```javascript
   const jsonStringFromFile = $json.data;
   const keywordslist = $('Code1').first().json.data;

   // 清理JSON字符串 (处理尾随逗号)
   const cleanedJsonString = jsonStringFromFile.replace(/,(\\s*[\\]}])/g, '$1');
   const parsedRiskList = JSON.parse(cleanedJsonString);

   // 合并数据
   const combinedList = [...keywordslist, ...parsedRiskList];
   const nameCount = combinedList.filter(item =>
     item && item.Name && item.Name.trim() !== ''
   ).length;
   ```

4. **循环处理 (Loop Over Items)**
   - **批次大小**: 1 (逐个处理)
   - **取消检查**: 每次循环都检查Redis取消标志
   - **处理对象**: 合并后的风险实体列表

5. **AI分析核心 (Set Current NRO Data1)**
   - **系统提示词** (完整版本):
   ```
   You are a Research Security Analyst conducting initial open-source intelligence (OSINT) gathering.

   <Goal>
   Using web search capabilities, investigate potential connections between Institution A and each item in Risk List C.
   Summarize key findings, identify potential intermediary organizations (B), and provide source URLs.
   </Goal>

   <Information Gathering Strategy>
   1. For each item in Risk List C:
      * Formulate search queries combining Institution A with the specific risk item
      * Analyze search results for reports, news articles, official websites
      * Look for evidence of:
        ** Direct Links: A directly collaborates with or receives funding from C
        ** Indirect Links: A and C are linked through third-party organization B
        ** Significant Mentions: A and C mentioned together in risk context

   <Output Instructions>
   - Produce a JSON list as output
   - Each object corresponds to one item from Risk List C
   - relationship_type: "Direct", "Indirect", "Significant Mention", "Unknown", "No Evidence Found"
   - Include detailed finding_summary for Direct, Indirect, and Significant Mention only
   ```

6. **Linkup API调用 (call_linkup_request)**
   ```javascript
   // API配置
   URL: "https://api.linkup.so/v1/search"
   Method: POST
   Headers: {
     "Authorization": "Bearer 00ebe384-1321-47b2-b963-adaa2cc696dc"
   }
   Body: {
     "q": "{{系统提示词}}{{用户查询}}",
     "depth": "standard",
     "outputType": "sourcedAnswer",
     "includeImages": "false"
   }
   ```

7. **结果处理和格式化**
   - **清理answer和url格式1**: 解析Linkup API返回的JSON结果
   - **清理answer和url格式2**: 格式化输出文本，处理换行符
   - **Code3**: 处理sources数据，转换为JSON字符串存储

8. **数据库存储 (Supabase)**

   **表名**: `real_time_results`

   **存储字段**:
   ```javascript
   // 有发现时 (Create a row)
   {
     execution_id: executionId,
     user_id: userId,
     event_type: "new_result",
     search_type: "chain_reaction",
     relationship_type: "Direct|Indirect|Significant Mention|Unknown",
     entity_name: entityName,
     answer: formattedResult,
     sources: JSON.stringify(sourcesObject)
   }

   // 无发现时 (no evidence)
   {
     execution_id: executionId,
     user_id: userId,
     event_type: "new_result",
     search_type: "chain_reaction",
     relationship_type: "No Evidence Found|Significant Mention",
     entity_name: entityName,
     answer: formattedResult
   }
   ```

9. **完成通知 (Code2)**
   ```javascript
   const doneMessage = {
     status: 'completed',
     message: `mission completed. (${totalProcessed})`,
     timestamp: new Date().toISOString(),
     totalItems: totalProcessed,
     processingTime: new Date().toLocaleString('zh-CN', {
       timeZone: 'Asia/Shanghai'
     }),
     summary: {
       batchSize: 1,
       totalBatches: totalProcessed,
       status: 'success'
     }
   };
   ```

### 工作流3: Dataset Search 4 (取消控制器)
**文件**: `Dataset Search 4.json`
**作用**: 搜索取消和状态管理

#### 双端点设计:
1. **取消端点** (隐式, 通过webhook trigger)
   - 设置Redis取消标志: `cancel_flag:${executionId} = "true"`
   - TTL: 3600秒 (1小时)

2. **状态检查端点**: `/is-analysis-cancelled`
   - 查询Redis中的取消标志
   - 返回格式:
   ```json
   {
     "executionId": "execution_id",
     "isCancelled": true/false
   }
   ```

---

## 🔧 技术组件依赖分析

### 外部API依赖
1. **Linkup API**
   - **端点**: `https://api.linkup.so/v1/search`
   - **认证**: Bearer Token (`00ebe384-1321-47b2-b963-adaa2cc696dc`)
   - **用途**: 核心OSINT搜索引擎
   - **速率限制**: 10 queries/second (与技术人员确认)
   - **完整配置**:
     ```json
     {
       "q": "动态构建的完整提示词",
       "depth": "standard",
       "outputType": "sourcedAnswer",
       "includeImages": "false",
       "includeInlineCitations": false,
       "excludeDomains": ["wikipedia.org"]
     }
     ```
   - **响应格式**: `{answer: string, sources: Array<{name, url, snippet}>}`

### 数据存储依赖
1. **Supabase PostgreSQL**
   - **主要表**: `long_text_search_history` (替代real_time_results)
   - **数据源表**: `dataset_entries` (Canadian NRO数据，103条记录)
   - **用途**: 实时存储搜索结果和执行状态
   - **存储策略**: 增量JSON追加 (`search_results = search_results || new_result::jsonb`)

### 状态管理 (简化版)
1. **内存状态管理**
   - **方式**: Map<executionId, ExecutionState>
   - **取消控制**: AbortController + 内存标志
   - **优势**: 无外部依赖，响应迅速
   - **清理策略**: 定时清理过期执行记录

### 实时通信 (优化版)
1. **Server-Sent Events (SSE)**
   - **替代**: Pusher WebSocket → 原生SSE
   - **端点**: `/api/dataset-search/stream/:executionId`
   - **优势**: 更简单的实现，无第三方依赖
   - **格式**: `data: ${JSON.stringify(progressData)}\n\n`

---

## 🎯 简化版实施方案 (2025-09-30更新)

### 核心优化策略

基于用户反馈和实际需求，我们制定了简化版的迁移方案：

#### 1. 简化用户输入
- **移除Excel处理**: 专注于公司名称输入，去除文件上传复杂性
- **固定数据源**: 使用Supabase中的Canadian NRO数据 (103个组织)
- **标准化流程**: 输入公司名称 → 与103个NRO组织循环比较

#### 2. 实时体验优化
- **SSE直接推送**: 每完成一次搜索立即显示结果，无需等待全部完成
- **消除数据库轮询**: 直接SSE推送代替数据库中间层
- **内存状态管理**: 移除Redis依赖，使用AbortController进行取消控制

#### 3. 性能提升策略
- **并发优化**: 2个并发Linkup API调用 (遵循10 queries/second限制)
- **时间减半**: 从15-20分钟优化到7-10分钟
- **实时存储**: 每个结果完成立即存储到`long_text_search_history`，防止数据丢失

### 确认的技术参数

#### Linkup API配置
```javascript
// API配置 (已确认)
API_URL: "https://api.linkup.so/v1/search"
API_KEY: "00ebe384-1321-47b2-b963-adaa2cc696dc"
Rate_Limit: 10 queries/second (与技术人员确认)
Timeout: 60秒建议

// 完整API参数 (基于实际curl示例)
{
  "q": "完整的系统提示词 + 动态用户查询",
  "depth": "standard",
  "outputType": "sourcedAnswer",
  "includeImages": "false",
  "includeInlineCitations": false,
  "excludeDomains": ["wikipedia.org"]
}
```

#### 系统提示词模板 (已确认)
```
You are a skilled Research Security Analyst specializing in open-source intelligence (OSINT) investigations. Your assignment is to systematically identify and document institutional connections between Institution A and Risk List C.

Goal: For entity in Risk List C, determine the existence and nature of any relationship with Institution A, focusing on both direct (e.g., formal collaborations, joint research, funding) and indirect (e.g., via intermediary organizations) connections, as well as notable co-mentions in risk or security-related contexts.

Scope: Conduct comprehensive web searches across authoritative sources, including official institutional websites, reputable news outlets, academic publications, and government reports. Search in both English and the primary language(s) of the entity's country (e.g., Chinese for China-based entities). Prioritize official and high-credibility sources.

Criteria/Method: For each entity in Risk List C:
- Formulate targeted search queries combining Institution A and the entity name.
- Identify and classify the relationship as one of: 'Direct', 'Indirect', 'Significant Mention', 'Unknown', or 'No Evidence Found'.
- For 'Direct', 'Indirect', or 'Significant Mention', provide a concise summary of findings and list any intermediary organizations involved.
- Always include source URLs for verification.
- Ensure findings are supported by both English and local-language sources where available.

Format: Return a JSON array, where each object contains: risk_item, relationship_type, finding_summary (if applicable), intermediary_organizations (if any), and source_urls.

User Query: Investigate and report on the relationship between '{Institution A}' (Institution A) and '{Risk Entity}' (Risk List C, location: {Country}) using the above methodology. Return your findings in the specified JSON format.
```

**动态变量替换逻辑**:
- `{Institution A}` → 用户输入的公司名称
- `{Risk Entity}` → Canadian NRO组织名称
- `{Country}` → 组织所在国家

#### Linkup API响应格式 (实际格式)
```json
{
  "answer": "AI生成的完整分析回答，包含我们需要的JSON格式数据",
  "sources": [
    {
      "name": "来源标题",
      "url": "来源链接",
      "snippet": "来源摘要片段"
    }
  ]
}
```

**关键发现**:
- 我们的结构化JSON数据实际包含在`answer`字段中
- 需要实现智能解析器从自然语言中提取JSON
- `sources`数组提供完整的验证来源

#### 响应解析策略
```typescript
interface ParsedLinkupResponse {
  risk_item: string;
  relationship_type: 'Direct' | 'Indirect' | 'Significant Mention' | 'Unknown' | 'No Evidence Found';
  finding_summary?: string;
  intermediary_organizations?: string[];
  source_urls: string[];
}

class LinkupResponseParser {
  parseAnswerField(answer: string): ParsedLinkupResponse {
    // 从answer中提取JSON数据
    // 处理自然语言包装的结构化信息
  }

  extractSourceUrls(sources: LinkupSource[]): string[] {
    // 从sources数组中提取URL列表
  }
}
```

#### 数据存储策略
```sql
-- 使用现有long_text_search_history表
-- 实时追加模式: search_results = search_results || new_result::jsonb
-- 状态管理: execution_status ('processing' → 'completed'/'cancelled')
```

### 简化版数据流程

```
用户输入公司名称
  ↓
创建long_text_search_history记录 (status='processing')
  ↓
查询Canadian NRO列表 (103个组织)
  ↓
建立SSE连接
  ↓
2并发循环处理 (遵循10 queries/second限制):
  - 构建动态提示词 (Institution A + Risk Entity + Country)
  - 调用Linkup API获取分析结果
  - 解析answer字段提取JSON数据
  - 提取sources数组获取验证链接
  - 实时SSE推送到前端
  - 立即存储解析后的结构化数据到数据库
  ↓
完成后更新status='completed'
```

### 核心服务架构 (简化版)

1. **SupabaseNROService**: 查询103个Canadian NRO组织
2. **LinkupSearchService**: 并发Linkup API调用，支持取消和速率限制
3. **LinkupResponseParser**: 解析answer字段提取结构化JSON数据
4. **PromptBuilderService**: 动态构建系统提示词和用户查询
5. **SearchHistoryService**: long_text_search_history实时存储
6. **SSEService**: 实时进度和结果推送
7. **DatasetSearchController**: 主控制器，内存状态管理

---

## 🚀 TypeScript代码迁移路线图 (原始完整版本)

### 阶段1: 核心服务架构 (1天)
**目标**: 建立基础服务结构

#### 1.1 服务入口点重构
```typescript
// src/controllers/DatasetSearchController.ts 增强
export class DatasetSearchController {
  // 替换 Webhook1 逻辑
  async executeSearch(req: Request, res: Response) {
    const { institution_name, excelexist, user_id, date, keywords } = req.body;
    const executionId = this.generateExecutionId();

    // 条件分支逻辑
    if (excelexist === "True") {
      return this.executeExcelWorkflow(executionId, req.body);
    } else {
      return this.executeTextWorkflow(executionId, req.body);
    }
  }
}
```

#### 1.2 关键词处理服务
```typescript
// src/services/KeywordProcessingService.ts (新建)
export class KeywordProcessingService {
  parseKeywords(keywords: string): Array<{Name: string}> {
    // 迁移 Code1 逻辑
    if (keywords?.startsWith('[') && keywords.endsWith(']')) {
      return JSON.parse(keywords);
    }
    return keywords?.split(',')
      .map(k => k.trim())
      .filter(k => k)
      .map(k => ({Name: k})) || [];
  }
}
```

#### 1.3 外部数据获取服务
```typescript
// src/services/ExternalDataService.ts (新建)
export class ExternalDataService {
  async getRiskOrganizations(): Promise<Array<{Name: string}>> {
    const url = 'http://raw.githubusercontent.com/BlearKK/list_storage/refs/heads/main/Named%20Research%20Organizations.json';
    // 迁移 HTTP Request 逻辑 + Code 逻辑
  }

  combineDataSources(keywords: any[], riskOrgs: any[]): any[] {
    // 迁移数据合并逻辑
  }
}
```

### 阶段2: 搜索引擎集成 (1天)
**目标**: 集成Linkup API和AI分析

#### 2.1 Linkup API服务
```typescript
// src/services/LinkupSearchService.ts (新建)
export class LinkupSearchService {
  private readonly API_URL = 'https://api.linkup.so/v1/search';
  private readonly API_KEY = process.env.LINKUP_API_KEY;

  async searchRelationship(
    institution: string,
    riskEntity: string,
    systemPrompt: string
  ): Promise<LinkupResponse> {
    // 迁移 call_linkup_request 逻辑
  }
}
```

#### 2.2 AI分析服务
```typescript
// src/services/OSINTAnalysisService.ts (新建)
export class OSINTAnalysisService {
  private readonly SYSTEM_PROMPT = `You are a Research Security Analyst...`; // 完整提示词

  async analyzeRelationship(institution: string, entity: string): Promise<AnalysisResult> {
    // 结合 Set Current NRO Data1 + Prompt generate1 + Linkup调用逻辑
  }

  parseAnalysisResult(linkupResponse: any): ParsedResult {
    // 迁移 清理answer和url格式1 + 清理answer和url格式2 逻辑
  }
}
```

### 阶段3: 数据存储和状态管理 (0.5天)
**目标**: 实现Supabase存储和Redis状态管理

#### 3.1 数据存储服务增强
```typescript
// src/services/SupabaseService.ts 增强
export class SupabaseService {
  async storeSearchResult(result: SearchResultData): Promise<void> {
    // 迁移 Create a row + no evidence 逻辑
    await this.supabase
      .from('real_time_results')
      .insert({
        execution_id: result.executionId,
        user_id: result.userId,
        event_type: result.hasFindings ? 'new_result' : 'new_result',
        search_type: 'chain_reaction',
        relationship_type: result.relationshipType,
        entity_name: result.entityName,
        answer: result.formattedAnswer,
        sources: result.sources ? JSON.stringify(result.sources) : null
      });
  }
}
```

#### 3.2 状态管理服务
```typescript
// src/services/ExecutionStateService.ts (新建)
export class ExecutionStateService {
  async setCancelFlag(executionId: string): Promise<void> {
    // 迁移 Redis set 逻辑
  }

  async checkCancelFlag(executionId: string): Promise<boolean> {
    // 迁移 Redis get 逻辑
  }
}
```

### 阶段4: 实时通信和API兼容 (0.5天)
**目标**: 实现实时通信和确保前端兼容

#### 4.1 实时通信服务
```typescript
// src/services/RealTimeService.ts (新建)
export class RealTimeService {
  // 替换Pusher为Server-Sent Events
  async sendProgress(executionId: string, progress: ProgressData): Promise<void> {
    // 实现SSE推送逻辑
  }

  async sendCompletion(executionId: string, summary: CompletionData): Promise<void> {
    // 迁移 Code2 完成通知逻辑
  }
}
```

#### 4.2 API兼容性确保
```typescript
// 确保响应格式与N8N保持一致
interface ExecutionResponse {
  executionId: string;
  pusherConfig: {
    key: string;
    cluster: string;
    channelName: string;
  };
  message: string;
  status: string;
}
```

---

## ⚠️ 风险评估和缓解策略

### 高风险项
1. **Linkup API配额和限制**
   - **风险**: API调用频率限制
   - **缓解**: 实现请求队列和重试机制

2. **GitHub数据源可用性**
   - **风险**: 外部数据源不可用
   - **缓解**: 实现本地缓存和备份数据源

### 中风险项
1. **数据库性能**
   - **风险**: 大量并发写入可能影响性能
   - **缓解**: 实现批量插入和连接池管理

2. **实时通信稳定性**
   - **风险**: SSE连接可能不稳定
   - **缓解**: 实现重连机制和降级方案

### 低风险项
1. **前端API兼容性**
   - **风险**: 响应格式可能不完全一致
   - **缓解**: 详细的API测试和逐步迁移

---

## 📊 成功指标和验收标准

### 功能完整性
- [ ] 所有N8N节点逻辑成功迁移
- [ ] Linkup API调用正常工作
- [ ] 数据库存储格式正确
- [ ] 实时通信功能正常

### 性能指标
- [ ] 搜索响应时间 < 60秒
- [ ] 数据库写入延迟 < 1秒
- [ ] 内存使用 < 512MB
- [ ] CPU使用率 < 80%

### 可靠性指标
- [ ] API错误率 < 5%
- [ ] 数据完整性 100%
- [ ] 取消功能可靠性 100%

---

## 📅 实施时间表

### 简化版实施计划 (推荐)

| 阶段 | 任务 | 预计时间 | 状态 | 依赖项 |
|------|------|----------|------|--------|
| 1 | 核心服务开发 | 1天 | 🟡 进行中 | Linkup API配置已确认 |
| 2 | SSE集成和测试 | 0.5天 | ⭕ 待开始 | 核心服务完成 |
| 3 | 前端适配和优化 | 0.5天 | ⭕ 待开始 | SSE集成完成 |

**简化版总计**: 2天 (16小时开发时间)

### 原始完整版实施计划 (备选)

| 阶段 | 任务 | 预计时间 | 依赖项 |
|------|------|----------|--------|
| 1 | 核心服务架构 | 1天 | 现有dataset_search服务 |
| 2 | 搜索引擎集成 | 1天 | Linkup API密钥 |
| 3 | 数据存储和状态管理 | 0.5天 | Supabase配置 |
| 4 | 实时通信和API兼容 | 0.5天 | 前端测试环境 |

**完整版总计**: 3天 (24小时开发时间)

---

## 🔗 相关文档

- [API端点映射文档](./API_ENDPOINTS_MAPPING.md)
- [数据库结构分析](./DATABASE_SCHEMA_ANALYSIS.md)
- [N8N工作流源文件](./Dataset%20Search%201.json)
- [N8N工作流源文件](./Dataset%20Search%202.json)
- [N8N工作流源文件](./Dataset%20Search%204.json)

---

## 📝 更新日志

### v2.0 (2025-09-30)
- ✅ **添加简化版实施方案**: 基于用户反馈制定的优化版workflow
- ✅ **确认技术参数**: Linkup API配置、系统提示词、并发限制 (10 queries/second)
- ✅ **修正API响应格式**: 记录实际的`{answer, sources}`格式，添加解析策略
- ✅ **完整系统提示词**: 记录完整的OSINT分析提示词模板和动态变量替换
- ✅ **数据源优化**: 从GitHub API迁移到Supabase Canadian NRO数据
- ✅ **架构简化**: 移除Redis和Pusher依赖，使用内存状态管理和SSE
- ✅ **新增服务**: LinkupResponseParser和PromptBuilderService
- ✅ **性能提升策略**: 2并发搜索 + 速率限制，预计减少50%执行时间
- ✅ **实时体验**: 每个搜索结果完成立即显示并存储

### v1.0 (2025-09-29)
- 初始版本：完整的N8N工作流分析和迁移方案
- 包含所有N8N节点的详细解析
- 完整的TypeScript代码迁移路线图

---

*本报告为Dataset Search N8N到TypeScript迁移提供完整的技术指导。v2.0版本基于实际需求优化，专注于简化版实施方案。*