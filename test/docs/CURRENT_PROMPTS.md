# Enhanced Entity Search - 当前 Prompt 文档

## 概述

增强版 Entity Search 使用两套 prompt:
1. **基础信息 Prompt** - 用于 Layer 1 (基础公司信息)
2. **风险分析 Prompt** - 用于 Layer 2 (8关键词风险分析)

---

## Prompt 1: 基础公司信息 (Layer 1)

### System Prompt

```
You are a business intelligence analyst. Provide concise company information.

Focus on:
- Official registered name and English name
- Headquarters address
- Primary business sectors
- Brief description

Keep it concise. Return JSON format:
{
  "name": "Official name",
  "english_name": "English name",
  "headquarters": "Full address",
  "sectors": ["Sector 1", "Sector 2"],
  "description": "Brief description",
  "past_names": ["Previous name if any"]
}

Do NOT include sources array - handled automatically.
```

### User Prompt

```
Company: ${companyName}
Location: ${location}  // 可选

Provide basic company information in JSON format.
```

### 示例请求

```typescript
companyName: "University of Waterloo"
location: "Canada"
```

### 预期响应

```json
{
  "name": "University of Waterloo",
  "english_name": "University of Waterloo",
  "headquarters": "200 University Avenue West, Waterloo, ON, Canada N2L 3G1",
  "sectors": ["Higher Education", "Research", "Technology"],
  "description": "Public research university...",
  "past_names": ["Waterloo College Associate Faculties"]
}
```

---

## Prompt 2: 风险关键词分析 (Layer 2)

### System Prompt

```markdown
## Role: Research Security Analyst

You are conducting OSINT research to identify potential security risks and connections.

### Goal
Investigate connections between a company/institution and a specific risk keyword (e.g., military, defense, sanctions).

### Analysis Strategy
Search for evidence of:
- **Direct Links**: Clear collaboration, contracts, projects, or documented relationships
- **Indirect Links**: Connections through intermediary organizations
- **Significant Mentions**: Joint discussions in risk-related contexts

### Evidence Requirements
- Use authoritative sources (.gov, .edu, official sites, reputable news)
- Provide specific, verifiable connections
- Cite evidence from search results

### Output Format
Return a single JSON object:
```json
{
  "risk_item": "the risk keyword",
  "institution_A": "company name",
  "relationship_type": "Direct | Indirect | Significant Mention | Unknown | No Evidence Found",
  "finding_summary": "Detailed analysis with specific evidence",
  "potential_intermediary_B": ["Intermediary 1", "Intermediary 2"] or null
}
```

IMPORTANT: Do NOT include sources array - handled automatically via grounding metadata.
```

### User Prompt

```
Investigate potential connections between:

Company: ${companyName}
Location: ${location}
Risk Keyword: ${riskKeyword}

Analyze any direct or indirect connections, or significant mentions linking the company with this risk keyword.

Provide detailed analysis with specific evidence from authoritative sources.
```

### 示例请求 (military 关键词)

```typescript
companyName: "University of Waterloo"
location: "Canada"
riskKeyword: "military"
```

### 预期响应

```json
{
  "risk_item": "military",
  "institution_A": "University of Waterloo",
  "relationship_type": "Indirect",
  "finding_summary": "The University of Waterloo has participated as a subcontractor on various Department of Defense research projects, including work related to software systems development and specialty analytical services for the Navy. This collaboration is documented in government contracts through intermediary organizations.",
  "potential_intermediary_B": ["Department of Defense (U.S.)"]
}
```

---

## 风险评级逻辑 (自动)

系统会根据以下规则自动评估风险等级:

```typescript
function assessSeverity(
  relationshipType: RelationshipType,
  findingSummary: string,
  sourceCount: number
): SeverityLevel {

  // 1. No Evidence Found → none
  if (relationshipType === 'No Evidence Found' || relationshipType === 'Unknown') {
    return 'none';
  }

  // 2. Direct 关系
  if (relationshipType === 'Direct') {

    // 检查高风险指标词
    const highRiskIndicators = [
      'weapon',
      'military contract',
      'defense contract',
      'sanctions violation',
      'human rights abuse',
      'terrorist'
    ];

    const hasHighRiskIndicator = highRiskIndicators.some(indicator =>
      findingSummary.toLowerCase().includes(indicator)
    );

    // 有高风险指标 → high
    // 无高风险指标 → medium
    return hasHighRiskIndicator ? 'high' : 'medium';
  }

  // 3. Indirect 或 Significant Mention
  // 来源数量 >= 3 → medium
  // 来源数量 < 3 → low
  if (sourceCount >= 3) {
    return 'medium';
  }

  return 'low';
}
```

### 风险等级定义

| 等级 | 条件 | 示例 |
|------|------|------|
| **🔴 High** | Direct + 高风险指标词 | "Company signed $10M weapon contract with DoD" |
| **🟡 Medium** | Direct 无高风险指标<br>或 Indirect/Mention + 3+来源 | "Company partnered with defense contractor"<br>"Indirect through X, 5 sources" |
| **🟢 Low** | Indirect/Mention + 少量来源 | "Mentioned in conference alongside military, 2 sources" |
| **⚪ None** | No Evidence Found | 搜索后无任何关联 |

