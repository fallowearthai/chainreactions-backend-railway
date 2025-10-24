# Enhanced Entity Search - 快速开始指南

## 🚀 5分钟快速测试

### 1. 运行增强版测试

```bash
cd /Users/kanbei/Code/chainreactions_backend/test
npm run test:enhanced
```

### 2. 查看结果

```bash
# 查看完整 JSON 结果
cat enhanced_search_result.json

# 使用 jq 美化输出
cat enhanced_search_result.json | jq

# 查看风险摘要
cat enhanced_search_result.json | jq '.risk_summary'

# 查看高风险关键词
cat enhanced_search_result.json | jq '.risk_analysis[] | select(.severity == "high")'
```

---

## 📋 测试不同场景

### 场景 1: 高风险公司测试

编辑 `test-enhanced-search.ts`:

```typescript
const testRequest = {
  company_name: 'Lockheed Martin',  // 国防承包商
  location: 'United States',
  include_risk_analysis: true
};
```

预期结果:
- ✅ military: Direct, High Severity
- ✅ defense: Direct, High Severity
- ✅ weapons: Direct, High Severity

### 场景 2: 低风险公司测试

```typescript
const testRequest = {
  company_name: 'Starbucks',  // 咖啡连锁
  location: 'United States',
  include_risk_analysis: true
};
```

预期结果:
- ✅ 大部分关键词: No Evidence Found
- ✅ overall_risk_level: none or low

### 场景 3: 仅基础信息(跳过风险分析)

```typescript
const testRequest = {
  company_name: 'Tesla Inc',
  location: 'United States',
  include_risk_analysis: false  // 关闭风险分析
};
```

预期结果:
- ✅ 只返回 basic_info
- ✅ 响应时间 ~15-20秒
- ✅ API 调用 1次

### 场景 4: 自定义风险关键词

```typescript
const testRequest = {
  company_name: 'Huawei',
  location: 'China',
  include_risk_analysis: true,
  custom_risk_keywords: [
    '5G',
    'surveillance',
    'espionage',
    'banned technology'
  ]
};
```

---

## 📊 结果解读

### 风险等级说明

| 等级 | 说明 | 建议 |
|------|------|------|
| **🔴 High** | Direct 关系 + 高风险指标<br>(weapon, military contract, etc.) | 立即深入调查 |
| **🟡 Medium** | Direct 关系 或<br>Indirect 关系 + 3+来源 | 需要进一步审查 |
| **🟢 Low** | Indirect/Significant Mention<br>来源较少 | 记录备案 |
| **⚪ None** | No Evidence Found | 清白 |

### 关系类型说明

| 类型 | 说明 | 示例 |
|------|------|------|
| **Direct** | 明确的直接关系 | "Company signed $10M contract with DoD" |
| **Indirect** | 通过中介机构的间接关系 | "Company partnered with X, which supplies Y to military" |
| **Significant Mention** | 在风险相关语境中共同提及 | "Company and military both participated in tech conference" |
| **No Evidence Found** | 未找到任何关联证据 | 搜索后无相关结果 |

---

## 🔧 代码集成示例

### TypeScript 集成

```typescript
import { EnhancedEntitySearchService } from './EnhancedEntitySearchService';

const service = new EnhancedEntitySearchService();

// 完整风险分析
async function fullRiskAnalysis(companyName: string) {
  const result = await service.searchEntity({
    company_name: companyName,
    location: 'United States',
    include_risk_analysis: true
  });

  if (result.success && result.risk_summary) {
    console.log(`Overall Risk: ${result.risk_summary.overall_risk_level}`);
    console.log(`Flagged Keywords: ${result.risk_summary.flagged_keywords.join(', ')}`);

    // 高风险警报
    if (result.risk_summary.high_severity_count > 0) {
      console.log('⚠️ HIGH RISK COMPANY DETECTED!');
      const highRisks = result.risk_analysis?.filter(r => r.severity === 'high');
      highRisks?.forEach(risk => {
        console.log(`   - ${risk.risk_keyword}: ${risk.finding_summary}`);
      });
    }
  }
}

// 仅基础信息
async function quickLookup(companyName: string) {
  const result = await service.searchEntity({
    company_name: companyName,
    include_risk_analysis: false
  });

  if (result.success && result.basic_info) {
    console.log(`Company: ${result.basic_info.name}`);
    console.log(`HQ: ${result.basic_info.headquarters}`);
    console.log(`Sectors: ${result.basic_info.sectors?.join(', ')}`);
  }
}

// 自定义关键词
async function customAnalysis(companyName: string, keywords: string[]) {
  const result = await service.searchEntity({
    company_name: companyName,
    location: 'Worldwide',
    include_risk_analysis: true,
    custom_risk_keywords: keywords
  });

  return result;
}
```

