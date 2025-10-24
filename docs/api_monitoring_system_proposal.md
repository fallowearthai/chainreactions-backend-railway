# 系统级API监控与Token用量统计方案

## 📋 项目概述

### 背景
ChainReactions是一个企业级OSINT平台，采用微服务架构，当前包含6个独立服务直接连接前端。为了实现精确的成本控制、性能监控和商业决策支持，需要建立一个系统级的API监控和Token用量统计系统。

### 当前架构
```
前端 (3001) → Entity Relations (3002)
           → Entity Search (3003)
           → Dataset Matching (3004)
           → Data Management (3005)
           → Dataset Search (3006)
```

### 核心需求
1. **全系统API监控**: 覆盖所有6个微服务和外部API调用
2. **Token用量统计**: 精确记录输入/输出token和成本
3. **避免Middleware陷阱**: 针对长时间运行API的正确追踪
4. **实时监控**: Monitoring和Admin界面的实时数据展示
5. **成本管理**: 预算控制、成本预测和警报

## 🎯 完整监控范围

### 内部微服务监控
- **Entity Relations API** (3002): DeepThinking模式、Normal模式、SSE流
- **Entity Search API** (3003): Linkup API集成、公司信息搜索
- **Dataset Matching API** (3004): 实体匹配算法、缓存管理
- **Data Management API** (3005): 文件上传、CSV处理、数据库操作
- **Dataset Search API** (3006): SSE流、实时进度、双Linkup处理

### 外部API监控
- **Google Gemini API**: 生成式AI调用、Grounding搜索
- **Linkup API** (2个key): 专业商业数据搜索
- **Bright Data SERP API**: 多引擎搜索结果
- **Supabase API**: 数据库操作、实时同步
- **Gmail SMTP**: 邮件发送服务

### 监控指标类型
- **性能指标**: 响应时间、成功率、RPM、并发数
- **用量指标**: Token数量、API调用次数、数据传输量
- **成本指标**: 实时成本、预算使用率、预测成本
- **业务指标**: 用户活跃度、功能使用率、错误分布

## 🏗️ 独立监控服务架构

### 目录结构
```
/Users/kanbei/Code/chainreactions_backend/
├── services/
│   └── api-monitoring/          # 新建独立监控服务 (端口3007)
│       ├── src/
│       │   ├── services/
│       │   │   ├── MonitoringService.ts      # 核心监控逻辑
│       │   │   ├── TokenTracker.ts           # Token用量追踪
│       │   │   ├── MetricsCollector.ts        # 实时指标收集
│       │   │   ├── CostCalculator.ts         # 成本计算
│       │   │   ├── AlertManager.ts           # 智能警报
│       │   │   └── DatabaseService.ts        # 数据库操作
│       │   ├── controllers/
│       │   │   ├── MonitoringController.ts    # 监控API端点
│       │   │   ├── TokenController.ts        # Token用量API
│       │   │   ├── CostController.ts         # 成本管理API
│       │   │   └── AlertController.ts        # 警报管理API
│       │   ├── models/
│       │   │   ├── APIMetrics.ts             # API指标模型
│       │   │   ├── TokenUsage.ts             # Token使用模型
│       │   │   ├── CostMetrics.ts            # 成本指标模型
│       │   │   ├── ServiceHealth.ts          # 服务健康模型
│       │   │   └── Alert.ts                  # 警报模型
│       │   ├── utils/
│       │   │   ├── APITracker.ts             # API追踪工具
│       │   │   ├── TokenCounter.ts           # Token计算工具
│       │   │   ├── MetricsCalculator.ts      # 指标计算
│       │   │   ├── DateUtils.ts              # 日期工具
│       │   │   └── ValidationUtils.ts        # 验证工具
│       │   ├── database/
│       │   │   ├── migrations/               # 数据库迁移文件
│       │   │   │   ├── 001_create_metrics_tables.sql
│       │   │   │   ├── 002_create_token_usage_tables.sql
│       │   │   │   ├── 003_create_cost_tables.sql
│       │   │   │   └── 004_create_alerts_tables.sql
│       │   │   ├── connection.ts             # 数据库连接
│       │   │   └── queries.ts                # SQL查询
│       │   ├── websocket/
│       │   │   ├── WebSocketServer.ts         # WebSocket服务器
│       │   │   └── handlers.ts               # 消息处理器
│       │   ├── config/
│       │   │   ├── database.ts               # 数据库配置
│       │   │   ├── redis.ts                  # Redis配置
│       │   │   └── monitoring.ts             # 监控配置
│       │   └── app.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── .env.example
└── shared/
    └── monitoring/               # 所有服务共享的监控库
        ├── APITracker.ts          # 装饰器/主动追踪工具
        ├── TokenTracker.ts        # Token追踪工具
        ├── decorators.ts          # TypeScript装饰器
        ├── types.ts              # 统一类型定义
        ├── constants.ts          # 监控常量
        └── utils.ts              # 共享工具函数
```

