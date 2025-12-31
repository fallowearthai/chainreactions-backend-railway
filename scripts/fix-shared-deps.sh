#!/bin/bash

# 为所有服务添加共享模块所需的依赖
# 共享模块 (src/shared/) 使用了这些依赖，但各个服务的 package.json 中可能缺失

set -e

SERVICES=(
  "entity-relations"
  "entity-search"
  "dataset-matching"
  "data-management"
  "dataset-search"
  "user-management"
)

# 共享依赖及其版本
SHARED_DEPS=(
  "ioredis@^5.3.2"
  "pg@^8.11.3"
  "axios@^1.6.2"
)

# 共享依赖的类型定义
SHARED_DEV_DEPS=(
  "@types/ioredis@^5.0.0"
  "@types/pg@^8.10.9"
)

echo "=== 为所有服务添加共享依赖 ==="
echo ""

for service in "${SERVICES[@]}"; do
  SERVICE_PATH="services/$service"

  if [ ! -d "$SERVICE_PATH" ]; then
    echo "⚠️  跳过不存在的服务: $service"
    continue
  fi

  echo "📦 处理服务: $service"

  cd "$SERVICE_PATH"

  # 添加生产依赖
  for dep in "${SHARED_DEPS[@]}"; do
    echo "  ➕ 添加依赖: $dep"
    npm install --save $dep 2>/dev/null || echo "    ⚠️  依赖可能已存在或安装失败"
  done

  # 添加开发依赖
  for dep in "${SHARED_DEV_DEPS[@]}"; do
    echo "  ➕ 添加开发依赖: $dep"
    npm install --save-dev $dep 2>/dev/null || echo "    ⚠️  依赖可能已存在或安装失败"
  done

  cd ../../

  echo "  ✅ $service 依赖更新完成"
  echo ""
done

echo "=== 所有服务的共享依赖已添加 ==="
echo ""
echo "请运行以下命令验证构建："
echo "  for service in entity-relations entity-search dataset-matching data-management dataset-search user-management; do"
echo "    cd services/\$service && npm run build && cd ../.."
echo "  done"
