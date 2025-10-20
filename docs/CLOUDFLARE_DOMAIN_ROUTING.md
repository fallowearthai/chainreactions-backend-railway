# CloudFlare域名路由配置方案

## 🎯 **架构目标**

实现**无API Gateway**的微服务架构，让前端直接通过独立域名访问各个微服务：

```
前端请求
    ↓
CloudFlare (DNS + 智能路由)
    ↓
DigitalOcean服务器 (各端口独立服务)
```

## 🌐 **域名规划**

### **主域名架构**
```
chainreactions.com
├── entity-relations.chainreactions.com → Port 3002
├── entity-search.chainreactions.com → Port 3003
├── dataset-matching.chainreactions.com → Port 3004
├── data-management.chainreactions.com → Port 3005
├── dataset-search.chainreactions.com → Port 3006
└── api.chainreactions.com → 服务状态聚合 (可选)
```

### **API服务映射**
| 域名 | 端口 | 服务 | 主要功能 |
|------|------|------|----------|
| entity-relations.chainreactions.com | 3002 | Entity Relations | DeepThinking OSINT + Normal Search |
| entity-search.chainreactions.com | 3003 | Entity Search | Linkup API集成 |
| dataset-matching.chainreactions.com | 3004 | Dataset Matching | 高级实体匹配算法 |
| data-management.chainreactions.com | 3005 | Data Management | CSV上传处理 |
| dataset-search.chainreactions.com | 3006 | Dataset Search | SSE流式搜索 |

## 📋 **CloudFlare配置步骤**

### **Step 1: DNS配置**

#### **A记录设置**
```bash
# 在CloudFlare DNS管理中添加以下A记录

# 主要服务域名
Type: A
Name: entity-relations
IPv4 address: [DigitalOcean服务器IP]
Proxy status: Proxied (橙色云朵)

Type: A
Name: entity-search
IPv4 address: [DigitalOcean服务器IP]
Proxy status: Proxied (橙色云朵)

Type: A
Name: dataset-matching
IPv4 address: [DigitalOcean服务器IP]
Proxy status: Proxied (橙色云朵)

Type: A
Name: data-management
IPv4 address: [DigitalOcean服务器IP]
Proxy status: Proxied (橙色云朵)

Type: A
Name: dataset-search
IPv4 address: [DigitalOcean服务器IP]
Proxy status: Proxied (橙色云朵)

# 可选：服务状态聚合页面
Type: A
Name: api
IPv4 address: [DigitalOcean服务器IP]
Proxy status: Proxied (橙色云朵)
```

### **Step 2: Origin Rules配置**

#### **创建Origin Rules规则集**
```javascript
// CloudFlare Dashboard → Rules → Origin Rules

// 规则集名称: ChainReactions Service Routing

// Rule 1: Entity Relations Service
{
  "name": "Entity Relations Service",
  "description": "Route entity-relations.chainreactions.com to port 3002",
  "expression": "(http.host contains \"entity-relations.chainreactions.com\")",
  "action": {
    "type": "route",
    "parameters": {
      "host_header": "entity-relations.chainreactions.com",
      "port": 3002,
      "origin": {
        "host": "[DigitalOcean服务器IP]",
        "port": 3002
      }
    }
  },
  "enabled": true
}

// Rule 2: Entity Search Service
{
  "name": "Entity Search Service",
  "description": "Route entity-search.chainreactions.com to port 3003",
  "expression": "(http.host contains \"entity-search.chainreactions.com\")",
  "action": {
    "type": "route",
    "parameters": {
      "host_header": "entity-search.chainreactions.com",
      "port": 3003,
      "origin": {
        "host": "[DigitalOcean服务器IP]",
        "port": 3003
      }
    }
  },
  "enabled": true
}

// Rule 3: Dataset Matching Service
{
  "name": "Dataset Matching Service",
  "description": "Route dataset-matching.chainreactions.com to port 3004",
  "expression": "(http.host contains \"dataset-matching.chainreactions.com\")",
  "action": {
    "type": "route",
    "parameters": {
      "host_header": "dataset-matching.chainreactions.com",
      "port": 3004,
      "origin": {
        "host": "[DigitalOcean服务器IP]",
        "port": 3004
      }
    }
  },
  "enabled": true
}

// Rule 4: Data Management Service
{
  "name": "Data Management Service",
  "description": "Route data-management.chainreactions.com to port 3005",
  "expression": "(http.host contains \"data-management.chainreactions.com\")",
  "action": {
    "type": "route",
    "parameters": {
      "host_header": "data-management.chainreactions.com",
      "port": 3005,
      "origin": {
        "host": "[DigitalOcean服务器IP]",
        "port": 3005
      }
    }
  },
  "enabled": true
}

// Rule 5: Dataset Search Service
{
  "name": "Dataset Search Service",
  "description": "Route dataset-search.chainreactions.com to port 3006",
  "expression": "(http.host contains \"dataset-search.chainreactions.com\")",
  "action": {
    "type": "route",
    "parameters": {
      "host_header": "dataset-search.chainreactions.com",
      "port": 3006,
      "origin": {
        "host": "[DigitalOcean服务器IP]",
        "port": 3006
      }
    }
  },
  "enabled": true
}
```