## 📊 核心数据模型

### API指标模型
```typescript
interface APIMetrics {
  id: string;
  timestamp: number;
  service: string;
  service_port: number;
  endpoint: string;
  method: string;
  user_id?: string;
  session_id?: string;
  response_time: number;
  status_code: number;
  success: boolean;
  error_type?: string;
  error_message?: string;
  request_size?: number;
  response_size?: number;
  // Token相关
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  estimated_cost?: number;
  // 外部API信息
  api_provider: 'gemini' | 'linkup' | 'bright_data' | 'supabase' | 'internal';
  api_endpoint?: string;
  model?: string;
  // 业务分类
  search_type?: 'entity_relations' | 'entity_search' | 'dataset_search' | 'dataset_matching';
  feature_flag?: string;
}
```

### Token用量模型
```typescript
interface TokenUsage {
  id: string;
  timestamp: number;
  api_provider: string;
  api_endpoint: string;
  model?: string;
  user_id?: string;
  service: string;
  session_id?: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  request_type: 'search' | 'analysis' | 'embedding' | 'chat' | 'grounding';
  search_keywords?: string[];
  query_complexity?: 'low' | 'medium' | 'high';
  cache_hit?: boolean;
}
```

### 成本指标模型
```typescript
interface CostMetrics {
  id: string;
  timestamp: number;
  period: 'hour' | 'day' | 'week' | 'month';
  total_cost: number;
  currency: string;
  cost_by_provider: {
    gemini: number;
    linkup: number;
    bright_data: number;
    supabase: number;
    internal: number;
  };
  cost_by_service: {
    entity_relations: number;
    entity_search: number;
    dataset_matching: number;
    data_management: number;
    dataset_search: number;
  };
  cost_by_user: Record<string, number>;
  token_usage: {
    total_input_tokens: number;
    total_output_tokens: number;
    total_tokens: number;
  };
  budget_utilization: {
    daily_budget: number;
    daily_used: number;
    monthly_budget: number;
    monthly_used: number;
  };
}
```

### 服务健康模型
```typescript
interface ServiceHealth {
  service: string;
  port: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  last_check: number;
  response_time: number;
  uptime: number;
  error_rate: number;
  active_connections: number;
  memory_usage?: number;
  cpu_usage?: number;
  features: string[];
  endpoints: {
    path: string;
    method: string;
    status: 'active' | 'disabled';
    avg_response_time: number;
  }[];
}
```

## 🔧 避免Middleware陷阱的实现

### 问题分析
传统的Express middleware无法正确处理长时间运行的API：
- **立即记录**: Middleware在请求开始时就记录，无法获取实际响应时间
- **无法捕获结果**: 无法获取API响应的token用量和成本信息
- **异常处理复杂**: 长时间运行的异步操作的异常难以追踪

### 解决方案: 装饰器 + 主动追踪

#### 1. 装饰器模式 (推荐用于简单场景)
```typescript
// shared/monitoring/decorators.ts
export function APIMonitoring(options: {
  service: string;
  endpoint: string;
  trackTokens?: boolean;
  apiProvider?: string;
  searchType?: string;
}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const tracker = APITracker.start({
        service: options.service,
        endpoint: options.endpoint,
        userId: this.extractUserId?.(args[0]) || args[0]?.user?.id,
        trackTokens: options.trackTokens || false,
        apiProvider: options.apiProvider,
        searchType: options.searchType
      });

      try {
        const startTime = Date.now();
        const result = await method.apply(this, args);
        const responseTime = Date.now() - startTime;

        // 如果需要追踪token，从结果中提取
        if (options.trackTokens && result?.usageMetadata) {
          tracker.recordTokens({
            input: result.usageMetadata.promptTokenCount || 0,
            output: result.usageMetadata.candidatesTokenCount || 0,
            total: result.usageMetadata.totalTokenCount || 0
          });
        }

        tracker.recordSuccess(responseTime, result);
        return result;
      } catch (error) {
        tracker.recordFailure(error);
        throw error;
      }
    };
  };
}
```

