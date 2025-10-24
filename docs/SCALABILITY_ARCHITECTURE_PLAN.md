# 大规模数据存储架构演进计划

## 📋 **文档概述**

本文档记录ChainReactions Backend从当前的单体数据架构向支持多用户、大规模数据的可扩展架构的完整演进路径。

### **当前状态（2025年10月）**
- **用户数量**: 10-20个测试用户
- **数据集**: 主要1个活跃数据集（Canadian Named Research Organizations）
- **数据条目**: 103个组织记录
- **架构模式**: 单体数据表 + 微服务架构

### **目标规模**
- **用户数量**: 1000+ 活跃用户
- **每用户数据集**: 平均5-10个
- **每数据集条目**: 1000-10000条
- **总数据量**: 预期500万-1000万条记录

---

## 🎯 **架构演进目标**

### **性能目标**
- **查询响应时间**: < 500ms（99%的查询）
- **批量查询**: < 2秒（10个关联公司）
- **缓存命中率**: > 85%
- **并发用户**: 支持1000+并发用户

### **扩展性目标**
- **水平扩展**: 支持用户数量线性增长
- **数据隔离**: 用户间查询性能不相互影响
- **存储扩展**: 支持TB级别数据存储
- **维护成本**: 降低大规模部署的运维复杂度

---

## 🏗️ **当前架构分析**

### **现有表结构**
```sql
-- 数据集元数据表
datasets
├── id (主键)
├── name (数据集名称)
├── description (描述)
├── is_active (是否活跃)
├── created_at (创建时间)
└── updated_at (更新时间)

-- 数据条目表 (当前核心表)
dataset_entries
├── id (主键)
├── dataset_id (外键)
├── organization_name (组织名称)
├── aliases (别名数组)
├── category (分类)
├── countries (国家数组)
├── created_at (创建时间)
└── updated_at (更新时间)
```

### **当前性能特征**
- **查询模式**: 单表查询 + PostgreSQL全文搜索
- **索引策略**: organization_name字段的基本索引
- **缓存策略**: 应用层LRU缓存（单机内存）
- **瓶颈**: 大表ILIKE查询性能下降

### **当前优势**
- **架构简单**: 单表结构，开发维护容易
- **数据一致**: ACID事务保证数据一致性
- **查询能力**: PostgreSQL强大的查询功能
- **成本效益**: 开发和运营成本较低

### **当前局限**
- **扩展性**: 单表扩展性有限
- **用户隔离**: 所有用户数据混合存储
- **查询性能**: 大数据量时性能下降明显
- **维护复杂**: 大表备份恢复时间长

---

## 🚀 **架构演进策略**

### **阶段1：性能优化（立即可实施）**

#### **1.1 数据库索引优化**
```sql
-- 为organization_name创建全文搜索索引
CREATE INDEX CONCURRENTLY idx_dataset_entries_org_name_gin
ON dataset_entries USING gin(to_tsvector('english', organization_name));

-- 为高频查询创建复合索引
CREATE INDEX CONCURRENTLY idx_dataset_entries_active_category
ON dataset_entries(category, is_active) WHERE is_active = true;

-- 为地理位置查询优化
CREATE INDEX CONCURRENTLY idx_dataset_entries_countries
ON dataset_entries USING gin(countries) WHERE is_active = true;
```

#### **1.2 查询优化**
```sql
-- 使用全文搜索替代ILIKE
SELECT organization_name, category, datasets.name, datasets.updated_at
FROM dataset_entries de
JOIN datasets d ON de.dataset_id = d.id
WHERE d.is_active = true
AND to_tsvector('english', de.organization_name) @@ to_tsquery('english', :search_terms);

-- 添加查询结果限制
LIMIT 500;
```

#### **1.3 应用层优化**
```typescript
// 结果集大小限制
class QueryOptimizer {
  static readonly MAX_RESULTS = 500;

  static optimizeQuery(query: SearchQuery): SearchQuery {
    return {
      ...query,
      limit: Math.min(query.limit || 20, QueryOptimizer.MAX_RESULTS),
      timeout: 30000 // 30秒超时
    };
  }
}

// 智能缓存策略
class SmartCacheManager {
  private hotCache = new LRUCache<DatasetMatch[]>(1000);
  private patternCache = new LRUCache<string, number>(5000);

  getCacheKey(entity: string, options?: any): string {
    return `${entity}:${options?.location || ''}:${options?.context || ''}`;
  }
}
```