---

## 8个风险关键词

每次完整搜索会对以下8个关键词逐一分析:

```typescript
const RISK_KEYWORDS = [
  'military',                    // 军事关联
  'defense',                     // 国防项目
  'civil-military fusion',       // 军民融合
  'human rights violations',     // 人权侵犯
  'sanctions',                   // 制裁名单
  'police technology',           // 警用技术
  'weapons',                     // 武器技术
  'terrorist connections'        // 恐怖主义关联
];
```

---

## Prompt 设计原则

### ✅ 当前设计优点

1. **简洁明确**
   - 清晰的角色定义 (Research Security Analyst)
   - 明确的输出格式要求 (JSON)
   - 具体的证据要求

2. **复用 entity-relations 逻辑**
   - 与现有 Normal Search 保持一致
   - 相同的关系类型定义
   - 相同的 grounding metadata 提取

3. **灵活性**
   - 支持任意风险关键词
   - 自动处理 grounding sources
   - 后处理自动评级

### ⚠️ 可能的改进点

1. **增加多语言搜索指令**
   ```
   IMPORTANT INSTRUCTION: You MUST search for each item in BOTH English
   AND the native language of ${location}.
   ```
   (参考 entity-relations 的实现)

2. **增加时间范围支持**
   ```
   Focus STRICTLY on information within the specified time range
   ${startDate} to ${endDate}
   ```

3. **增强证据质量要求**
   ```
   For each finding, provide:
   - Specific dates or timeframes
   - Contract values or project details
   - Named individuals or departments involved
   ```

4. **风险等级提示** (可选)
   ```
   Assess the severity of the connection:
   - High: Direct contracts, ongoing relationships
   - Medium: Past collaborations, indirect ties
   - Low: Casual mentions, conference attendance
   ```

---

## 与 entity-relations Normal Search 的对比

### 相同点
- ✅ 使用相同的 OSINT 分析框架
- ✅ 相同的关系类型定义
- ✅ 相同的 JSON 输出格式
- ✅ 相同的 grounding metadata 提取

### 不同点

| 维度 | entity-relations | Enhanced Entity Search |
|------|------------------|------------------------|
| **输入** | 1个自定义 Risk_Entity | 8个固定风险关键词 |
| **执行** | 单次调用 | 并行8次调用 |
| **输出** | 单个分析结果 | 8个分析 + 风险摘要 |
| **评级** | 无自动评级 | 自动 severity 评级 |
| **目标** | 深度单一调查 | 批量风险筛查 |

---

## 测试与验证

### 验证 Prompt 质量的方法

1. **运行测试**
   ```bash
   npm run test:enhanced
   ```

2. **检查关键指标**
   ```json
   {
     "metadata": {
       "total_sources": 87,           // 目标: >50
       "search_queries_executed": 156, // 多样化查询
       "api_calls_made": 9             // 1基础 + 8风险
     }
   }
   ```

3. **评估结果质量**
   - 关系类型准确性
   - finding_summary 详细程度
   - sources 来源权威性
   - 风险评级合理性

### 常见问题与调优

#### 问题 1: finding_summary 过于简短

**当前**:
```
"finding_summary": "Company has defense projects."
```

**改进 prompt**:
```
Provide detailed analysis including:
- Specific project names or contract numbers
- Timeframes and current status
- Financial details if available
- Key personnel or departments involved
```

#### 问题 2: 误报 (False Positives)

**当前**: 过于宽松的匹配

**改进风险评级逻辑**:
```typescript
// 增加更多高风险指标词
const highRiskIndicators = [
  'weapon',
  'military contract',
  'defense contract',
  'sanctions violation',
  'human rights abuse',
  'terrorist',
  'arms deal',           // 新增
  'export control',      // 新增
  'dual-use technology'  // 新增
];
```

#### 问题 3: 漏报 (False Negatives)

**当前**: 搜索范围可能不够广

**改进 user prompt**:
```
Search comprehensively for:
1. Direct contracts or agreements
2. Joint research projects
3. Technology transfers
4. Personnel exchanges
5. Funding relationships
6. Subsidiary connections
```

---

## 下一步优化建议

### 短期 (立即可做)
- [ ] 添加多语言搜索指令
- [ ] 增强 finding_summary 详细度要求
- [ ] 扩展高风险指标词列表

### 中期 (需要测试验证)
- [ ] 添加时间范围支持
- [ ] 实验不同的 temperature 设置
- [ ] 调整 maxOutputTokens 以获得更详细分析

### 长期 (需要架构调整)
- [ ] 实现两阶段 prompt (粗筛 + 精查)
- [ ] 添加 confidence score 评估
- [ ] 集成外部风险数据库交叉验证

---

**当前 prompt 版本**: v1.0 (2025-10-17)
**基于**: entity-relations NormalSearch prompt
**优化状态**: 待测试验证
