# Enhanced Entity Search - Research Security Analyst Tool

## 概述

这是一个专为 **Research Security Analyst** 设计的垂直化 OSINT 工具,自动化分析公司与8大敏感关键词的关联关系。

## 核心功能

### 🎯 设计目标

**区别于通用 Google AI Search,专注于 Research Security 风险筛查**

- ❌ **不是**: 通用公司信息搜索工具
- ✅ **是**: Research Security Analyst 的自动化风险筛查助手

### 🔍 双层搜索架构

#### Layer 1: 基础公司信息 (轻量级)
- 公司名称和注册信息
- 总部地址
- 主要业务领域
- 简要描述

**特点**: 简化、快速,不是重点

#### Layer 2: 风险关联分析 (核心价值)
自动搜索公司与8大敏感关键词的关联:

```javascript
const RISK_KEYWORDS = [
  'military',                    // 军事
  'defense',                     // 国防
  'civil-military fusion',       // 军民融合
  'human rights violations',     // 人权侵犯
  'sanctions',                   // 制裁
  'police technology',           // 警用技术
  'weapons',                     // 武器
  'terrorist connections'        // 恐怖主义关联
];
```

## 技术实现

### 架构设计

```
EnhancedEntitySearchService
│
├─ Layer 1: getBasicCompanyInfo()
│  └─ 1次 Gemini API 调用 (简化 prompt)
│
└─ Layer 2: analyzeRiskKeywords()
   └─ 8次 Gemini API 调用 (并行执行)
      ├─ analyzeSingleRiskKeyword("military")
      ├─ analyzeSingleRiskKeyword("defense")
      ├─ analyzeSingleRiskKeyword("civil-military fusion")
      ├─ analyzeSingleRiskKeyword("human rights violations")
      ├─ analyzeSingleRiskKeyword("sanctions")
      ├─ analyzeSingleRiskKeyword("police technology")
      ├─ analyzeSingleRiskKeyword("weapons")
      └─ analyzeSingleRiskKeyword("terrorist connections")
```

### 关键特性

1. **并行搜索**: 8个关键词同时执行(Promise.all)
2. **Grounding Metadata**: 完整的证据到来源映射
3. **自动风险评级**: high/medium/low/none
4. **智能摘要**: 自动生成风险概览

### 风险评级逻辑

```typescript
function assessSeverity(
  relationshipType: RelationshipType,
  findingSummary: string,
  sourceCount: number
): SeverityLevel {

  // No evidence found
  if (relationshipType === 'No Evidence Found') {
    return 'none';
  }

  // Direct relationships
  if (relationshipType === 'Direct') {
    // High-risk indicators
    if (findingSummary.includes('weapon') ||
        findingSummary.includes('military contract') ||
        findingSummary.includes('sanctions violation')) {
      return 'high';
    }
    return 'medium';
  }

  // Indirect or Significant Mention
  if (sourceCount >= 3) {
    return 'medium';
  }

  return 'low';
}
```

## API 响应格式

```json
{
  "success": true,
  "company": "University of Waterloo",
  "location": "Canada",

  "basic_info": {
    "name": "University of Waterloo",
    "headquarters": "200 University Avenue West...",
    "sectors": ["Higher Education", "Research"],
    "description": "..."
  },

  "risk_analysis": [
    {
      "risk_keyword": "military",
      "relationship_type": "Indirect",
      "finding_summary": "The University of Waterloo has participated...",
      "potential_intermediary_B": ["Department of Defense (U.S.)"],
      "severity": "medium",
      "sources": [...],
      "key_evidence": [...],
      "search_queries": [...]
    },
    {
      "risk_keyword": "defense",
      "relationship_type": "Direct",
      "severity": "medium",
      ...
    },
    {
      "risk_keyword": "sanctions",
      "relationship_type": "No Evidence Found",
      "severity": "none",
      ...
    }
    // ... 其他6个关键词
  ],

  "risk_summary": {
    "total_risks_found": 2,
    "high_severity_count": 0,
    "medium_severity_count": 2,
    "low_severity_count": 0,
    "overall_risk_level": "medium",
    "flagged_keywords": ["military", "defense"],
    "clean_keywords": ["sanctions", "human rights violations", ...]
  },

  "metadata": {
    "search_duration_ms": 75000,
    "total_sources": 87,
    "search_queries_executed": 156,
    "api_calls_made": 9
  }
}
```

## 使用方法

### 安装依赖

```bash
cd /Users/kanbei/Code/chainreactions_backend/test
npm install
```

### 运行测试

```bash
npm run test:enhanced
```

### 自定义测试