#### 2. 主动追踪模式 (推荐用于复杂场景)
```typescript
// 在Controller中使用
export class EnhancedSearchController {
  @APIMonitoring({
    service: 'entity-relations',
    endpoint: '/api/enhanced/search',
    trackTokens: true,
    apiProvider: 'gemini',
    searchType: 'entity_relations'
  })
  async enhancedSearch(req: Request, res: Response) {
    const trackingId = APITracker.startTracking({
      service: 'entity-relations',
      endpoint: '/api/enhanced/search',
      userId: req.user?.id,
      sessionId: req.session?.id,
      trackTokens: true
    });

    try {
      // 执行搜索逻辑
      const result = await this.performEnhancedSearch(req.body);

      // 记录成功和token使用
      APITracker.recordSuccess(trackingId, {
        responseTime: result.responseTime,
        tokens: result.tokens,
        cost: result.estimatedCost,
        metadata: {
          search_keywords: req.body.risk_keywords,
          result_count: result.risk_analysis?.length || 0
        }
      });

      res.json(result);
    } catch (error) {
      // 记录失败
      APITracker.recordFailure(trackingId, {
        error: error.message,
        statusCode: error.statusCode || 500,
        responseTime: Date.now() - trackingId.startTime
      });

      res.status(error.statusCode || 500).json({
        error: error.message
      });
    }
  }
}
```

## 📈 Token计算与成本管理

### Gemini API Token计算
```typescript
// 从Gemini API响应中提取token信息
interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

// Gemini API定价 (2025年最新)
const GEMINI_PRICING = {
  'gemini-2.5-flash': {
    input: 0.000075,  // $0.000075 per 1k input tokens
    output: 0.00015   // $0.00015 per 1k output tokens
  },
  'gemini-2.5-pro': {
    input: 0.00125,   // $0.00125 per 1k input tokens
    output: 0.00375   // $0.00375 per 1k output tokens
  }
};

export function calculateGeminiCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = GEMINI_PRICING[model];
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;

  return inputCost + outputCost;
}
```

### Linkup API成本计算
```typescript
// Linkup API按请求计费，不是按token
const LINKUP_PRICING = {
  'professional_search': 0.01,    // $0.01 per request
  'company_search': 0.008,        // $0.008 per request
  'discovery': 0.02,              // $0.02 per request
  'bulk_search': 0.05             // $0.05 per bulk request
};

export function calculateLinkupCost(
  requestType: string,
  requestCount: number = 1
): number {
  const unitCost = LINKUP_PRICING[requestType] || 0.01;
  return unitCost * requestCount;
}
```

### Bright Data SERP API成本
```typescript
const BRIGHT_DATA_PRICING = {
  'serp_search': 0.0025,          // $0.0025 per search result
  'premium_search': 0.005,        // $0.005 per premium result
  'bulk_results': 0.001           // $0.001 per bulk result
};
```

## 🎮 实时监控API端点

