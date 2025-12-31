# SSE Performance Testing Guide

## 概述

本文档描述了如何测试增强版SSE系统的性能，确保系统能够稳定处理200并发用户。

## 测试前准备

### 1. 启动服务
```bash
# 在 user-management 目录下
npm run dev

# 确保服务运行在 http://localhost:3007
```

### 2. 检查依赖
确保安装了以下工具：
- `node` (v16+)
- `artillery` (可选，用于yml配置测试)

```bash
# 安装 artillery (如果需要)
npm install -g artillery
```

## 快速测试

运行快速验证测试，确保基本功能正常：

```bash
node quick-test.js
```

**预期输出：**
- ✅ Health endpoint OK
- ✅ SSE connection established
- ✅ Connection established message received
- 🎉 All quick tests PASSED!

## 性能测试

### 方法1: 使用Node.js脚本（推荐）
```bash
node test-performance.js
```

**测试过程：**
1. 创建200个并发SSE连接
2. 监控5分钟内存使用
3. 记录响应时间和成功率
4. 生成详细报告

### 方法2: 使用Artillery
```bash
artillery run load-test-200-users.yml
```

## 性能目标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 成功率 | >95% | 200个连接中至少190个成功 |
| 响应时间 | <100ms | 平均连接建立时间 |
| 内存使用 | <50MB | 200个连接的总内存增长 |
| 每连接内存 | <1MB | 平均每个SSE连接的内存开销 |

## 验证修复

### 无限连接问题修复

在浏览器中验证：
1. 打开开发者工具
2. 登录系统
3. 查看控制台日志
4. 确认没有无限重复的连接日志

**应该看到：**
```
🔌 SSE: Token变化，token长度: 745
🔌 SSE: 检测到有效token，开始连接
✅ 认证通知SSE连接已建立
```

**不应该看到：**
```
🔌 SSE: 检测到有效token，开始连接，token长度: 745
🔌 建立认证通知SSE连接...
🔌 SSE: 检测到有效token，开始连接，token长度: 745  [重复]
```

### 连接限制验证

1. 打开多个浏览器标签页（超过3个）
2. 在每个标签页登录
3. 验证第4个标签页的连接被拒绝
4. 检查localStorage中的`sse_connections`记录

## 监控端点

### 系统健康检查
```bash
curl http://localhost:3007/api/health
```

### 连接指标监控
```bash
# 需要有效的认证token
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3007/api/notifications/metrics
```

**响应示例：**
```json
{
  "activeConnections": 5,
  "activeUsers": 2,
  "averageConnectionsPerUser": 2.5,
  "totalConnectionsCreated": 15,
  "connectionErrors": 0,
  "uptime": "2h 15m",
  "memoryUsage": "RSS: 45.2MB, Heap: 23.8MB",
  "limits": {
    "maxConnectionsPerUser": 3,
    "connectionTimeoutMs": 300000,
    "pingIntervalMs": 30000
  }
}
```

## 故障排除

### 常见问题

1. **连接失败 (401错误)**
   - 检查token有效性
   - 确认认证服务正常运行

2. **高内存使用**
   - 检查是否有连接泄漏
   - 验证连接限制是否生效

3. **性能差**
   - 确认数据库连接正常
   - 检查Redis连接（如果使用）

### 日志检查

查看服务日志：
```bash
# 开发环境
npm run dev

# 查看SSE连接日志
grep "SSE连接" logs.txt
```

## 测试报告

运行性能测试后会生成详细报告：
- `performance-test-report-[timestamp].json`

报告包含：
- 详细的性能指标
- 内存使用历史
- 连接成功率统计
- 响应时间分析

## 生产部署前检查清单

- [ ] 快速测试全部通过
- [ ] 性能测试达到目标指标
- [ ] 内存使用稳定在限制范围内
- [ ] 无连接泄漏问题
- [ ] 错误处理机制正常工作
- [ ] 监控端点响应正常
- [ ] 日志记录完善

## 技术支持

如遇到问题，请检查：
1. 服务是否正常启动
2. 端口3007是否被占用
3. 数据库连接是否正常
4. 环境变量是否正确配置

更多信息请参考项目文档或联系开发团队。