#### **1.4 预期效果**
- **10万条记录**: 性能下降 < 20%
- **查询时间**: 保持在 < 1秒
- **实施成本**: 低（数据库优化）

---

### **阶段2：用户隔离存储（用户数量达到100+时）**

#### **2.1 表结构重新设计**
```sql
-- 用户数据表模板
CREATE TABLE user_dataset_template (
  id BIGSERIAL PRIMARY KEY,
  dataset_id BIGINT NOT NULL,
  organization_name TEXT NOT NULL,
  aliases TEXT[],
  category TEXT,
  countries TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 用户管理表
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  storage_quota BIGINT DEFAULT 1073741824, -- 1GB
  dataset_count INTEGER DEFAULT 0,
  total_entries BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 数据集元数据表
CREATE TABLE datasets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  table_name VARCHAR(255) NOT NULL, -- 用户专属表名
  is_active BOOLEAN DEFAULT true,
  entry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **2.2 动态表创建策略**
```typescript
class UserTableManager {
  private static readonly TABLE_PREFIX = 'user_datasets_';

  // 为新用户创建专用数据表
  static async createUserTables(userId: number): Promise<void> {
    const tableName = this.getTableName(userId);

    // 创建用户数据表
    await this.supabaseClient.rpc('create_user_table', {
      table_name: tableName
    });

    // 创建索引
    await this.supabaseClient.rpc('create_user_indexes', {
      table_name: tableName
    });
  }

  // 获取用户表名
  static getTableName(userId: number): string {
    return `${this.TABLE_PREFIX}${userId}`;
  }
}
```

#### **2.3 数据迁移策略**
```typescript
class DataMigrationService {
  // 渐进式迁移：当用户数据量超过阈值时迁移
  private readonly MIGRATION_THRESHOLD = 10000;

  async shouldMigrateUser(userId: number): Promise<boolean> {
    const count = await this.getUserDataCount(userId);
    return count > this.MIGRATION_THRESHOLD;
  }

  async migrateUserToIsolated(userId: number): Promise<void> {
    console.log(`开始迁移用户 ${userId} 到隔离存储...`);

    // 1. 创建用户专用表
    await this.createUserDataTables(userId);

    // 2. 迁移现有数据
    await this.migrateUserData(userId);

    // 3. 更新用户状态
    await this.updateUserStorageMode(userId, 'isolated');

    console.log(`用户 ${userId} 迁移完成`);
  }
}
```

#### **2.4 应用层适配**
```typescript
class DatasetStorageService {
  getTableName(userId: number): string {
    const user = await this.getUserStorageMode(userId);
    return user.storage_mode === 'isolated'
      ? `user_datasets_${userId}`
      : 'dataset_entries';
  }

  async queryUserData(userId: number, query: SearchQuery): Promise<DatasetMatch[]> {
    const tableName = this.getTableName(userId);

    // 查询用户专用表或共享表
    const result = await this.supabaseClient
      .from(tableName)
      .select('*')
      .or(this.buildSearchQuery(query))
      .limit(query.limit);

    return result.data || [];
  }

  async createUserData(userId: number, data: any): Promise<void> {
    const tableName = this.getTableName(userId);
    await this.supabaseClient.from(tableName).insert([data]);
  }
}
```

#### **2.5 预期效果**
- **用户数量**: 支持到1000+用户
- **数据量**: 支持到1000万条记录
- **查询隔离**: 用户间查询互不影响
- **实施成本**: 中等（表重构+迁移）

---

### **阶段3：分布式存储（用户数量达到1000+时）**

#### **3.1 多级存储架构**
```
┌─────────────────┐
│   应用层         │ ← 缓存层（Redis）
├─────────────────┤
│   搜索引擎层     │ ← Elasticsearch
├─────────────────┤
│   温数据层        │ ← PostgreSQL分区表
├─────────────────┤
│   冷数据层        │ ← 对象存储（S3/MinIO）
└─────────────────┘�
```

#### **3.2 搜索引擎集成**
```typescript
class ElasticsearchService {
  private client: Client;

