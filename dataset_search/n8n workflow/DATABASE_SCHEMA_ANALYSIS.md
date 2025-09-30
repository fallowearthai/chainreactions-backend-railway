# 数据库结构分析文档

> **目的**: 分析N8N工作流中的数据存储逻辑，设计TypeScript服务的数据库架构
> **更新日期**: 2025-09-29

---

## 📊 N8N数据存储分析

### 当前使用表: `real_time_results`

基于N8N工作流分析，发现了完整的Supabase数据存储逻辑：

#### 表结构推断 (从N8N节点分析得出)
```sql
-- real_time_results表结构 (推断)
CREATE TABLE real_time_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  search_type TEXT NOT NULL DEFAULT 'chain_reaction',
  event_type TEXT NOT NULL, -- 'new_result', 'processing_complete'
  relationship_type TEXT, -- 'Direct', 'Indirect', 'Significant Mention', 'Unknown', 'No Evidence Found'
  entity_name TEXT,
  answer TEXT,
  sources JSONB, -- 存储完整的Linkup API sources响应
  channel_name TEXT, -- 用于实时通信
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引建议
CREATE INDEX idx_real_time_results_execution_id ON real_time_results(execution_id);
CREATE INDEX idx_real_time_results_user_id ON real_time_results(user_id);
CREATE INDEX idx_real_time_results_created_at ON real_time_results(created_at);
```

---

## 💾 N8N数据写入逻辑分析

### 写入场景1: 有证据发现 (Create a row节点)

**N8N节点配置**:
```json
{
  "tableId": "real_time_results",
  "fieldsUi": {
    "fieldValues": [
      {
        "fieldId": "execution_id",
        "fieldValue": "{{ $('Get Initial Params').item.json.executionId }}"
      },
      {
        "fieldId": "user_id",
        "fieldValue": "{{ $('Get Initial Params').item.json.user_id }}"
      },
      {
        "fieldId": "event_type",
        "fieldValue": "new_result"
      },
      {
        "fieldId": "search_type",
        "fieldValue": "chain_reaction"
      },
      {
        "fieldId": "relationship_type",
        "fieldValue": "{{ $('清理answer和url格式1').item.json.items[0].relationship_type }}"
      },
      {
        "fieldId": "entity_name",
        "fieldValue": "{{ $('Loop Over Items').item.json.entityName }}"
      },
      {
        "fieldId": "answer",
        "fieldValue": "{{ $('清理answer和url格式2').item.json.result }}"
      },
      {
        "fieldId": "sources",
        "fieldValue": "{{ $('Code3').item.json.source }}"
      }
    ]
  }
}
```

**触发条件**:
- `relationship_type` ∉ {"No Evidence Found", "Significant Mention"}
- 即: "Direct", "Indirect", "Unknown"关系类型

**数据示例**:
```json
{
  "execution_id": "mfcoo5rjr0u4b330ay",
  "user_id": "4a2f144c-62b7-4b3f-8c52-554175ff7bff",
  "event_type": "new_result",
  "search_type": "chain_reaction",
  "relationship_type": "Direct",
  "entity_name": "National University of Defense Technology",
  "answer": "Risk Item: National University of Defense Technology\\nRelationship Type: Direct\\nFinding Summary: Joint research collaboration documented in multiple sources...",
  "sources": "{\"sources\":[{\"url\":\"https://example.com\",\"title\":\"Research Report\"}]}"
}
```

### 写入场景2: 无证据或重要提及 (no evidence节点)

**N8N节点配置**:
```json
{
  "tableId": "real_time_results",
  "fieldsUi": {
    "fieldValues": [
      {
        "fieldId": "execution_id",
        "fieldValue": "{{ $('Get Initial Params').item.json.executionId }}"
      },
      {
        "fieldId": "user_id",
        "fieldValue": "{{ $('Get Initial Params').item.json.user_id }}"
      },
      {
        "fieldId": "event_type",
        "fieldValue": "new_result"
      },
      {
        "fieldId": "search_type",
        "fieldValue": "chain_reaction"
      },
      {
        "fieldId": "relationship_type",
        "fieldValue": "{{ $('清理answer和url格式1').item.json.items[0].relationship_type }}"
      },
      {
        "fieldId": "entity_name",
        "fieldValue": "{{ $('Loop Over Items').item.json.entityName }}"
      },
      {
        "fieldId": "answer",
        "fieldValue": "{{ $('清理answer和url格式2').item.json.result }}"
      }
    ]
  }
}
```

