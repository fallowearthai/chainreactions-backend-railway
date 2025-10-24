# 单域名微服务架构方案

## 🎯 **架构决策**

**采用单域名路径方案**替代多子域名，更简洁且符合用户期望：

```
chainreactions.site/
├── dashboard                           # 前端主应用
├── api/entity-relations/               # 微服务1 - DeepThinking OSINT
├── api/entity-search/                  # 微服务2 - Linkup API
├── api/dataset-matching/               # 微服务3 - 实体匹配
├── api/data-management/                # 微服务4 - CSV处理
└── api/dataset-search/                 # 微服务5 - SSE流式搜索
```

## 🌐 **CloudFlare配置方案**

### **DNS配置**
```yaml
# 单一A记录配置
Type: A
Name: @ (root domain)
IPv4 address: [DigitalOcean服务器IP]
Proxy status: Proxied (橙色云朵)
```

### **Transform Rules (路径重写)**
```javascript
// CloudFlare Rules → Transform Rules
// 规则集名称: ChainReactions API Routing

{
  "name": "Entity Relations Service",
  "expression": "(http.request.uri.path contains \"/api/entity-relations/\")",
  "action": {
    "type": "rewrite",
    "parameters": {
      "target_path": "/api"
    }
  },
  "override_target": {
    "url": "http://[DigitalOcean_IP]:3002"
  },
  "enabled": true
}

{
  "name": "Entity Search Service",
  "expression": "(http.request.uri.path contains \"/api/entity-search/\")",
  "action": {
    "type": "rewrite",
    "parameters": {
      "target_path": "/api"
    }
  },
  "override_target": {
    "url": "http://[DigitalOcean_IP]:3003"
  },
  "enabled": true
}

{
  "name": "Dataset Matching Service",
  "expression": "(http.request.uri.path contains \"/api/dataset-matching/\")",
  "action": {
    "type": "rewrite",
    "parameters": {
      "target_path": "/api"
    }
  },
  "override_target": {
    "url": "http://[DigitalOcean_IP]:3004"
  },
  "enabled": true
}

{
  "name": "Data Management Service",
  "expression": "(http.request.uri.path contains \"/api/data-management/\")",
  "action": {
    "type": "rewrite",
    "parameters": {
      "target_path": "/api"
    }
  },
  "override_target": {
    "url": "http://[DigitalOcean_IP]:3005"
  },
  "enabled": true
}

{
  "name": "Dataset Search Service",
  "expression": "(http.request.uri.path contains \"/api/dataset-search/\")",
  "action": {
    "type": "rewrite",
    "parameters": {
      "target_path": "/api"
    }
  },
  "override_target": {
    "url": "http://[DigitalOcean_IP]:3006"
  },
  "enabled": true
}
```

## 🔧 **前端配置更新**

### **环境变量配置**
```bash
# .env.production - 简化的单域名配置
VITE_API_BASE_URL=https://chainreactions.site

# 具体API路径
VITE_ENTITY_RELATIONS_API=https://chainreactions.site/api/entity-relations
VITE_ENTITY_SEARCH_API=https://chainreactions.site/api/entity-search
VITE_DATASET_MATCHING_API=https://chainreactions.site/api/dataset-matching
VITE_DATA_MANAGEMENT_API=https://chainreactions.site/api/data-management
VITE_DATASET_SEARCH_API=https://chainreactions.site/api/dataset-search
```

### **TypeScript API客户端**
```typescript
// src/services/apiConfig.ts - 更新为单域名架构
export const API_CONFIG = {
  entityRelations: {
    baseURL: import.meta.env.VITE_ENTITY_RELATIONS_API,
    endpoints: {
      enhancedSearch: '/enhanced/search',
      normalSearch: '/normal-search',
      health: '/health'
    }
  },

  entitySearch: {
    baseURL: import.meta.env.VITE_ENTITY_SEARCH_API,
    endpoints: {
      search: '/entity-search',
      health: '/health'
    }
  },

  // ... 其他服务类似配置
};
```

## 🚀 **部署优势**

### **架构简洁性**
- ✅ 单一域名管理
- ✅ 统一SSL证书
- ✅ 简化CORS配置
- ✅ 用户友好的URL结构

### **运维便利性**
- ✅ 减少DNS配置复杂度
- ✅ 统一监控和日志
- ✅ 更简单的缓存策略
- ✅ 集中的安全配置

### **开发体验**
- ✅ 清晰的API路径结构
- ✅ 简化的前端配置
- ✅ 一致的环境变量管理

## 📊 **API路径映射**

### **当前架构** → **新架构**
```
旧: https://entity-relations.chainreactions.com/api/health
新: https://chainreactions.site/api/entity-relations/health

旧: https://entity-search.chainreactions.com/api/entity-search
新: https://chainreactions.site/api/entity-search/entity-search

旧: https://dataset-matching.chainreactions.com/api/match
新: https://chainreactions.site/api/dataset-matching/match
```

### **具体端点示例**
```yaml
Entity Relations Service:
  - 健康检查: GET /api/entity-relations/health
  - 增强搜索: POST /api/entity-relations/enhanced/search
  - 普通搜索: POST /api/entity-relations/normal-search
  - 流式搜索: GET /api/entity-relations/enhanced/search-stream

Entity Search Service:
  - 健康检查: GET /api/entity-search/health
  - 实体搜索: POST /api/entity-search/entity-search

Dataset Matching Service:
  - 健康检查: GET /api/dataset-matching/health
  - 实体匹配: POST /api/dataset-matching/match

Data Management Service:
  - 健康检查: GET /api/data-management/health
  - 文件上传: POST /api/data-management/upload

Dataset Search Service:
  - 健康检查: GET /api/dataset-search/health
  - 数据集搜索: GET /api/dataset-search/search
```

## 🔍 **验证和测试**

### **本地测试**
```bash
# 测试各服务直接访问
curl http://localhost:3002/api/health  # Entity Relations
curl http://localhost:3003/api/health  # Entity Search
curl http://localhost:3004/api/health  # Dataset Matching
curl http://localhost:3005/api/health  # Data Management
curl http://localhost:3006/api/health  # Dataset Search
```

### **生产环境测试**
```bash
# 测试域名路径路由
curl https://chainreactions.site/api/entity-relations/health
curl https://chainreactions.site/api/entity-search/health
curl https://chainreactions.site/api/dataset-matching/health
curl https://chainreactions.site/api/data-management/health
curl https://chainreactions.site/api/dataset-search/health
```

## ✅ **实施清单**

### **Phase 1: 准备工作**
- [ ] 确认所有微服务健康运行
- [ ] 验证各服务独立CORS配置
- [ ] 更新前端API客户端配置

### **Phase 2: CloudFlare配置**
- [ ] 配置单一DNS A记录
- [ ] 设置Transform Rules路径重写
- [ ] 配置SSL证书 (自动)
- [ ] 设置缓存策略

### **Phase 3: 验证部署**
- [ ] 测试所有API端点可访问性
- [ ] 验证CORS配置正确
- [ ] 测试前端连接
- [ ] 停用并删除API Gateway

## 🎯 **预期收益**

### **用户体验**
- 更直观的URL结构
- 统一的品牌域名
- 更快的加载速度

### **技术优势**
- 简化的基础设施
- 更容易维护
- 更好的可观测性

### **商业价值**
- 专业的品牌形象
- 更低的运维成本
- 更高的开发效率

这种单域名路径架构更符合现代Web应用的最佳实践，同时保持了微服务的独立性和可扩展性。