  // 创建用户专用索引
  async createUserIndex(userId: number): Promise<void> {
    const indexName = `user_${userId}_organizations`;

    await this.client.indices.create({
      index: indexName,
      body: {
        mappings: {
          properties: {
            organization_name: {
              type: 'text',
              analyzer: 'standard',
              fields: {
                keyword: { type: 'keyword' },
                suggestion: {
                  type: 'completion',
                  analyzer: 'simple'
                }
              }
            },
            category: { type: 'keyword' },
            dataset_id: { type: 'keyword' },
            aliases: { type: 'keyword' }
          }
        }
      }
    });
  }

  // 高性能搜索
  async searchOrganizations(userId: number, query: string): Promise<any[]> {
    const indexName = `user_${userId}_organizations`;

    const response = await this.client.search({
      index: indexName,
      body: {
        query: {
          bool: {
            should: [
              { match: { organization_name: query } },
              { match: { aliases: query } },
              { fuzzy: { organization_name: query } },
              { prefix: { organization_name: query } }
            ]
          }
        },
        highlight: {
          fields: {
            organization_name: {}
          }
        }
      }
    });

    return response.body.hits.hits.map(hit => ({
      id: hit._id,
      score: hit._score,
      source: hit._source,
      highlight: hit.highlight
    }));
  }
}
```

#### **3.3 向量搜索支持**
```typescript
class VectorSearchService {
  // 语义搜索能力
  async semanticSearch(query: string, userId: number): Promise<any[]> {
    // 1. 获取查询向量
    const queryEmbedding = await this.getEmbedding(query);

    // 2. 搜索相似向量
    const similarVectors = await this.vectorSearch(
      queryEmbedding,
      userId,
      0.8 // 相似度阈值
    );

    return similarVectors;
  }

  private async getEmbedding(text: string): Promise<number[]> {
    // 调用嵌入模型API（OpenAI/Cohere等）
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float'
      })
    });

    const data = await response.json();
    return data.data[0].embedding;
  }
}
```

#### **3.4 缓存层优化**
```typescript
class DistributedCacheManager {
  private redisClient: Redis;
  private localCache: Map<string, any> = new Map();

  // 多层缓存策略
  async get(key: string): Promise<any> {
    // L1: 本地缓存
    let result = this.localCache.get(key);
    if (result !== undefined) {
      return result;
    }

    // L2: Redis缓存
    result = await this.redisClient.get(key);
    if (result !== null) {
      // 回写本地缓存
      this.localCache.set(key, JSON.parse(result), 3600); // 1小时TTL
      return JSON.parse(result);
    }

    return null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    // 同时写入两层缓存
    this.localCache.set(key, value, Math.min(ttl, 3600));
    await this.redisClient.setex(key, ttl, JSON.stringify(value));
  }
}
```

#### **3.5 预期效果**
- **用户数量**: 支持到10000+用户
- **数据量**: 支持到1亿条记录
- **搜索性能**: 毫秒级响应
- **扩展性**: 支持水平无限扩展

---

### **阶段4：AI增强搜索（长期规划）**

#### **4.1 智能数据分类**
```typescript
class IntelligentClassifier {
  // 自动为数据添加标签和分类
  async classifyOrganization(organizationName: string): Promise<ClassificationResult> {
    const classification = await this.aiModel.classify(organizationName);

    return {
      category: classification.category,
      subcategory: classification.subcategory,
      confidence: classification.confidence,
      keywords: classification.keywords,
      risk_level: classification.risk_level
    };
  }
}
```

#### **4.2 实时数据更新**
```typescript
class RealTimeDataSync {
  // 监控数据变化，实时更新索引
  async setupChangeDetection(): Promise<void> {
    // 数据库变更监听
    this.supabaseClient
      .channel('dataset_entries:*')
      .on('postgres_changes', (payload) => {
        this.handleDataChange(payload);
      });

    // 文件系统变化监听（CSV上传等）
    this.watchDataUploads();
  }