### 核心监控端点 (端口3007)
```typescript
// 实时状态
GET  /api/monitoring/status               # 系统整体状态
GET  /api/monitoring/services/health      # 所有服务健康状态
GET  /api/monitoring/rpm/realtime         # 实时RPM监控
GET  /api/monitoring/active-searches      # 当前活跃搜索

// Token用量
GET  /api/monitoring/tokens/current       # 当前token使用情况
GET  /api/monitoring/tokens/history       # 历史token使用趋势
GET  /api/monitoring/tokens/by-provider   # 按API提供商分组
GET  /api/monitoring/tokens/by-service    # 按服务分组
GET  /api/monitoring/tokens/by-user       # 按用户分组

// 成本管理
GET  /api/monitoring/cost/current         # 当前成本统计
GET  /api/monitoring/cost/history         # 历史成本趋势
GET  /api/monitoring/cost/predictions     # 成本预测
GET  /api/monitoring/budget/status        # 预算状态
POST /api/monitoring/budget/set           # 设置预算警报
GET  /api/monitoring/budget/alerts        # 预算警报历史

// API性能
GET  /api/monitoring/api/metrics          # API性能指标
GET  /api/monitoring/api/errors           # 错误统计
GET  /api/monitoring/api/slow-requests    # 慢请求分析
GET  /api/monitoring/api/endpoints        # 端点性能排行

// 用户活动
GET  /api/monitoring/users/active         # 当前活跃用户
GET  /api/monitoring/users/activity       # 用户活动统计
GET  /api/monitoring/users/usage          # 用户使用排行
GET  /api/monitoring/users/sessions       # 用户会话分析

// 警报管理
GET  /api/monitoring/alerts               # 当前警报
GET  /api/monitoring/alerts/history       # 警报历史
POST /api/monitoring/alerts/acknowledge    # 确认警报
POST /api/monitoring/alerts/configure      # 配置警报规则

// 实时数据
WebSocket /ws/monitoring/realtime         # 实时数据推送
WebSocket /ws/monitoring/tokens          # Token用量实时推送
WebSocket /ws/monitoring/alerts           # 警报实时推送
```

### API响应示例

#### 实时状态响应
```json
{
  "status": "success",
  "data": {
    "timestamp": "2025-10-18T15:30:00.000Z",
    "system_health": "healthy",
    "services": [
      {
        "service": "entity-relations",
        "port": 3002,
        "status": "healthy",
        "response_time": 145,
        "active_requests": 3
      },
      {
        "service": "entity-search",
        "port": 3003,
        "status": "healthy",
        "response_time": 89,
        "active_requests": 1
      }
    ],
    "current_rpm": {
      "total_rpm": 45,
      "rpm_limit": 150,
      "usage_percentage": 30.0,
      "tier_level": 1,
      "status": "normal"
    },
    "token_usage": {
      "current_minute": {
        "total_tokens": 15420,
        "input_tokens": 8230,
        "output_tokens": 7190,
        "estimated_cost": 0.89
      }
    }
  }
}
```

#### Token用量响应
```json
{
  "status": "success",
  "data": {
    "current_usage": {
      "total_tokens": 15420,
      "input_tokens": 8230,
      "output_tokens": 7190,
      "estimated_cost": 0.89,
      "requests_count": 12
    },
    "by_provider": {
      "gemini": {
        "tokens": 12400,
        "cost": 0.75,
        "requests": 8
      },
      "linkup": {
        "tokens": 0,
        "cost": 0.12,
        "requests": 3
      },
      "bright_data": {
        "tokens": 0,
        "cost": 0.02,
        "requests": 1
      }
    },
    "by_service": {
      "entity-relations": {
        "tokens": 10200,
        "cost": 0.65,
        "requests": 6
      },
      "entity-search": {
        "tokens": 3220,
        "cost": 0.18,
        "requests": 4
      },
      "dataset-search": {
        "tokens": 2000,
        "cost": 0.06,
        "requests": 2
      }
    },
    "trend": {
      "last_hour": [1200, 1450, 1380, 1542, 1490, 1542],
      "growth_rate": 12.5
    }
  }
}
```

## 🚨 智能警报系统

### 警报类型配置
```typescript
interface AlertRule {
  id: string;
  name: string;
  type: 'rpm' | 'cost' | 'error_rate' | 'response_time' | 'token_usage';
  threshold: number;
  operator: '>' | '<' | '>=' | '<=';
  time_window: number; // 分钟
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  notification_channels: ('email' | 'slack' | 'webhook')[];
  cooldown: number; // 分钟
}

// 预设警报规则
const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'rpm_warning',
    name: 'RPM Usage Warning',
    type: 'rpm',
    threshold: 80,
    operator: '>=',
    time_window: 5,
    severity: 'medium',
    enabled: true,
    notification_channels: ['email'],
    cooldown: 15
  },
  {
    id: 'rpm_critical',
    name: 'RPM Usage Critical',
    type: 'rpm',
    threshold: 95,
    operator: '>=',
    time_window: 5,
    severity: 'critical',
    enabled: true,
    notification_channels: ['email', 'slack'],
    cooldown: 5
  },
  {
    id: 'daily_budget_warning',
    name: 'Daily Budget Warning',
    type: 'cost',
    threshold: 80,
    operator: '>=',
    time_window: 1440, // 24小时
    severity: 'high',
    enabled: true,
    notification_channels: ['email'],
    cooldown: 60
  },
  {
    id: 'error_rate_high',
    name: 'High Error Rate',
    type: 'error_rate',
    threshold: 10,
    operator: '>=',
    time_window: 10,
    severity: 'high',
    enabled: true,
    notification_channels: ['email'],
    cooldown: 30
  }
];
```