### **Step 3: SSL/TLS配置**

#### **SSL/TLS加密模式**
```bash
# CloudFlare Dashboard → SSL/TLS → Overview
# 选择: Full (端到端加密)

SSL/TLS加密模式: Full
- 加密模式: Full (strict)
- 最小TLS版本: TLS 1.2
- HSTS: 启用
```

#### **边缘证书**
```bash
# CloudFlare会自动提供通配符证书
*.chainreactions.com - 自动更新，免费SSL证书
```

### **Step 4: 缓存配置**

#### **页面规则 (Page Rules)**
```javascript
// 规则1: API端点不缓存
URL Pattern: *chainreactions.com/api/*
Settings:
  - Cache Level: Bypass
  - Browser Cache TTL: 4 hours

// 规则2: 健康检查端点最小缓存
URL Pattern: *chainreactions.com/api/health*
Settings:
  - Cache Level: Bypass
  - Browser Cache TTL: 1 minute

// 规则3: 静态资源标准缓存 (如果有的话)
URL Pattern: *chainreactions.com/static/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 day
  - Browser Cache TTL: 4 hours
```

## 🚀 **部署和验证**

### **Phase 1: 基础DNS配置**
```bash
# 1. 在CloudFlare添加A记录
# 2. 等待DNS传播 (通常5-15分钟)
# 3. 验证域名解析

# 验证命令
dig entity-relations.chainreactions.com
dig entity-search.chainreactions.com
dig dataset-matching.chainreactions.com
dig data-management.chainreactions.com
dig dataset-search.chainreactions.com
```

### **Phase 2: Origin Rules配置**
```bash
# 1. 创建Origin Rules规则集
# 2. 启用所有规则
# 3. 保存并部署

# 验证路由是否生效
curl -I https://entity-relations.chainreactions.com/api/health
curl -I https://entity-search.chainreactions.com/api/health
curl -I https://dataset-matching.chainreactions.com/api/health
curl -I https://data-management.chainreactions.com/api/health
curl -I https://dataset-search.chainreactions.com/api/health
```

### **Phase 3: 全面测试**
```bash
# 测试API端点响应
curl -X POST https://entity-relations.chainreactions.com/api/normal-search \
  -H "Content-Type: application/json" \
  -d '{"Target_institution":"Test","Risk_Entity":"Test","Location":"US"}'

curl -X POST https://entity-search.chainreactions.com/api/entity-search \
  -H "Content-Type: application/json" \
  -d '{"company_name":"Test Company","location":"US"}'
```

## 🔧 **高级配置**

### **负载均衡 (可选)**
```javascript
// 如果未来需要多服务器负载均衡
// CloudFlare Load Balancing配置

const loadBalancer = {
  "name": "ChainReactions Services",
  "default_pools": [
    "entity-relations-pool",
    "entity-search-pool",
    "dataset-matching-pool",
    "data-management-pool",
    "dataset-search-pool"
  ],
  "fallback_pool": "fallback-pool",
  "description": "Load balancing for ChainReactions microservices"
};
```

