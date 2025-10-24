# Enhanced Entity Search vs Basic Entity Search - 功能对比

## 快速概览

| 维度 | Basic Entity Search | Enhanced Entity Search |
|------|---------------------|------------------------|
| **定位** | 通用公司信息搜索 | Research Security 风险筛查专用工具 |
| **核心功能** | 公司基础信息 + vendors/partnerships | 基础信息 + **8关键词风险分析** |
| **API 调用** | 1次 Gemini API | 9次 Gemini API (1基础 + 8风险) |
| **响应时间** | ~15-20秒 | ~75-110秒 |
| **输出格式** | 公司信息对象 | 公司信息 + **风险分析数组 + 风险摘要** |
| **目标用户** | 一般商业情报查询 | **Research Security Analyst** |
| **差异化价值** | 低(与 Google AI 重叠) | 高(自动化 Analyst 工作流程) |

---

## 详细功能对比

### 1. 搜索范围

#### Basic Entity Search
```javascript
搜索内容:
- ✅ 公司名称和注册信息
- ✅ 总部地址
- ✅ 行业领域
- ✅ 业务描述
- ✅ 供应商列表 (Vendors)
- ✅ 合作伙伴 (Partnerships)
- ✅ 历史名称
```

**问题**: 与 Google AI Search 功能高度重叠,缺乏差异化

#### Enhanced Entity Search
```javascript
Layer 1: 基础信息(简化)
- ✅ 公司名称
- ✅ 总部地址
- ✅ 行业领域
- ✅ 简要描述
- ⚠️ vendors/partnerships (可选,非重点)

Layer 2: 风险分析(核心)
- ✅ military 关联分析
- ✅ defense 关联分析
- ✅ civil-military fusion 关联分析
- ✅ human rights violations 关联分析
- ✅ sanctions 关联分析
- ✅ police technology 关联分析
- ✅ weapons 关联分析
- ✅ terrorist connections 关联分析

增值功能:
- ✅ 自动风险评级 (high/medium/low/none)
- ✅ 风险摘要生成
- ✅ 完整证据链追溯
```

**优势**: 专注垂直领域,自动化专业分析师工作流程

---

### 2. API 请求格式

#### Basic Entity Search
```json
POST /api/entity-search
{
  "company_name": "University of Waterloo",
  "location": "Canada"
}
```

#### Enhanced Entity Search
```json
POST /api/entity-search
{
  "company_name": "University of Waterloo",
  "location": "Canada",
  "include_risk_analysis": true,  // 新参数
  "custom_risk_keywords": [...]    // 可选
}
```

---

### 3. API 响应格式

#### Basic Entity Search 响应
```json
{
  "success": true,
  "data": {
    "company_name": "University of Waterloo",
    "english_name": "University of Waterloo",
    "previous_names": ["Waterloo College Associate Faculties"],
    "description": "...",
    "headquarters": "200 University Avenue West...",
    "sectors": ["Higher Education", "Research"],
    "vendors": [],
    "partnerships": [
      {
        "partner_name": "Avidbots",
        "details": "...",
        "source_url": "..."
      }
    ],
    "sources": [...],
    "key_evidence": [...],
    "search_queries": [...]
  }
}
```

**分析**:
- ✅ 信息全面
- ❌ 缺乏风险评估
- ❌ 需要手动分析每个合作伙伴是否涉及敏感领域

