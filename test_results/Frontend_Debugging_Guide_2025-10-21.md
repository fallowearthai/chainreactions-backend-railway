# 🔍 前端索引显示问题调试指南

## 📋 调试准备状态

**完成时间**: 2025年10月21日 05:45 UTC
**调试目标**: 找出前端显示索引从2开始而非1的根本原因
**状态**: ✅ 调试代码已部署，准备用户测试

## 🛠️ 已部署的调试功能

### 1. API请求监控
在 `useCompanyRelationsSearch.ts` 中添加了详细的请求日志：
```javascript
🔍 [FRONTEND API REQUEST] Request data: {...}
🔍 [FRONTEND API REQUEST] API endpoint: http://localhost:3002/api/normal-search
🔍 [FRONTEND API REQUEST] Target institution: School of Nuclear Science and Energy Power, Shandong University
🔍 [FRONTEND API REQUEST] Risk entity: Military
🔍 [FRONTEND API REQUEST] Location: China
```

### 2. API响应监控
添加了完整的响应数据监控：
```javascript
🔍 [FRONTEND API RESPONSE] Raw response: {...}
🔍 [FRONTEND API RESPONSE] Response keys: ["result", "urls", "raw_data"]
🔍 [FRONTEND API RESPONSE] raw_data: {...}
🔍 [FRONTEND API RESPONSE] key_evidence: [...]
🔍 [FRONTEND API RESPONSE] key_evidence count: 5
🔍 [FRONTEND API RESPONSE] sources: [...]
🔍 [FRONTEND API RESPONSE] sources count: 5
```

### 3. 详细证据监控
每个证据的详细信息：
```javascript
🔍 [FRONTEND API RESPONSE] Evidence 1: {
  text: "The university maintains several defense laboratories...",
  source_indices: [1, 2]
}
```

### 4. 源URL监控
每个源URL的详细信息：
```javascript
🔍 [FRONTEND API RESPONSE] Source 1: {
  title: "palatinate.org.uk",
  url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/..."
}
```

### 5. 组件接收数据监控
在 `EvidenceWithCitations.tsx` 中监控组件接收的数据：
```javascript
🔍 [FRONTEND EVIDENCE] Received evidence: [...]
🔍 [FRONTEND EVIDENCE] Received sourceUrls count: 5
🔍 [FRONTEND EVIDENCE] Evidence 1 received: {
  text: "The university maintains several defense laboratories...",
  source_indices: [1, 2],
  indices_type: "object",
  indices_length: 2
}
```

## 🧪 用户测试步骤

### 第1步：打开浏览器开发者工具
1. 访问 `http://localhost:3001/`
2. 按 `F12` 或 `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac) 打开开发者工具
3. 切换到 `Console` 标签页

### 第2步：执行搜索
1. 在前端界面中输入搜索参数：
   - **Target Institution**: School of Nuclear Science and Energy Power, Shandong University
   - **Risk Entity**: Military
   - **Location**: China
2. 点击搜索按钮

### 第3步：收集调试信息
在Console中查找以下关键日志：

#### 期望的正常结果（如果修复成功）：
```javascript
🔍 [FRONTEND API RESPONSE] key_evidence count: 5
🔍 [FRONTEND API RESPONSE] Evidence 1: { source_indices: [1, 2] }
🔍 [FRONTEND API RESPONSE] Evidence 2: { source_indices: [2] }
🔍 [FRONTEND API RESPONSE] Evidence 3: { source_indices: [3] }
🔍 [FRONTEND API RESPONSE] Evidence 4: { source_indices: [4, 5] }
🔍 [FRONTEND API RESPONSE] Evidence 5: { source_indices: [6, 7] }
```

#### 问题状态（如果仍然存在）：
```javascript
🔍 [FRONTEND API RESPONSE] key_evidence count: 4  // 而不是5
🔍 [FRONTEND API RESPONSE] Evidence 1: { source_indices: [2] }  // 而不是[1, 2]
🔍 [FRONTEND API RESPONSE] Evidence 2: { source_indices: [3] }  // 而不是[2]
// ...等等
```

### 第4步：对比结果
将Console中的调试输出与我们后端直接测试的结果进行对比：

**后端直接测试结果**（已验证正确）：
- Evidence count: 5
- Evidence 1: [1, 2]
- Evidence 2: [2]
- Evidence 3: [3]
- Evidence 4: [4, 5]
- Evidence 5: [6, 7]

**前端显示结果**（用户截图）：
- Evidence count: 4
- Evidence 1: [2]
- Evidence 2: [3]
- Evidence 3: [4, 5]
- Evidence 4: [6, 7]

## 🔍 可能的问题原因

### 1. API响应差异
- 前端可能收到了不同的API响应
- 可能存在缓存问题
- 可能是请求参数略有不同

### 2. 数据处理问题
- 前端可能在处理API响应时有逻辑错误
- `RiskKeywordCard` 或 `EvidenceWithCitations` 组件可能有问题
- 数据转换过程中可能丢失了某些证据

### 3. 索引映射问题
- `sourceUrls` 数组可能有问题
- `source_indices` 到实际源URL的映射可能不正确
- 0-based vs 1-based 索引转换问题

## 📝 调试完成后

完成调试后，我们需要：
1. 移除所有调试日志代码
2. 修复发现的问题
3. 验证修复效果
4. 确保前后端数据一致性

## 🚀 预期结果

修复完成后，前端应该显示：
- 5个证据条目（而不是4个）
- 索引从1开始（而不是从2开始）
- 完整的源引用映射
- 与后端API响应完全一致

---

**调试准备完成时间**: 2025年10月21日 05:45 UTC
**调试状态**: ✅ 准备就绪，等待用户测试
**下一步**: 用户执行搜索并收集Console日志