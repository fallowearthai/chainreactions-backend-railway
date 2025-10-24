
  ChainReactions System Monitoring - 完整指南

  🏗️ 系统架构概览

  ChainReactions后端实现了一个企业级的微服务架构监控系统，包含6个独立服务和统一API网关。该监控系统设计用于企业级运营，具备全面的健康检查、性能指标和实时监控功能。

  服务架构图

  前端 (3001) → API网关 (3000) → 实体关系服务 (3002)
                             → 实体搜索服务 (3003)
                             → 数据集匹配服务 (3004)
                             → 数据管理服务 (3005)
                             → 数据集搜索服务 (3006)

  📊 监控系统组件

  1. API网关监控 (端口3000)

  API网关作为中央监控中心，具有全面的健康检查聚合功能：

  核心监控端点：
  - GET /api/health - 所有服务的聚合健康检查
  - GET /api/monitoring/health - 包含响应时间的详细监控
  - GET /api/monitoring/status - 系统状态和性能指标
  - GET /api/monitoring/health/:serviceName - 单个服务健康检查
  - POST /api/monitoring/health/check - 触发健康检查
  - POST /api/monitoring/health/check/:serviceName - 单个服务检查

  2. 个体服务健康检查

  每个微服务实现标准健康检查端点：
  - GET /api/health - 服务特定健康状态
  - GET /api/info - 服务信息和能力

  增强监控的服务：
  - 实体关系服务 (3002): 配置监控和功能标志管理
  - 实体搜索服务 (3003): Linkup API配置验证
  - 数据集匹配服务 (3004): 缓存和性能指标
  - 数据管理服务 (3005): 文件处理和数据库健康
  - 数据集搜索服务 (3006): NRO数据和流状态

  🎯 监控功能详解

  1. 健康检查机制

  - 聚合健康检查: API网关同时监控所有服务
  - 个体服务监控: 每个服务专用端点
  - 超时保护: 所有健康检查5秒超时
  - 优雅降级: 部分服务故障时系统报告"降级"状态
  - 重试逻辑: 瞬时故障的内置重试机制

  2. 性能指标收集

  - 响应时间跟踪: 服务响应时间的实时测量
  - 服务正常运行时间: 系统级正常运行时间跟踪
  - 资源监控: 通过Docker健康检查监控内存和CPU使用
  - 请求/响应日志: 所有API调用的全面日志

  3. 实时监控能力

  - 30秒健康检查间隔: 每30秒自动健康检查
  - 自动服务发现: 动态检测服务可用性
  - 状态分类: 服务分类为"运行中"、"降级"或"停机"
  - 时间戳记录: 所有监控活动包含精确时间戳

  4. Docker健康检查集成

  所有服务实现Docker级健康检查：
  - 间隔: 检查间30-40秒
  - 超时: 每次检查3-10秒
  - 重试: 标记为不健康前3次尝试
  - 启动期: 服务初始化5-40秒

  🛠️ 监控配置

  环境变量

  系统支持广泛的监控配置：
  # 健康检查设置
  ENABLE_HEALTH_CHECK_API_CALLS=false  # 防止API额度消耗
  LOG_LEVEL=INFO                       # 生产就绪日志
  API_TIMEOUT=30000                    # 30秒超时
  MAX_RETRIES=3                        # 重试配置

  # 服务发现
  REDIS_URL=redis://localhost:6379     # 可选服务发现

  # 速率限制
  REQUESTS_PER_MINUTE=60               # API速率限制
  REQUESTS_PER_HOUR=1000               # 每小时限制

  功能标志监控

  实体关系服务包含高级功能监控：
  - 增强基础模式: 配置和状态监控
  - 功能标志管理: 通过API运行时配置更新
  - 紧急禁用: 快速服务禁用能力

  📊 可用监控端点

  系统级监控

  # 聚合健康检查
  curl http://localhost:3000/api/health

  # 详细监控
  curl http://localhost:3000/api/monitoring/health

  # 系统状态
  curl http://localhost:3000/api/monitoring/status

  # 服务信息
  curl http://localhost:3000/api

  个体服务监控

  # 实体关系服务
  curl http://localhost:3000/api/monitoring/health/entity-relations

  # 实体搜索服务
  curl http://localhost:3000/api/monitoring/health/entity_search

  # 数据集匹配服务
  curl http://localhost:3000/api/monitoring/health/dataset_matching

  管理员监控功能

  # 触发手动健康检查
  curl -X POST http://localhost:3000/api/monitoring/health/check

  # 检查特定服务
  curl -X POST http://localhost:3000/api/monitoring/health/check/entity-relations

  # 实体关系管理基础状态
  curl http://localhost:3002/api/admin/grounding/status

  🔍 监控响应格式

  成功响应

  {
    "status": "healthy",
    "service": "api-gateway",
    "version": "1.0.0",
    "port": 3000,
    "timestamp": "2025-10-17T10:00:00.000Z",
    "services": [
      {
        "name": "entity_relations",
        "status": "healthy",
        "url": "http://localhost:3002",
        "response_time": 45,
        "details": {
          "service": "entity-relations",
          "version": "2.0.0",
          "features": ["DeepThinking 3-Stage OSINT", ...]
        }
      }
    ]
  }

  降级响应

  {
    "status": "degraded",
    "service": "api-gateway",
    "timestamp": "2025-10-17T10:00:00.000Z",
    "services": [
      {
        "name": "entity_relations",
        "status": "healthy",
        "url": "http://localhost:3002"
      },
      {
        "name": "entity_search",
        "status": "unhealthy",
        "url": "http://localhost:3003",
        "error": "Connection timeout"
      }
    ]
  }

  🚀 高级监控功能

  1. 服务健康配置

  - 自定义超时: 每服务可配置超时设置
  - 重试策略: 可配置重试次数和延迟
  - CORS配置: 环境感知源管理
  - 优雅降级: 部分服务故障时系统保持运行

  2. 性能优化

  - 并发健康检查: 使用Promise.allSettled并行运行所有检查
  - 超时保护: AbortSignal防止挂起请求
  - 响应时间测量: 所有服务的性能指标
  - 缓存集成: 可选Redis集成用于服务发现

  3. 安全性和可靠性

  - 非root Docker用户: 所有限制权限运行服务
  - 输入验证: 全面的请求验证和清理
  - 错误边界: 优雅的错误处理和回退机制
  - 健康检查隔离: 健康检查不消耗外部API额度

  📊 监控仪表板集成

  系统设计为与监控仪表板集成：
  - Grafana + Prometheus: 准备用于指标收集和可视化
  - 健康检查聚合: 中央化监控数据收集
  - 服务状态API: 监控工具的标准化端点
  - Docker健康检查: 编排平台的容器级监控

  🎯 推荐监控策略

  系统管理员

  1. 主仪表板: 使用/api/monitoring/status进行系统概览
  2. 服务特定: 使用个体服务端点进行详细监控
  3. 自动警报: 在"降级"状态响应上设置警报
  4. 性能调优: 监控响应时间以进行优化

  开发人员

  1. 开发模式: 使用/api/health进行快速健康验证
  2. 测试: 使用POST端点触发手动健康检查
  3. 调试: 使用服务特定端点进行详细诊断
  4. 功能管理: 监控功能标志和配置

  📋 快速参考

  必要命令

  # 系统健康检查
  curl http://localhost:3000/api/health

  # 详细监控
  curl http://localhost:3000/api/monitoring/health

  # 个体服务检查
  curl http://localhost:3000/api/monitoring/health/entity-relations

  # 触发手动健康检查
  curl -X POST http://localhost:3000/api/monitoring/health/check

  预期响应时间

  - API网关: 聚合健康检查 < 100ms
  - 个体服务: 服务特定检查 < 500ms
  - Docker健康检查: 30-40秒间隔
  - 超时保护: 每服务最大5秒

  🎉 监控能力总结

  ChainReactions后端监控系统提供全面的企业级监控解决方案，具有：

  - ✅ 6个微服务 配备个体健康监控
  - ✅ API网关 具备聚合健康检查
  - ✅ 实时性能指标 和响应时间跟踪
  - ✅ Docker健康检查 容器级监控
  - ✅ 高级功能监控 配置管理
  - ✅ 生产就绪安全 非root用户和速率限制
  - ✅ 可扩展架构 支持水平扩展

  该系统设计用于企业运营，具备全面的健康检查、性能监控和实时状态报告功能，适用于大规模SaaS部署。

  通过前端的管理界面，您可以：
  - 实时查看所有6个服务的健康状态
  - 监控系统整体运行状态
  - 查看服务响应时间和性能指标
  - 管理用户活动和API使用情况
  - 设置和维护系统监控警报

  这个监控系统为ChainReactions平台的稳定运行提供了强大的保障！