### 警报处理流程
```typescript
export class AlertManager {
  async evaluateAlerts(): Promise<void> {
    const rules = await this.getActiveAlertRules();
    const metrics = await this.getLatestMetrics();

    for (const rule of rules) {
      const currentValue = this.extractMetricValue(rule.type, metrics);
      const isTriggered = this.evaluateCondition(
        currentValue,
        rule.threshold,
        rule.operator
      );

      if (isTriggered && await this.checkCooldown(rule.id)) {
        await this.triggerAlert(rule, currentValue);
        await this.updateCooldown(rule.id);
      }
    }
  }

  private async triggerAlert(rule: AlertRule, value: number): Promise<void> {
    const alert: Alert = {
      id: generateUUID(),
      rule_id: rule.id,
      name: rule.name,
      type: rule.type,
      severity: rule.severity,
      current_value: value,
      threshold: rule.threshold,
      message: this.generateAlertMessage(rule, value),
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false
    };

    await this.saveAlert(alert);
    await this.sendNotifications(alert, rule.notification_channels);
    await this.broadcastAlert(alert); // WebSocket推送
  }
}
```

## 💾 数据存储策略

### Redis (实时数据缓存)
```typescript
// Redis键命名规范
const REDIS_KEYS = {
  // 实时指标 (1分钟TTL)
  RPM_CURRENT: 'monitoring:rpm:current',
  TOKENS_CURRENT: 'monitoring:tokens:current',
  ACTIVE_SEARCHES: 'monitoring:searches:active',
  SERVICES_HEALTH: 'monitoring:services:health',

  // 小时级指标 (1小时TTL)
  RPM_HOURLY: 'monitoring:rpm:hourly',
  TOKENS_HOURLY: 'monitoring:tokens:hourly',
  COST_HOURLY: 'monitoring:cost:hourly',

  // 用户会话 (24小时TTL)
  USER_SESSIONS: 'monitoring:users:sessions',
  ACTIVE_USERS: 'monitoring:users:active'
};

// Redis数据结构示例
interface RedisMetrics {
  timestamp: number;
  value: number;
  metadata?: Record<string, any>;
}
```

### PostgreSQL (历史数据)
```sql
-- API指标表
CREATE TABLE api_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    service VARCHAR(50) NOT NULL,
    service_port INTEGER NOT NULL,
    endpoint VARCHAR(200) NOT NULL,
    method VARCHAR(10) NOT NULL,
    user_id VARCHAR(100),
    session_id VARCHAR(100),
    response_time INTEGER NOT NULL,
    status_code INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error_type VARCHAR(100),
    error_message TEXT,
    request_size INTEGER,
    response_size INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    estimated_cost DECIMAL(10,6),
    api_provider VARCHAR(50),
    api_endpoint VARCHAR(200),
    model VARCHAR(100),
    search_type VARCHAR(50),
    feature_flag VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Token使用表
CREATE TABLE token_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    api_provider VARCHAR(50) NOT NULL,
    api_endpoint VARCHAR(200),
    model VARCHAR(100),
    user_id VARCHAR(100),
    service VARCHAR(50) NOT NULL,
    session_id VARCHAR(100),
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    estimated_cost DECIMAL(10,6) NOT NULL,
    request_type VARCHAR(50),
    search_keywords TEXT[],
    query_complexity VARCHAR(20),
    cache_hit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 成本指标表
CREATE TABLE cost_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    period VARCHAR(20) NOT NULL,
    total_cost DECIMAL(12,6) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    cost_by_provider JSONB,
    cost_by_service JSONB,
    cost_by_user JSONB,
    token_usage JSONB,
    budget_utilization JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 警报表
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    current_value DECIMAL(15,6),
    threshold DECIMAL(15,6),
    message TEXT NOT NULL,
    metadata JSONB,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引优化
CREATE INDEX idx_api_metrics_timestamp ON api_metrics(timestamp DESC);
CREATE INDEX idx_api_metrics_service ON api_metrics(service, timestamp DESC);
CREATE INDEX idx_api_metrics_user ON api_metrics(user_id, timestamp DESC);
CREATE INDEX idx_token_usage_timestamp ON token_usage(timestamp DESC);
CREATE INDEX idx_token_usage_provider ON token_usage(api_provider, timestamp DESC);
CREATE INDEX idx_cost_metrics_period ON cost_metrics(period, timestamp DESC);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);
```