**触发条件**:
- `relationship_type` ∈ {"No Evidence Found", "Significant Mention"}

**特点**:
- 不包含`sources`字段
- `answer`字段依然包含格式化的结果

### 写入场景3: 处理完成通知 (no evidence1节点)

**N8N节点配置**:
```json
{
  "tableId": "real_time_results",
  "fieldsUi": {
    "fieldValues": [
      {
        "fieldId": "execution_id",
        "fieldValue": "{{ $('Get Initial Params').item.json.executionId }}"
      },
      {
        "fieldId": "user_id",
        "fieldValue": "{{ $('Get Initial Params').item.json.user_id }}"
      },
      {
        "fieldId": "event_type",
        "fieldValue": "processing_complete"
      },
      {
        "fieldId": "search_type",
        "fieldValue": "chain_reaction"
      },
      {
        "fieldId": "entity_name",
        "fieldValue": "{{ $('Get Initial Params').item.json.institutionAFromQuery }}"
      }
    ]
  }
}
```

**触发时机**: 所有实体处理完成后
**特点**:
- `event_type` = "processing_complete"
- `entity_name` = 查询的主要机构名称
- 其他字段为NULL

---

## 🔄 数据处理流程

### 数据格式化链路

#### 原始Linkup响应 → 格式化输出

**步骤1: 清理answer和url格式1**
- **输入**: Linkup API原始JSON响应
- **输出**: 解析出的结构化数据
- **关键字段**: `items[0].risk_item`, `items[0].relationship_type`, `items[0].finding_summary`, `urls`

**步骤2: 清理answer和url格式2**
```javascript
// N8N Code节点逻辑
const riskItem = $input.first().json.items[0].risk_item;
const relationshipType = $input.first().json.items[0].relationship_type;
const findingSummary = $input.first().json.items[0].finding_summary;
const sourceUrls = $input.first().json.urls || [];

// 格式化输出 (使用\\n作为换行符)
let formattedOutput = `Risk Item: ${riskItem}\\nRelationship Type: ${relationshipType}\\nFinding Summary: ${findingSummary}`;

// 处理URLs
let urlsString = '';
if (sourceUrls.length > 0) {
  sourceUrls.forEach((url, index) => {
    urlsString += `${index + 1}. ${url}\\n`;
  });
}

return [{
  json: {
    result: formattedOutput,     // 存储到answer字段
    urls: urlsString,           // 单独的URL字符串
    totalItems: totalItems
  }
}];
```

**步骤3: Code3 (Sources处理)**
```javascript
// 处理Linkup sources对象
const sourceObject = $('call_linkup_request').first().json.sources || {};
const sourceString = JSON.stringify(sourceObject);  // 存储到sources字段

return [{
  json: {
    source: sourceString
  }
}];
```

---

## 🏗️ TypeScript数据库架构设计

### 建议的表结构优化

```sql
-- 优化后的real_time_results表
CREATE TABLE real_time_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  search_type TEXT NOT NULL DEFAULT 'chain_reaction',
  event_type TEXT NOT NULL CHECK (event_type IN ('new_result', 'processing_complete', 'error', 'cancelled')),
  relationship_type TEXT CHECK (relationship_type IN ('Direct', 'Indirect', 'Significant Mention', 'Unknown', 'No Evidence Found')),
  entity_name TEXT,
  institution_name TEXT, -- 新增: 查询的主要机构
  answer TEXT,
  sources JSONB, -- Linkup API sources的JSON存储
  urls TEXT[], -- 新增: URL数组，便于查询
  processing_time_ms INTEGER, -- 新增: 处理耗时
  error_message TEXT, -- 新增: 错误信息
  channel_name TEXT, -- 实时通信频道
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引策略
CREATE INDEX idx_real_time_results_execution_id ON real_time_results(execution_id);
CREATE INDEX idx_real_time_results_user_id ON real_time_results(user_id);
CREATE INDEX idx_real_time_results_event_type ON real_time_results(event_type);
CREATE INDEX idx_real_time_results_relationship_type ON real_time_results(relationship_type);
CREATE INDEX idx_real_time_results_created_at ON real_time_results(created_at);
CREATE INDEX idx_real_time_results_sources_gin ON real_time_results USING GIN (sources); -- 支持JSONB查询
```

