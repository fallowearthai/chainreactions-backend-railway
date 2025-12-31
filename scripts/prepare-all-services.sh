#!/bin/bash

# 完整的服务构建准备脚本
# 1. 为所有服务添加共享依赖
# 2. 创建符号链接
# 3. 修复导入路径
# 4. 安装依赖

set -e

cd "$(dirname "$0")/.."

echo "=== 第1步：为所有服务添加共享依赖 ==="
node scripts/update-shared-deps.js

echo ""
echo "=== 第2步：创建符号链接 ==="
bash scripts/setup-symlinks.sh

echo ""
echo "=== 第3步：修复导入路径 ==="
node scripts/fix-import-paths-correct.js

echo ""
echo "=== 第4步：安装所有服务的依赖 ==="
SERVICES=(
  "entity-relations"
  "entity-search"
  "dataset-matching"
  "data-management"
  "dataset-search"
  "user-management"
)

for service in "${SERVICES[@]}"; do
  echo "📦 安装 $service 依赖..."
  cd "services/$service" && npm install --silent && cd ../..
done

echo ""
echo "=== 第5步：构建所有服务 ==="

BUILD_SUCCESS=0
BUILD_FAILED=0

for service in "${SERVICES[@]}"; do
  echo "🔨 构建 $service..."
  cd "services/$service"
  if npm run build > /tmp/build-$service.log 2>&1; then
    echo "  ✅ 成功"
    BUILD_SUCCESS=$((BUILD_SUCCESS + 1))
  else
    echo "  ❌ 失败 - 查看 /tmp/build-$service.log"
    BUILD_FAILED=$((BUILD_FAILED + 1))
  fi
  cd ../..
done

echo ""
echo "=== 构建结果 ==="
echo "成功: $BUILD_SUCCESS"
echo "失败: $BUILD_FAILED"

if [ $BUILD_FAILED -eq 0 ]; then
  echo ""
  echo "🎉 所有服务构建成功！"
  echo "现在可以运行 docker compose build"
  exit 0
else
  echo ""
  echo "⚠️  部分服务构建失败，请检查日志"
  exit 1
fi