### 数据保留策略
```typescript
const DATA_RETENTION_POLICY = {
  // 详细数据保留90天
  detailed_metrics: 90 * 24 * 60 * 60 * 1000, // 90天

  // 小时级汇总数据保留2年
  hourly_summary: 2 * 365 * 24 * 60 * 60 * 1000, // 2年

  // 日级汇总数据永久保留
  daily_summary: -1, // 永久保留

  // 警报记录保留1年
  alerts: 365 * 24 * 60 * 60 * 1000, // 1年

  // Redis缓存时间
  redis_cache: {
    realtime: 60, // 1分钟
    hourly: 3600, // 1小时
    daily: 86400  // 1天
  }
};
```

## 📱 前端监控界面设计

### Admin Platform监控页面结构
```
/admin/monitoring
├── dashboard              # 主仪表板
├── api-metrics           # API性能监控
├── token-usage          # Token用量分析
├── cost-management      # 成本管理
├── user-activity        # 用户活动分析
├── alerts               # 警报中心
└── settings             # 监控设置
```

#### 1. 主仪表板 (Dashboard)
```typescript
interface DashboardData {
  overview: {
    total_rpm: number;
    rpm_limit: number;
    usage_percentage: number;
    status: 'normal' | 'warning' | 'critical';
    tier_level: number;
    active_searches: number;
    total_users: number;
  };
  real_time_metrics: {
    current_rpm: number;
    token_usage_rate: number;
    cost_rate: number;
    error_rate: number;
    avg_response_time: number;
  };
  service_health: ServiceHealth[];
  recent_alerts: Alert[];
  cost_summary: {
    today_cost: number;
    month_cost: number;
    budget_usage: number;
    projected_monthly: number;
  };
}
```

#### 2. Token用量分析页面
```typescript
interface TokenUsageAnalysis {
  current_usage: {
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost: number;
  };
  usage_by_provider: Record<string, TokenUsageByProvider>;
  usage_by_service: Record<string, TokenUsageByService>;
  usage_by_user: Array<{
    user_id: string;
    tokens: number;
    cost: number;
    requests: number;
  }>;
  trends: {
    hourly: Array<{ timestamp: number; tokens: number; cost: number }>;
    daily: Array<{ date: string; tokens: number; cost: number }>;
  };
  efficiency: {
    avg_tokens_per_request: number;
    avg_cost_per_request: number;
    cache_hit_rate: number;
  };
}
```

#### 3. 成本管理页面
```typescript
interface CostManagement {
  current_costs: {
    today: number;
    this_week: number;
    this_month: number;
  };
  budget_status: {
    daily_budget: number;
    daily_used: number;
    daily_remaining: number;
    monthly_budget: number;
    monthly_used: number;
    monthly_remaining: number;
  };
  cost_breakdown: {
    by_provider: Record<string, number>;
    by_service: Record<string, number>;
    by_user: Array<{ user_id: string; cost: number; percentage: number }>;
  };
  predictions: {
    expected_monthly: number;
    recommended_budget: number;
    upgrade_timeline: string;
  };
  alerts: BudgetAlert[];
}
```