  private async handleDataChange(payload: any): Promise<void> {
    const { table, record, event_type } = payload;

    if (event_type === 'INSERT' || event_type === 'UPDATE') {
      // 实时更新搜索引擎
      await this.updateSearchIndex(record);

      // 更新向量数据库
      await this.updateVectorEmbedding(record);
    }
  }
}
```

---

## 📊 **性能基准和监控**

### **性能指标**
```typescript
interface PerformanceMetrics {
  // 响应时间指标
  averageQueryTime: number;        // 平均查询时间（毫秒）
  p95QueryTime: number;            // 95分位查询时间
  p99QueryTime: number;            // 99分位查询时间

  // 吞吐量指标
  concurrentUsers: number;          // 并发用户数
  queriesPerSecond: number;         // 每秒查询数

  // 存储指标
  totalRecords: number;            // 总记录数
  storageUsed: string;             // 存储使用量
  cacheHitRate: number;             // 缓存命中率

  // 扩展性指标
  usersCount: number;              // 总用户数
  datasetsPerUser: number;          // 每用户平均数据集数
  recordsPerDataset: number;       // 每数据集平均记录数
}
```

### **监控仪表板**
```typescript
class ScalabilityMonitor {
  // 实时性能监控
  async getRealTimeMetrics(): Promise<PerformanceMetrics> {
    return {
      averageQueryTime: await this.getAverageQueryTime(),
      p95QueryTime: await this.getP95QueryTime(),
      concurrentUsers: await this.getConcurrentUsers(),
      queriesPerSecond: await this.getQueriesPerSecond(),
      cacheHitRate: await this.getCacheHitRate(),
      totalRecords: await this.getTotalRecords(),
      storageUsed: await this.getStorageUsed(),
      usersCount: await this.getUsersCount()
    };
  }

  // 自动扩缩触发
  checkAutoScaling(): void {
    const metrics = await this.getRealTimeMetrics();

    // 查询时间过长时触发扩容
    if (metrics.p95QueryTime > 1000) {
      this.triggerScaling('up');
    }

    // 存储空间不足时触发告警
    if (metrics.storageUsedPercent > 80) {
      this.triggerStorageAlert();
    }
  }
}
```

---

## 🎯 **实施路线图**

### **时间规划**

| 阶段 | 时间 | 用户规模 | 数据规模 | 关键里程碑 |
|------|------|----------|------------|
| **当前** | Q4 2025 | 100条 |  ✅ 基础架构 |
| **阶段1** | Q1 2026 | 1万条 | 🚀 性能优化 |
| **阶段2** | Q2 2026 | 10万条 | 🎯 用户隔离 |
| **阶段3** | Q4 2026 | 100万条 | 🚀 分布式存储 |
| **阶段4** | 2027+ | 1000万+条 | 🧠 AI增强 |

### **触发条件**

#### **阶段1触发条件**
```typescript
const STAGE1_TRIGGERS = {
  totalRecords: 50000,           // 总记录数 > 5万
  averageQueryTime: 1000,      // 平均查询时间 > 1秒
  concurrentUsers: 100,          // 并发用户 > 100
  cacheHitRate: 70              // 缓存命中率 < 70%
};
```

#### **阶段2触发条件**
```typescript
const STAGE2_TRIGGERS = {
  totalUsers: 100,               // 总用户数 > 100
  recordsPerUser: 10000,          // 每用户平均记录 > 1万
  userIsolationIssues: true,     // 发现用户隔离性能问题
  storageCostPerUser: 1000     // 每用户存储成本 > $1000/月
};
```

#### **阶段3触发条件**
```typescript
const STAGE3_TRIGGERS = {
  totalUsers: 1000,              // 总用户数 > 1000
  totalRecords: 1000000,        // 总记录数 > 100万
  horizontalScalingNeeded: true,  // 需要水平扩展
  multiRegionDeployment: true      // 需要多区域部署
};
```

---

## 🛠️ **风险管理**

### **技术风险**
1. **数据迁移风险**: 大量数据迁移可能导致服务中断
2. **性能回归风险**: 架构变更可能影响现有性能
3. **复杂性增加风险**: 多架构增加运维复杂度
4. **一致性风险**: 分布式系统的数据一致性挑战

### **缓解策略**
```typescript
class RiskMitigation {
  // 渐进式迁移
  async gradualMigration(userId: number): Promise<void> {
    // 1. 验证用户数据完整性
    const dataIntegrity = await this.verifyDataIntegrity(userId);
    if (!dataIntegrity.valid) {
      throw new Error('数据完整性验证失败');
    }

    // 2. 创建用户隔离环境
    await this.createIsolatedEnvironment(userId);

    // 3. 验证迁移结果
    const migrationResult = await this.validateMigration(userId);
    if (!migrationResult.success) {
      await this.rollbackMigration(userId);
      throw new Error('迁移验证失败，已回滚');
    }

    // 4. 切换到新架构
    await this.switchToNewArchitecture(userId);
  }