### 补充表: 执行状态跟踪

```sql
-- 新增: 执行状态表
CREATE TABLE execution_status (
  execution_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'cancelled', 'error')),
  institution_name TEXT NOT NULL,
  keywords JSONB, -- 存储关键词列表
  total_entities INTEGER DEFAULT 0,
  processed_entities INTEGER DEFAULT 0,
  found_relationships INTEGER DEFAULT 0,
  processing_start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processing_end_time TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  cancel_requested_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB -- 存储额外的执行元数据
);

CREATE INDEX idx_execution_status_user_id ON execution_status(user_id);
CREATE INDEX idx_execution_status_status ON execution_status(status);
CREATE INDEX idx_execution_status_start_time ON execution_status(processing_start_time);
```

---

## 📝 TypeScript数据存储服务设计

### SupabaseService增强

```typescript
// src/services/SupabaseService.ts
export interface SearchResultData {
  executionId: string;
  userId: string;
  entityName: string;
  institutionName: string;
  relationshipType: 'Direct' | 'Indirect' | 'Significant Mention' | 'Unknown' | 'No Evidence Found';
  answer: string;
  sources?: any;
  urls?: string[];
  processingTimeMs?: number;
  errorMessage?: string;
}

export interface ExecutionStatusData {
  executionId: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'error';
  institutionName: string;
  keywords: any[];
  totalEntities: number;
  processedEntities: number;
  foundRelationships: number;
  errorMessage?: string;
  metadata?: any;
}

export class SupabaseService {
  // 迁移 "Create a row" 逻辑
  async storeSearchResult(data: SearchResultData): Promise<void> {
    const insertData = {
      execution_id: data.executionId,
      user_id: data.userId,
      event_type: 'new_result',
      search_type: 'chain_reaction',
      relationship_type: data.relationshipType,
      entity_name: data.entityName,
      institution_name: data.institutionName,
      answer: data.answer,
      sources: data.sources ? JSON.stringify(data.sources) : null,
      urls: data.urls,
      processing_time_ms: data.processingTimeMs,
      error_message: data.errorMessage
    };

    const { error } = await this.supabase
      .from('real_time_results')
      .insert(insertData);

    if (error) {
      throw new Error(`Failed to store search result: ${error.message}`);
    }
  }

  // 迁移 "no evidence1" 逻辑
  async storeProcessingComplete(executionId: string, userId: string, institutionName: string): Promise<void> {
    const { error } = await this.supabase
      .from('real_time_results')
      .insert({
        execution_id: executionId,
        user_id: userId,
        event_type: 'processing_complete',
        search_type: 'chain_reaction',
        entity_name: institutionName
      });

    if (error) {
      throw new Error(`Failed to store processing complete: ${error.message}`);
    }
  }

  // 新增: 执行状态管理
  async createExecutionStatus(data: ExecutionStatusData): Promise<void> {
    const { error } = await this.supabase
      .from('execution_status')
      .insert({
        execution_id: data.executionId,
        user_id: data.userId,
        status: data.status,
        institution_name: data.institutionName,
        keywords: data.keywords,
        total_entities: data.totalEntities,
        processed_entities: data.processedEntities,
        found_relationships: data.foundRelationships,
        error_message: data.errorMessage,
        metadata: data.metadata
      });

    if (error) {
      throw new Error(`Failed to create execution status: ${error.message}`);
    }
  }

  async updateExecutionStatus(executionId: string, updates: Partial<ExecutionStatusData>): Promise<void> {
    const { error } = await this.supabase
      .from('execution_status')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('execution_id', executionId);

    if (error) {
      throw new Error(`Failed to update execution status: ${error.message}`);
    }
  }

  async getExecutionStatus(executionId: string): Promise<ExecutionStatusData | null> {
    const { data, error } = await this.supabase
      .from('execution_status')
      .select('*')
      .eq('execution_id', executionId)
      .single();

    if (error && error.code !== 'PGRST116') { // 'PGRST116' = not found
      throw new Error(`Failed to get execution status: ${error.message}`);
    }

    return data;
  }

  // 查询搜索结果
  async getSearchResults(executionId: string): Promise<SearchResultData[]> {
    const { data, error } = await this.supabase
      .from('real_time_results')
      .select('*')
      .eq('execution_id', executionId)
      .eq('event_type', 'new_result')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to get search results: ${error.message}`);
    }

    return data.map(row => ({
      executionId: row.execution_id,
      userId: row.user_id,
      entityName: row.entity_name,
      institutionName: row.institution_name,
      relationshipType: row.relationship_type,
      answer: row.answer,
      sources: row.sources ? JSON.parse(row.sources) : null,
      urls: row.urls,
      processingTimeMs: row.processing_time_ms,
      errorMessage: row.error_message
    }));
  }
}
```

---

## 🔗 Redis状态管理

### N8N Redis逻辑分析

**N8N Redis操作**:
```javascript
// 设置取消标志
{
  "operation": "set",
  "key": "cancel_flag:{{ $json.body.executionId }}",
  "value": "true",
  "expire": true,
  "ttl": 3600
}