### WebSocket实时更新
```typescript
// 前端WebSocket客户端
class MonitoringWebSocket {
  private ws: WebSocket;
  private subscribers: Map<string, Function[]> = new Map();

  connect() {
    this.ws = new WebSocket('ws://localhost:3007/ws/monitoring/realtime');

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.notifySubscribers(data.type, data.payload);
    };
  }

  subscribe(type: string, callback: Function) {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, []);
    }
    this.subscribers.get(type)!.push(callback);
  }

  private notifySubscribers(type: string, data: any) {
    const callbacks = this.subscribers.get(type) || [];
    callbacks.forEach(callback => callback(data));
  }
}

// 使用示例
const monitoringWS = new MonitoringWebSocket();
monitoringWS.connect();

// 订阅RPM更新
monitoringWS.subscribe('rpm_update', (data) => {
  updateRPMChart(data);
});

// 订阅Token用量更新
monitoringWS.subscribe('token_update', (data) => {
  updateTokenUsageChart(data);
});

// 订阅警报
monitoringWS.subscribe('alert', (alert) => {
  showAlertNotification(alert);
});
```

## 🔄 实施步骤

### Phase 1: 基础设施搭建 (2-3天)
**目标**: 建立独立监控服务的基础架构

**任务清单**:
- [ ] 创建 `services/api-monitoring/` 目录结构
- [ ] 配置 TypeScript、Express、数据库连接
- [ ] 实现数据库迁移脚本
- [ ] 创建共享监控库 `shared/monitoring/`
- [ ] 实现基础的APITracker工具
- [ ] 配置Redis缓存连接
- [ ] 基础健康检查端点

**交付物**:
- 独立的监控服务 (端口3007)
- 数据库表结构
- 基础监控库

### Phase 2: Token追踪实现 (2-3天)
**目标**: 实现精确的Token用量追踪和成本计算

**任务清单**:
- [ ] 实现Token计算工具类
- [ ] 集成各API提供商的定价模型
- [ ] 改造GeminiService添加token追踪
- [ ] 改造Linkup API调用添加成本追踪
- [ ] 实现装饰器和主动追踪工具
- [ ] 创建Token使用数据模型
- [ ] 实现成本计算服务

**交付物**:
- 完整的Token追踪系统
- 精确的成本计算
- 多种追踪方式支持

### Phase 3: 监控API端点 (2-3天)
**目标**: 实现完整的监控API和WebSocket服务

**任务清单**:
- [ ] 实现所有监控API端点
- [ ] 创建WebSocket服务器
- [ ] 实现实时数据推送机制
- [ ] 创建警报管理系统
- [ ] 实现指标计算和聚合
- [ ] 添加API认证和权限控制
- [ ] 实现数据查询优化

**交付物**:
- 完整的监控API
- WebSocket实时推送
- 警报系统

### Phase 4: 服务集成改造 (3-4天)
**目标**: 将所有现有服务集成到监控系统

**任务清单**:
- [ ] 改造Entity Relations服务 (3002)
- [ ] 改造Entity Search服务 (3003)
- [ ] 改造Dataset Matching服务 (3004)
- [ ] 改造Data Management服务 (3005)
- [ ] 改造Dataset Search服务 (3006)
- [ ] 实现服务发现和注册
- [ ] 添加监控数据的批量上报
- [ ] 实现服务健康检查集成

**交付物**:
- 所有服务集成监控
- 全系统API追踪
- 服务健康监控

### Phase 5: 前端监控界面 (3-4天)
**目标**: 实现Admin Platform的监控界面

**任务清单**:
- [ ] 创建监控页面路由和布局
- [ ] 实现主仪表板界面
- [ ] 创建Token用量分析页面
- [ ] 实现成本管理界面
- [ ] 创建用户活动分析页面
- [ ] 实现警报中心界面
- [ ] 集成WebSocket实时更新
- [ ] 实现图表和数据可视化
- [ ] 添加响应式设计支持

**交付物**:
- 完整的监控界面
- 实时数据展示
- 用户友好的操作界面

### Phase 6: 测试与部署 (2天)
**目标**: 全面测试和部署监控系统

**任务清单**:
- [ ] 单元测试覆盖
- [ ] 集成测试验证
- [ ] 性能测试和优化
- [ ] 负载测试验证
- [ ] 生产环境部署配置
- [ ] 监控系统自身监控
- [ ] 文档编写和培训
- [ ] 上线部署和验证