### **Rate Limiting (可选)**
```javascript
// CloudFlare Rate Limiting配置
// 针对每个子域名的独立限流规则

const rateLimitingRules = [
  {
    "name": "Entity Relations Rate Limit",
    "uri": "*entity-relations.chainreactions.com/*",
    "period": 60,
    "requests_per_period": 100,
    "action": "simulate"
  },
  {
    "name": "Entity Search Rate Limit",
    "uri": "*entity-search.chainreactions.com/*",
    "period": 60,
    "requests_per_period": 200,
    "action": "simulate"
  }
];
```

### **Web Application Firewall (WAF)**
```javascript
// CloudFlare WAF规则
// 保护各服务免受常见攻击

const wafRules = [
  {
    "name": "SQL Injection Protection",
    "expression": "(http.request.uri.path contains \"select\")",
    "action": "block"
  },
  {
    "name": "XSS Protection",
    "expression": "(http.request.uri.path contains \"<script\")",
    "action": "block"
  }
];
```

## 📊 **监控和分析**

### **CloudFlare Analytics**
```bash
# 监控指标
- 流量分析: 各子域名的访问量
- 性能指标: 响应时间、错误率
- 安全分析: 攻击尝试、威胁检测
- 缓存统计: 缓存命中率
```

### **健康检查配置**
```javascript
// CloudFlare Health Checks
// 监控各服务的可用性

const healthChecks = [
  {
    "name": "Entity Relations Health",
    "type": "https",
    "host": "entity-relations.chainreactions.com",
    "path": "/api/health",
    "interval": 60,
    "retries": 3,
    "timeout": 5
  },
  {
    "name": "Entity Search Health",
    "type": "https",
    "host": "entity-search.chainreactions.com",
    "path": "/api/health",
    "interval": 60,
    "retries": 3,
    "timeout": 5
  }
];
```

## 🔒 **安全配置**

### **Security Headers**
```javascript
// CloudFlare Transform Rules
// 添加安全响应头

const securityHeaders = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'"
};
```

### **DDoS Protection**
```bash
# CloudFlare DDoS设置
- HTTP DDoS Protection: 启用
- Under Attack Mode: 根据需要启用
- Rate Limiting: 按需配置
```

## ✅ **验证清单**

### **DNS和路由验证**
- [ ] 所有A记录正确配置
- [ ] DNS解析生效
- [ ] Origin Rules正确路由到对应端口
- [ ] HTTPS证书正常工作

### **服务功能验证**
- [ ] 各服务API端点可通过域名访问
- [ ] 长时运行请求正常 (Entity Relations, Entity Search)
- [ ] SSE流式连接正常
- [ ] CORS配置正确
- [ ] 错误处理正常

### **性能验证**
- [ ] 响应时间在预期范围内
- [ ] 缓存策略生效
- [ ] 负载均衡正常 (如配置)
- [ ] 监控数据正常收集

### **安全验证**
- [ ] HTTPS强制跳转正常
- [ ] Security Headers正确添加
- [ ] WAF规则生效
- [ ] Rate Limiting正常工作

## 🎯 **预期收益**

### **性能提升**
- CDN加速: 全球节点缓存
- 减少延迟: CloudFlare边缘节点就近访问
- 更高可靠性: DDoS保护和故障转移

### **运维简化**
- 统一域名管理
- 自动SSL证书更新
- 集中监控和日志
- 简化DNS管理

### **成本优化**
- CloudFlare免费版足够使用
- 减少API Gateway服务器资源
- CDN流量免费额度充足
- 降低运维复杂度

## 🚨 **注意事项**

1. **域名所有权**: 确保拥有chainreactions.com域名的管理权限
2. **CloudFlare账户**: 需要CloudFlare Pro或更高版本才能使用Origin Rules
3. **SSL证书**: CloudFlare会自动管理通配符证书
4. **缓存策略**: API端点建议不缓存，确保数据实时性
5. **监控**: 设置CloudFlare Analytics监控各服务的访问情况