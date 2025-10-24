# 独立服务测试脚本 - 去API Gateway化验证

## 🎯 **测试目标**

验证所有微服务在去API Gateway化后的独立运行状态，确保：
1. 各服务健康检查正常
2. 长时运行请求稳定
3. SSE流式连接正常
4. CORS配置正确
5. 错误处理完善

## 📋 **服务列表和端口**

| 服务名称 | 端口 | 主要功能 | 测试优先级 |
|----------|------|----------|------------|
| Entity Relations | 3002 | DeepThinking OSINT + Normal Search | 🔥 高 |
| Entity Search | 3003 | Linkup API集成 | 🔥 高 |
| Dataset Matching | 3004 | 高级实体匹配算法 | 🟡 中 |
| Data Management | 3005 | CSV数据处理 | 🟡 中 |
| Dataset Search | 3006 | SSE流式搜索 | 🔥 高 |

## 🔧 **测试脚本**

### **基础健康检查脚本**
```bash
#!/bin/bash
# health-check.sh - 所有服务健康检查

echo "🔍 ChainReactions 独立服务健康检查"
echo "=================================="

# 服务列表
declare -A services=(
  ["entity-relations"]="3002"
  ["entity-search"]="3003"
  ["dataset-matching"]="3004"
  ["data-management"]="3005"
  ["dataset-search"]="3006"
)

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

healthy_services=0
total_services=${#services[@]}

echo "检查 $total_services 个服务..."
echo ""

for service in "${!services[@]}"; do
  port=${services[$service]}
  url="http://localhost:$port/api/health"

  echo -n "[$service] 检查中... "

  if curl -s -f "$url" > /dev/null; then
    echo -e "${GREEN}✅ 健康${NC}"
    ((healthy_services++))

    # 显示服务信息
    echo "   URL: $url"
    echo "   状态: 正常运行"

    # 获取详细健康信息
    health_info=$(curl -s "$url" 2>/dev/null | jq -r '.status // "unknown"' 2>/dev/null || echo "unknown")
    echo "   详细状态: $health_info"
  else
    echo -e "${RED}❌ 离线${NC}"
    echo "   URL: $url"
    echo "   状态: 无法访问"
  fi
  echo ""
done

echo "=================================="
echo -e "健康服务数: ${GREEN}$healthy_services${NC} / $total_services"
echo -e "整体状态: $([ $healthy_services -eq $total_services ] && echo "${GREEN}✅ 所有服务正常${NC}" || echo "${RED}❌ 存在离线服务${NC}")"
echo ""

if [ $healthy_services -eq $total_services ]; then
  echo -e "${GREEN}🎉 所有服务健康检查通过！${NC}"
  exit 0
else
  echo -e "${RED}⚠️  存在离线服务，请检查服务状态${NC}"
  exit 1
fi
```

### **功能测试脚本**
```bash
#!/bin/bash
# functional-tests.sh - 功能测试脚本

echo "🧪 ChainReactions 独立服务功能测试"
echo "=================================="

# 测试Entity Relations Normal Search
echo "测试 Entity Relations Normal Search..."
curl -X POST http://localhost:3002/api/normal-search \
  -H "Content-Type: application/json" \
  -d '{
    "Target_institution": "Test University",
    "Risk_Entity": "AI Research",
    "Location": "United States"
  }' \
  --max-time 60 \
  --silent --show-error \
  -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n"

echo ""

# 测试Entity Search
echo "测试 Entity Search..."
curl -X POST http://localhost:3003/api/entity-search \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Test Corporation",
    "location": "United States",
    "include_risk_analysis": true
  }' \
  --max-time 180 \
  --silent --show-error \
  -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n"

echo ""

# 测试Dataset Matching
echo "测试 Dataset Matching..."
curl -X POST http://localhost:3004/api/dataset-matching/match \
  -H "Content-Type: application/json" \
  -d '{
    "entity": "Test Entity",
    "location": "US",
    "maxResults": 5
  }' \
  --max-time 30 \
  --silent --show-error \
  -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n"

echo ""

# 测试Data Management
echo "测试 Data Management..."
curl -X GET http://localhost:3005/api/health \
  --max-time 10 \
  --silent --show-error \
  -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n"

echo ""

# 测试Dataset Search
echo "测试 Dataset Search..."
curl -X GET http://localhost:3006/api/health \
  --max-time 10 \
  --silent --show-error \
  -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n"

echo ""
echo "=================================="
echo "✅ 功能测试完成"
```