**交付物**:
- 生产就绪的监控系统
- 完整的测试报告
- 部署和运维文档

## 💰 商业价值与ROI

### 成本控制效益
- **精确成本追踪**: 避免意外的API费用超支
- **预算管理**: 设置预算警报，控制月度支出
- **使用优化**: 识别高成本用户和功能，优化定价策略

### 性能优化效益
- **实时监控**: 快速发现性能瓶颈和系统问题
- **容量规划**: 基于历史数据进行资源规划
- **用户体验**: 提前发现并解决影响用户的问题

### 商业决策支持
- **用户行为分析**: 了解功能使用模式和用户偏好
- **收入预测**: 基于用量趋势预测未来收入
- **产品优化**: 数据驱动的功能优化决策

### 预期ROI
- **短期收益** (1-3个月): 成本控制10-20%，性能提升15%
- **中期收益** (3-6个月): 用户留存率提升5%，定价优化收益10%
- **长期收益** (6-12个月): 数据驱动决策收益20%+

## 🔧 技术要求与依赖

### 系统要求
- **Node.js**: >= 18.0.0
- **TypeScript**: >= 5.0.0
- **PostgreSQL**: >= 14.0
- **Redis**: >= 7.0
- **内存**: 最低2GB，推荐4GB

### 主要依赖
```json
{
  "dependencies": {
    "express": "^5.1.0",
    "ws": "^8.14.0",
    "pg": "^8.11.0",
    "ioredis": "^5.4.0",
    "axios": "^1.6.0",
    "uuid": "^9.0.0",
    "cron": "^3.1.0",
    "joi": "^17.11.0"
  },
  "devDependencies": {
    "@types/node": "^20.8.0",
    "@types/ws": "^8.5.0",
    "@types/pg": "^8.10.0",
    "typescript": "^5.2.0",
    "nodemon": "^3.0.0",
    "jest": "^29.7.0"
  }
}
```

### 环境配置
```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chainreactions_monitoring
DB_USER=monitoring_user
DB_PASSWORD=monitoring_password

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 服务配置
MONITORING_PORT=3007
LOG_LEVEL=info
ENVIRONMENT=production

# 警报配置
ALERT_EMAIL_ENABLED=true
ALERT_SLACK_ENABLED=false
ALERT_WEBHOOK_URL=https://hooks.slack.com/...

# 数据保留配置
DETAIL_RETENTION_DAYS=90
HOURLY_RETENTION_MONTHS=24
```

## 📋 验收标准

### 功能验收标准
- [ ] 所有6个微服务的API调用100%追踪
- [ ] Token用量计算准确率99.9%+
- [ ] 成本计算误差<1%
- [ ] 实时数据延迟<1秒
- [ ] 警报响应时间<30秒
- [ ] 前端界面响应时间<2秒
- [ ] 系统可用性>99.9%

### 性能验收标准
- [ ] 监控系统本身API响应时间<100ms
- [ ] 数据库查询优化，复杂查询<500ms
- [ ] WebSocket连接支持1000+并发
- [ ] 内存使用<512MB
- [ ] CPU使用率<20%

### 安全验收标准
- [ ] API认证和授权机制完善
- [ ] 敏感数据加密存储
- [ ] 访问日志完整记录
- [ ] 数据备份和恢复机制
- [ ] 漏洞扫描通过

## 📚 文档与培训

### 技术文档
- [ ] API文档 (OpenAPI/Swagger)
- [ ] 数据库设计文档
- [ ] 部署和运维文档
- [ ] 故障排除指南

### 用户文档
- [ ] 监控界面使用指南
- [ ] 警报配置指南
- [ ] 成本管理指南
- [ ] 数据分析指南

### 培训计划
- [ ] 开发团队技术培训
- [ ] 运维团队使用培训
- [ ] 管理团队数据解读培训

---

## 📞 项目联系信息

**项目负责人**: [待定]
**技术负责人**: [待定]
**预期开始时间**: [待定]
**预期完成时间**: [待定]

**文档版本**: v1.0
**最后更新**: 2025-10-18
**文档状态**: 待审批

---

*本方案基于ChainReactions当前的微服务架构设计，旨在提供完整的API监控、Token用量统计和成本管理解决方案。*