#### Enhanced Entity Search 响应
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
      "severity": "medium",
      "finding_summary": "The University has participated as a subcontractor on various Department of Defense research projects...",
      "potential_intermediary_B": ["Department of Defense (U.S.)"],
      "sources": [...],
      "key_evidence": [...]
    },
    {
      "risk_keyword": "defense",
      "relationship_type": "Direct",
      "severity": "medium",
      "finding_summary": "...",
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

**分析**:
- ✅ 基础信息简化(非重点)
- ✅ **自动风险筛查**(8个敏感关键词)
- ✅ **自动风险评级**(high/medium/low/none)
- ✅ **风险摘要**(一键查看风险概览)
- ✅ **完整证据链**(每个风险都有来源和证据)

---

### 4. 用户体验对比

#### Basic Entity Search 工作流程

```
Analyst 需要手动执行的步骤:

1. 搜索公司基础信息
   POST /api/entity-search { company_name: "Tesla" }

2. 查看 partnerships 列表
   → 发现合作伙伴: "Department of Defense", "Lockheed Martin"

3. 手动判断是否涉及敏感领域
   → DoD = military → 需要深入调查
   → Lockheed Martin = defense contractor → 需要深入调查

4. 手动搜索每个敏感关键词
   → Google: "Tesla military contracts"
   → Google: "Tesla defense projects"
   → Google: "Tesla weapons technology"
   → Google: "Tesla sanctions"
   → ... (重复8次)

5. 手动整理所有搜索结果
   → 复制粘贴到报告
   → 手动评估风险等级

6. 手动撰写风险摘要

总耗时: ~30-60分钟
```

**痛点**:
- ❌ 手动重复搜索8次
- ❌ 需要人工判断哪些合作伙伴敏感
- ❌ 需要人工评估风险等级
- ❌ 需要人工整理和撰写报告

#### Enhanced Entity Search 工作流程

```
Analyst 一键操作:

1. 发送单个 API 请求
   POST /api/entity-search {
     company_name: "Tesla",
     include_risk_analysis: true
   }

2. 等待 ~90秒

3. 获得完整风险报告
   → 8个关键词自动分析完成
   → 每个风险自动评级
   → 风险摘要自动生成
   → 完整证据链自动提取

4. 直接导出或复制使用

总耗时: ~2分钟
```

**优势**:
- ✅ **自动化**: 一键完成8关键词搜索
- ✅ **智能化**: 自动风险评级和摘要
- ✅ **专业化**: 专为 Research Security 设计
- ✅ **高效**: 节省 90%+ 时间

---

### 5. 性能对比

| 指标 | Basic Entity Search | Enhanced Entity Search |
|------|---------------------|------------------------|
| API 调用次数 | 1次 | 9次 (1基础 + 8风险) |
| 响应时间 | ~15-20秒 | ~75-110秒 |
| 来源数量 | ~10-20个 | ~80-120个 |
| 搜索查询数 | ~8-15个 | ~150-200个 |
| 覆盖范围 | 单个公司信息 | 公司 + 8个风险维度 |
| 信息深度 | 中等 | 深度(每个风险维度) |

---

### 6. 成本对比

#### Basic Entity Search
```
Gemini API 成本:
- 1次调用/搜索
- 约 $0.05-0.15/搜索

人工成本:
- Analyst 需要手动搜索8个关键词
- 约 30-60分钟人工时间
- 假设 $50/小时 → $25-50 人工成本

总成本: ~$25-50/搜索
```

#### Enhanced Entity Search
```
Gemini API 成本:
- 9次调用/搜索
- 约 $0.45-1.35/搜索

人工成本:
- 自动化完成,无人工时间
- 约 2分钟审阅结果
- 假设 $50/小时 → ~$1.67 人工成本

总成本: ~$2-3/搜索
```

**ROI 分析**:
- API 成本增加: $0.40-1.20
- 人工成本节省: $23-48
- **净节省: $22-47/搜索** (节省 ~90%)

---

### 7. 竞争差异化

#### Basic Entity Search vs Google AI Search

```
功能重叠度: ~90%

Google AI Search:
- ✅ 公司基础信息
- ✅ 合作伙伴信息
- ✅ 供应商信息
- ✅ 历史信息

Basic Entity Search:
- ✅ 公司基础信息
- ✅ 合作伙伴信息 (带 source_url)
- ✅ 供应商信息 (带 source_url)
- ✅ 历史信息
- ✅ Grounding metadata (稍微更好)

差异化: 很小
```

**结论**: Basic Entity Search 难以与 Google AI Search 竞争

#### Enhanced Entity Search vs Google AI Search

```
功能重叠度: ~20%

Google AI Search:
- ✅ 公司基础信息
- ❌ 自动风险筛查
- ❌ 风险评级
- ❌ 风险摘要
- ❌ Research Security 专业化

Enhanced Entity Search:
- ✅ 公司基础信息 (简化,非重点)
- ✅ 自动8关键词风险筛查
- ✅ 自动风险评级 (high/medium/low)
- ✅ 自动风险摘要
- ✅ Research Security 垂直化
- ✅ 完整证据链追溯
- ✅ 自动化 Analyst 工作流程

差异化: 非常大
```

**结论**: Enhanced Entity Search 拥有明确的差异化价值主张

---

## 建议

### 短期策略
1. **部署 Enhanced Entity Search** 作为主要 entity-search 服务
2. **保留 Basic 模式** 作为可选参数 (`include_risk_analysis=false`)
3. **前端突出展示** 风险分析功能

### 中期优化
1. 添加缓存机制(减少重复搜索)
2. SSE 流式返回(实时显示进度)
3. 自定义关键词列表
4. PDF 报告导出

### 长期愿景
1. 打造 **Research Security Analyst 专业工具套件**
2. 集成 Dataset Matching, Dataset Search
3. 机器学习风险评分模型
4. 批量公司筛查和趋势分析

---

## 结论

### Basic Entity Search
- ✅ 功能完整
- ❌ 缺乏差异化
- ❌ 与 Google AI Search 重叠
- ❌ 难以体现独特价值

### Enhanced Entity Search
- ✅ **明确差异化定位**
- ✅ **Research Security 垂直化**
- ✅ **自动化 Analyst 工作流程**
- ✅ **节省 90%+ 人工时间**
- ✅ **独特价值主张**

**推荐**: 采用 Enhanced Entity Search 作为主要服务,建立垂直领域竞争优势。