### **SSE流式测试脚本**
```bash
#!/bin/bash
# sse-test.sh - SSE流式连接测试

echo "🌊 ChainReactions SSE流式连接测试"
echo "=================================="

# 测试Entity Relations SSE
echo "测试 Entity Relations SSE流式搜索..."
echo "URL: http://localhost:3002/api/enhanced/search-stream"

# 使用curl测试SSE
timeout 30s curl -N \
  "http://localhost:3002/api/enhanced/search-stream?Target_institution=Test&Location=US" \
  -H "Accept: text/event-stream" \
  -H "Connection: keep-alive" \
  --no-buffer \
  -s 2>&1 | head -20

echo ""
echo "=================================="
echo "✅ SSE测试完成"
```

### **CORS测试脚本**
```bash
#!/bin/bash
# cors-test.sh - CORS配置测试

echo "🔒 ChainReactions CORS配置测试"
echo "=================================="

# 测试预检请求
echo "测试 OPTIONS 预检请求..."

services=(
  "entity-relations:3002"
  "entity-search:3003"
  "dataset-matching:3004"
  "data-management:3005"
  "dataset-search:3006"
)

for service_info in "${services[@]}"; do
  IFS=':' read -r service port <<< "$service_info"
  echo -n "[$service:$port] OPTIONS测试... "

  status_code=$(curl -X OPTIONS "http://localhost:$port/api/health" \
    -H "Origin: http://localhost:8080" \
    -H "Access-Control-Request-Method: GET" \
    -w "%{http_code}" \
    -s \
    -o /dev/null)

  if [ "$status_code" = "200" ]; then
    echo "✅ 通过"
  else
    echo "❌ 失败 (状态码: $status_code)"
  fi
done

echo ""
echo "=================================="
echo "✅ CORS测试完成"
```

### **性能基准测试脚本**
```bash
#!/bin/bash
# performance-test.sh - 性能基准测试

echo "⚡ ChainReactions 性能基准测试"
echo "=================================="

# Entity Relations Normal Search 性能测试
echo "Entity Relations Normal Search 性能测试..."
echo "URL: http://localhost:3002/api/normal-search"

start_time=$(date +%s.%N)

curl -X POST http://localhost:3002/api/normal-search \
  -H "Content-Type: application/json" \
  -d '{
    "Target_institution": "Test University",
    "Risk_Entity": "AI Research",
    "Location": "United States"
  }' \
  --max-time 60 \
  -s \
  -o /dev/null

end_time=$(date +%s.%N)
duration=$(echo "$end_time - $start_time" | bc)

echo "响应时间: ${duration}s"
echo ""

# Entity Search 性能测试
echo "Entity Search 性能测试..."
echo "URL: http://localhost:3003/api/entity-search"

start_time=$(date +%s.%N)

curl -X POST http://localhost:3003/api/entity-search \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Test Corporation",
    "location": "United States",
    "include_risk_analysis": true
  }' \
  --max-time 180 \
  -s \
  -o /dev/null

end_time=$(date +%s.%N)
duration=$(echo "$end_time -start_time" | bc)

echo "响应时间: ${duration}s"
echo ""

# Dataset Matching 性能测试
echo "Dataset Matching 性能测试..."
echo "URL: http://localhost:3004/api/dataset-matching/match"

start_time=$(date +%s.%N)

curl -X POST http://localhost:3004/api/dataset-matching/match \
  -H "Content-Type: application/json" \
  -d '{
    "entity": "Test Entity",
    "location": "US",
    "maxResults": 5
  }' \
  --max-time 30 \
  -s \
  -o /dev/null

end_time=$(date +%s.%N)
duration=$(echo "$end_time -start_time" | bc)

echo "响应时间: ${duration}s"
echo ""

echo "=================================="
echo "✅ 性能测试完成"
```

### **完整测试脚本**
```bash
#!/bin/bash
# comprehensive-test.sh - 综合测试脚本

echo "🚀 ChainReactions 综合测试套件"
echo "=================================="
echo "测试时间: $(date)"
echo ""

# 1. 健康检查
echo "1️⃣ 健康检查"
echo "--------------------------------"
./health-check.sh
echo ""

# 2. CORS测试
echo "2️⃣ CORS配置测试"
echo "--------------------------------"
./cors-test.sh
echo ""

# 3. 基础功能测试
echo "3️⃣ 基础功能测试"
echo "--------------------------------"
./functional-tests.sh
echo ""

# 4. SSE流式测试
echo "4️⃣ SSE流式测试"
echo "--------------------------------"
./sse-test.sh
echo ""

# 5. 性能测试
echo "5️⃣ 性能基准测试"
echo "--------------------------------"
./performance-test.sh
echo ""

echo "=================================="
echo "🎉 所有测试完成！"
echo "测试时间: $(date)"
echo ""
echo "📋 测试报告总结:"
echo "  - 健康检查: 验证所有服务运行状态"
echo "  - CORS测试: 验证跨域访问配置"
echo "  - 功能测试: 验证核心API功能"
echo "  - SSE测试: 验证流式连接"
echo "  - 性能测试: 验证响应时间基准"
echo ""
echo "✅ ChainReactions 去Gateway化架构验证完成！"
```