```typescript
import { EnhancedEntitySearchService } from './EnhancedEntitySearchService';

const service = new EnhancedEntitySearchService();

// 基础搜索 + 风险分析
const result = await service.searchEntity({
  company_name: 'Tesla Inc',
  location: 'United States',
  include_risk_analysis: true
});

// 仅基础信息(跳过风险分析)
const basicOnly = await service.searchEntity({
  company_name: 'Apple Inc',
  include_risk_analysis: false
});

// 自定义风险关键词
const custom = await service.searchEntity({
  company_name: 'Huawei',
  location: 'China',
  custom_risk_keywords: ['5G', 'surveillance', 'espionage']
});
```

## 性能指标

### 预期响应时间
- **基础信息**: ~15-20秒
- **风险分析** (8关键词并行): ~60-90秒
- **总计**: ~75-110秒

### API 调用成本
- **每次完整搜索**: 9次 Gemini API 调用
  - 1次基础信息
  - 8次风险关键词分析

### 优化策略
1. **并行执行**: 8个关键词同时搜索,不串行
2. **可选开关**: `include_risk_analysis=false` 跳过风险分析
3. **缓存机制**: (待实现)相同公司24小时内缓存结果

## 测试结果

### University of Waterloo 测试

运行测试:
```bash
npm run test:enhanced
```

预期输出:
- ✅ 基础信息成功提取
- ✅ 8个关键词全部分析完成
- ✅ 风险摘要自动生成
- ✅ 完整 JSON 保存到 `enhanced_search_result.json`

查看结果:
```bash
cat enhanced_search_result.json | jq
```

## 与现有服务的关系

### 复用 entity-relations 的逻辑

```
Enhanced Entity Search
│
├─ Layer 1: 简化版 GeminiSearchService
│  └─ 专注于基础公司信息
│
└─ Layer 2: 复用 entity-relations NormalSearch
   └─ 相同的 system prompt
   └─ 相同的 grounding metadata 提取
   └─ 相同的证据映射逻辑
```

### 区别

| 特性 | entity-relations | Enhanced Entity Search |
|------|------------------|------------------------|
| 用途 | 单个 risk entity 深度分析 | 批量8关键词筛查 |
| 输入 | Target_institution + Risk_Entity | company_name + 固定8关键词 |
| 输出 | 单个关系分析 | 8个关系分析 + 风险摘要 |
| 执行方式 | 单次调用 | 并行8次调用 |
| 目标用户 | 深度调查 | 快速筛查 |

## 差异化竞争优势

| 功能 | Google AI Search | Enhanced Entity Search |
|------|------------------|------------------------|
| 公司基础信息 | ✅ 优秀 | ✅ 良好(简化) |
| 风险关键词关联 | ❌ 需手动逐个搜索 | ✅ **自动8关键词** |
| 证据溯源 | ⚠️ 有限 | ✅ 完整 grounding |
| 风险评级 | ❌ 无 | ✅ **自动评级** |
| 风险摘要 | ❌ 无 | ✅ **自动生成** |
| Analyst 工作流程 | ❌ 手动重复8次 | ✅ **一键完成** |
| 专业性 | 通用工具 | ✅ **Research Security 垂直** |

## 未来扩展

### 短期优化
- [ ] 缓存机制(24小时内相同公司)
- [ ] SSE 流式返回(实时显示每个关键词结果)
- [ ] 自定义关键词列表
- [ ] 时间范围过滤(Start_Date/End_Date)

### 中期增强
- [ ] PDF 报告导出
- [ ] 批量公司分析
- [ ] 风险趋势分析(对比历史数据)
- [ ] 风险评分模型(ML)

### 长期集成
- [ ] 与 Dataset Matching 联动
- [ ] 与 Dataset Search NRO 数据交叉验证
- [ ] 前端可视化仪表盘
- [ ] API 限流和配额管理

## 文件说明

- `EnhancedEntitySearchService.ts` - 核心服务实现
- `test-enhanced-search.ts` - 测试脚本
- `enhanced_search_result.json` - 测试结果输出
- `ENHANCED_SEARCH_README.md` - 本文档

## 部署建议

### 迁移到 entity-search 服务

```bash
# 1. 复制核心文件
cp test/EnhancedEntitySearchService.ts services/entity-search/src/services/

# 2. 更新 Controller
# 在 EntitySearchController 中集成 EnhancedEntitySearchService

# 3. 更新 API 路由
# POST /api/entity-search 支持 include_risk_analysis 参数

# 4. 更新文档
# 更新 CLAUDE.md 和服务 README
```

---

**准备好将这个强大的工具部署到生产环境了吗?** 🚀