// 查询取消标志
{
  "operation": "get",
  "propertyName": "isCancelled",
  "key": "cancel_flag:{{ $json.query.executionId }}"
}
```

### TypeScript Redis服务

```typescript
// src/services/ExecutionStateService.ts
import Redis from 'ioredis';

export class ExecutionStateService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  // 迁移Redis set逻辑
  async setCancelFlag(executionId: string): Promise<void> {
    const key = `cancel_flag:${executionId}`;
    await this.redis.set(key, 'true', 'EX', 3600); // TTL: 1小时
  }

  // 迁移Redis get逻辑
  async checkCancelFlag(executionId: string): Promise<boolean> {
    const key = `cancel_flag:${executionId}`;
    const value = await this.redis.get(key);
    return value === 'true';
  }

  // 新增: 执行进度状态
  async setExecutionProgress(executionId: string, progress: any): Promise<void> {
    const key = `progress:${executionId}`;
    await this.redis.set(key, JSON.stringify(progress), 'EX', 7200); // TTL: 2小时
  }

  async getExecutionProgress(executionId: string): Promise<any | null> {
    const key = `progress:${executionId}`;
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }
}
```

---

## 📊 数据查询优化

### 常见查询模式

1. **按执行ID查询所有结果**:
```sql
SELECT * FROM real_time_results
WHERE execution_id = $1
ORDER BY created_at ASC;
```

2. **按用户查询最近搜索**:
```sql
SELECT DISTINCT execution_id, MAX(created_at) as latest_activity
FROM real_time_results
WHERE user_id = $1
GROUP BY execution_id
ORDER BY latest_activity DESC
LIMIT 20;
```

3. **统计关系类型分布**:
```sql
SELECT relationship_type, COUNT(*) as count
FROM real_time_results
WHERE execution_id = $1 AND event_type = 'new_result'
GROUP BY relationship_type;
```

4. **搜索包含特定关键词的结果**:
```sql
SELECT * FROM real_time_results
WHERE answer ILIKE '%keyword%'
AND event_type = 'new_result';
```

5. **JSONB sources查询**:
```sql
SELECT * FROM real_time_results
WHERE sources @> '{"sources": [{"domain": "example.com"}]}';
```

---

## 📋 迁移检查清单

### 数据库迁移任务
- [ ] 验证现有`real_time_results`表结构
- [ ] 添加缺失字段（urls, processing_time_ms, institution_name等）
- [ ] 创建`execution_status`表
- [ ] 添加必要索引
- [ ] 设置适当的约束条件

### 服务迁移任务
- [ ] 增强SupabaseService存储方法
- [ ] 实现ExecutionStateService Redis操作
- [ ] 迁移数据格式化逻辑
- [ ] 添加错误处理和重试机制
- [ ] 实现查询优化

### 数据一致性任务
- [ ] 确保executionId生成算法一致
- [ ] 验证数据格式化结果匹配N8N输出
- [ ] 测试Redis TTL行为
- [ ] 验证JSONB存储和查询

### 性能优化任务
- [ ] 数据库连接池配置
- [ ] 批量插入优化
- [ ] 索引性能测试
- [ ] Redis内存使用监控

---

*本文档提供了N8N工作流数据存储的完整分析，以及TypeScript服务的数据库架构设计指导，确保迁移后的数据完整性和性能。*