## 📊 **测试结果分析**

### **成功标准**
```yaml
健康检查:
  - 所有5个服务返回200状态码
  - 服务信息正确显示
  - 响应时间 < 1秒

CORS测试:
  - 所有OPTIONS请求返回200状态码
  - 支持localhost:8080跨域访问
  - 预检请求处理正确

功能测试:
  - Entity Relations Normal Search: 响应时间 < 60秒
  - Entity Search: 响应时间 < 180秒
  - Dataset Matching: 响应时间 < 30秒
  - Data Management: 响应时间 < 10秒
  - Dataset Search: 响应时间 < 10秒

SSE测试:
  - 流式连接正常建立
  - 数据流持续传输
  - 连接稳定性良好

性能基准:
  - Entity Relations: < 60秒 (正常搜索)
  - Entity Search: < 180秒 (Linkup API)
  - Dataset Matching: < 30秒 (匹配算法)
  - 其他服务: < 10秒 (快速响应)
```

### **故障排除指南**

#### **服务无法启动**
```bash
# 检查端口占用
lsof -i :3002
lsof -i :3003
lsof -i :3004
lsof -i :3005
lsof -i :3006

# 检查服务日志
cd services/entity-relations && npm start
cd services/entity-search && npm start
# ... 其他服务
```

#### **CORS错误**
```bash
# 检查CORS配置
grep -r "cors" services/*/src/app.ts

# 测试CORS响应头
curl -I -H "Origin: http://localhost:8080" \
  http://localhost:3002/api/health
```

#### **长时运行请求超时**
```bash
# 增加curl超时时间
curl --max-time 300 ...

# 检查服务日志
tail -f services/entity-relations/logs/app.log
```

## 🎯 **自动化测试部署**

### **GitHub Actions配置**
```yaml
# .github/workflows/service-tests.yml
name: Service Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test-services:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2

    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'

    - name: Start Services
      run: |
        chmod +x test/*.sh
        # 启动所有服务
        cd services/entity-relations && npm start &
        cd services/entity-search && npm start &
        cd services/dataset-matching && npm start &
        cd services/data-management && npm start &
        cd services/dataset-search && npm start &

        # 等待服务启动
        sleep 30

    - name: Run Tests
      run: |
        ./test/comprehensive-test.sh

    - name: Upload Test Results
      uses: actions/upload-artifact@v2
      with:
        name: test-results
        path: test-results/
```

## ✅ **验证清单**

### **测试环境验证**
- [ ] 所有测试脚本可执行权限设置正确
- [ ] 所有服务在本地正确启动
- [ ] 健康检查脚本返回正确结果
- [ ] 功能测试覆盖所有核心API
- [ ] SSE流式测试连接稳定
- [ ] CORS测试通过所有服务

### **生产环境验证**
- [ ] CloudFlare域名路由配置正确
- [ ] 所有服务通过域名可访问
- [ ] HTTPS证书配置正确
- [ ] 生产环境CORS配置正确
- [ ] 长时运行请求稳定
- [ ] 监控和日志正常收集

### **性能验证**
- [ ] 响应时间在预期范围内
- [ ] 并发请求处理正常
- [ ] 内存使用稳定
- [ ] 错误率在可接受范围内
- [ ] 系统资源使用合理

## 🎉 **预期收益**

### **质量保证**
- 自动化测试覆盖所有关键功能
- 持续集成确保代码质量
- 回归测试防止功能退化
- 性能基准监控服务质量

### **运维效率**
- 快速故障检测和诊断
- 自动化健康检查
- 统一的测试流程
- 详细的测试报告

### **开发体验**
- 本地快速验证
- 清晰的测试结果
- 问题定位准确
- 迭代反馈及时

这套测试脚本将确保ChainReactions去API Gateway化后的系统稳定性和可靠性！