### Express API 集成

```typescript
import express from 'express';
import { EnhancedEntitySearchService } from './services/EnhancedEntitySearchService';

const app = express();
const searchService = new EnhancedEntitySearchService();

app.post('/api/entity-search', async (req, res) => {
  const { company_name, location, include_risk_analysis, custom_risk_keywords } = req.body;

  if (!company_name) {
    return res.status(400).json({ error: 'company_name is required' });
  }

  try {
    const result = await searchService.searchEntity({
      company_name,
      location,
      include_risk_analysis,
      custom_risk_keywords
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 📈 性能监控

### 关键指标

运行测试后,关注以下指标:

```json
{
  "metadata": {
    "search_duration_ms": 75000,        // 目标: <120000 (2分钟)
    "total_sources": 87,                 // 越多越好 (建议 >50)
    "search_queries_executed": 156,      // 自动执行的搜索数
    "api_calls_made": 9                  // 1 + 8关键词
  }
}
```

### 性能优化建议

如果 `search_duration_ms > 120000`:
1. 检查网络连接
2. 检查 Gemini API 配额
3. 考虑减少关键词数量
4. 实施缓存机制

如果 `total_sources < 30`:
1. 检查关键词相关性
2. 调整 system prompt
3. 扩大搜索范围

---

## 🐛 故障排查

### 常见问题

#### 1. API Key 未配置

**错误**: `Service not configured! Please set GEMINI_API_KEY.`

**解决**:
```bash
# 方法 1: 环境变量
export GEMINI_API_KEY=your_api_key_here

# 方法 2: 修改测试文件
# 在 test-enhanced-search.ts 中设置:
process.env.GEMINI_API_KEY = 'your_api_key_here';
```

#### 2. 响应超时

**错误**: `Error: timeout of 120000ms exceeded`

**解决**:
- 增加超时时间(在 `callGeminiAPI` 方法中)
- 检查网络连接
- 减少关键词数量

#### 3. JSON 解析失败

**错误**: `Failed to parse JSON response`

**解决**:
- 检查 Gemini API 返回内容
- 查看 `enhanced_search_error.json` 详细错误
- 调整 system prompt 强调 JSON 格式

#### 4. 风险评级不准确

**问题**: 明显高风险公司评级为 low

**解决**:
- 调整 `assessSeverity` 逻辑
- 增加更多高风险指标词
- 检查 finding_summary 内容质量

---

## 📚 进一步学习

### 文档资源

1. **ENHANCED_SEARCH_README.md** - 完整功能文档
2. **COMPARISON.md** - 与基础版对比分析
3. **EnhancedEntitySearchService.ts** - 源代码实现

### 测试其他公司

```bash
# 军工企业
Lockheed Martin, Boeing, Raytheon, Northrop Grumman

# 科技公司
Google, Microsoft, Amazon, Meta, Apple

# 中国企业
Huawei, Hikvision, DJI, ByteDance

# 研究机构
MIT, Stanford, University of Waterloo, Tsinghua University
```

---

## 🎯 下一步

### 立即行动
- [ ] 运行测试: `npm run test:enhanced`
- [ ] 查看结果: `cat enhanced_search_result.json | jq`
- [ ] 测试不同公司
- [ ] 调整风险关键词

### 集成部署
- [ ] 复制到 `services/entity-search/`
- [ ] 更新 Controller
- [ ] 添加到 API Gateway
- [ ] 更新前端

### 优化增强
- [ ] 实施缓存机制
- [ ] 添加 SSE 流式返回
- [ ] 自定义关键词 UI
- [ ] PDF 报告导出

---

**准备好开始了吗?** 运行 `npm run test:enhanced` 看看效果! 🚀