  // 性能监控和自动回滚
  async monitorPerformance(userId: number): Promise<void> {
    const performance = await this.measurePerformance(userId);

    // 性能下降超过阈值时自动回滚
    if (performance.degradation > 50) {
      await this.autoRollback(userId);
    }
  }
}
```

### **成本控制**
```typescript
class CostManager {
  // 存储成本优化
  async optimizeStorageCost(): Promise<void> {
    // 1. 识别冷热数据
    const coldData = await this.identifyColdData();
    const hotData = await this.identifyHotData();

    // 2. 迁移冷数据到廉价存储
    await this.migrateToColdStorage(coldData);

    // 3. 压缩热数据到高效存储
    await this.optimizeHotStorage(hotData);
  }

  // 自动成本监控
  monitorCosts(): void {
    setInterval(async () => {
      const costs = await this.calculateCosts();

      // 成本过高时告警
      if (costs.monthly > costs.budget) {
        this.sendCostAlert(costs);
      }
    }, 86400000); // 每日检查
  }
}
```

---

## 📚 **决策框架**

### **架构选择决策矩阵**

| 考虑因素 | 单表架构 | 用户分表 | 分布式存储 | 推荐场景 |
|----------|----------|----------|--------------|----------|
| **用户规模** | < 50 | 50-500 | 500+ | 根据当前用户数选择 |
| **数据量** | < 1万 | 1万-10万 | 10万+ | 根据数据总量选择 |
| **查询复杂度** | 简单 | 中等 | 复杂 | 根据查询需求选择 |
| **预算限制** | 低 | 中等 | 高 | 根据成本预算选择 |
| **团队规模** | < 5人 | 5-20人 | 20人+ | 根据团队能力选择 |
| **合规要求** | 基础 | 中等 | 严格 | 根据合规需求选择 |

### **成本效益分析**

#### **单表架构**
- **开发成本**: 低 ($)
- **运营成本**: 低 ($/月)
- **维护成本**: 低 (1人/周)
- **扩展成本**: 高（需要重写）

#### **用户分表架构**
- **开发成本**: 中等 ($$)
- **运营成本**: 中等 ($$)
- **维护成本**: 中等 (2-3人/周)
- **扩展成本**: 中等

#### **分布式存储架构**
- **开发成本**: 高 ($$)
- **运营成本**: 高 ($$)
- **维护成本**: 高 (5+人/周)
- **扩展成本**: 低

---

## 📝 **总结和建议**

### **当前阶段建议**
基于当前用户数量（10-20个）和数据量（103条记录），建议：

1. **立即实施阶段1的性能优化**
   - 添加数据库索引
   - 优化查询语句
   - 实施智能缓存
   - 预期效果：支持到100用户，10万条记录

2. **监控性能指标**
   - 查询响应时间
   - 缓存命中率
   - 并发用户数
   - 数据增长趋势

3. **准备阶段2的架构设计**
   - 完善用户管理功能
   - 设计数据迁移策略
   - 开发表管理系统

### **长期展望**
1. **2026年Q1**: 实施用户分表架构
2. **2026年Q3**: 评估分布式存储需求
3. **2027年**: 考虑AI增强搜索

### **关键成功因素**
1. **渐进式演进**: 避免大爆炸式重构
2. **性能监控**: 实时跟踪性能指标
3. **用户体验**: 保持现有用户体验的连续性
4. **成本控制**: 优化存储和计算成本
5. **团队培训**: 确保团队掌握新技术

这个架构演进计划将帮助ChainReactions Backend从当前的小规模架构平滑演进到支持大规模用户和数据的企业级架构，同时保持系统的稳定性和高性能。