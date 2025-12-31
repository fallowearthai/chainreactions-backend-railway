#!/bin/bash

# 为所有服务创建符号链接，指向共享模块
# 这样本地开发和Docker构建可以使用相同的导入路径: ./shared/...

SERVICES=(
  "entity-relations"
  "entity-search"
  "dataset-matching"
  "data-management"
  "dataset-search"
  "user-management"
)

echo "=== 创建共享模块符号链接 ==="
echo ""

for service in "${SERVICES[@]}"; do
  SERVICE_PATH="services/$service/src"
  SHARED_LINK="$SERVICE_PATH/shared"
  SHARED_TARGET="../../../src/shared"

  if [ ! -d "$SERVICE_PATH" ]; then
    echo "⚠️  跳过不存在的服务: $service"
    continue
  fi

  # 如果符号链接已存在，先删除
  if [ -L "$SHARED_LINK" ]; then
    echo "🔗 删除现有符号链接: $service/src/shared"
    rm "$SHARED_LINK"
  fi

  # 如果目录已存在（不是符号链接），备份
  if [ -d "$SHARED_LINK" ] && [ ! -L "$SHARED_LINK" ]; then
    echo "⚠️  $service/src/shared 已存在为目录，跳过"
    continue
  fi

  # 创建符号链接
  echo "🔗 创建符号链接: $service/src/shared -> $SHARED_TARGET"
  cd "$SERVICE_PATH"
  ln -s "$SHARED_TARGET" shared
  cd ../../..

  if [ $? -eq 0 ]; then
    echo "  ✅ 成功"
  else
    echo "  ❌ 失败"
  fi
  echo ""
done

echo "=== 完成 ==="
echo ""
echo "现在可以使用统一的导入路径: from './shared/...'"
