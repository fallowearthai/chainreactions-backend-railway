#!/bin/bash
#
# ChainReactions Backend Droplet 更新脚本
# 创建时间：2025-12-31
# 用途：从GitHub拉取最新代码并重新部署Docker容器
#
# 使用方法：
# 1. 将此脚本上传到Droplet: scp DROPLET_UPDATE_SCRIPT.sh root@your-droplet-ip:/home/chainreactions/
# 2. SSH连接到Droplet: ssh root@your-droplet-ip
# 3. 执行脚本: cd /home/chainreactions/app && bash /home/chainreactions/DROPLET_UPDATE_SCRIPT.sh
#

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 打印带颜色的分隔线
print_separator() {
    echo -e "${BLUE}========================================${NC}"
}

# 开始更新流程
print_separator
echo -e "${GREEN}   ChainReactions Backend 更新脚本${NC}"
print_separator
echo "开始时间: $(date)"
print_separator
echo ""

# 检查是否在正确的目录
if [ ! -f "docker-compose.yml" ]; then
    log_error "未找到docker-compose.yml文件"
    log_info "请确保在 /home/chainreactions/app 目录下运行此脚本"
    exit 1
fi

# =================================================================
# 步骤1: 备份配置文件
# =================================================================
print_separator
log_info "步骤1: 备份配置文件..."
print_separator

BACKUP_DIR="/home/chainreactions/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# 备份.env文件
if [ -f ".env" ]; then
    cp .env $BACKUP_DIR/.env.backup
    log_success "✅ .env 文件已备份到: $BACKUP_DIR/.env.backup"
else
    log_warning "⚠️  .env 文件不存在，跳过备份"
fi

# 备份docker-compose.yml
if [ -f "docker-compose.yml" ]; then
    cp docker-compose.yml $BACKUP_DIR/docker-compose.yml.backup
    log_success "✅ docker-compose.yml 已备份到: $BACKUP_DIR/docker-compose.yml.backup"
fi

# 备份当前git commit
CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
echo $CURRENT_COMMIT > $BACKUP_DIR/git-commit.txt
log_success "✅ 当前commit已备份: $CURRENT_COMMIT"

echo ""

# =================================================================
# 步骤2: 拉取最新代码
# =================================================================
print_separator
log_info "步骤2: 从GitHub拉取最新代码..."
print_separator

# 检查远程仓库
if ! git remote get-url railway &>/dev/null; then
    log_error "未找到railway远程仓库"
    log_info "当前的远程仓库:"
    git remote -v
    exit 1
fi

# 拉取最新代码
log_info "正在从railway远程仓库拉取最新代码..."
git fetch railway main

# 保存当前commit（用于回滚）
BEFORE_COMMIT=$(git rev-parse HEAD)

# 重置到最新代码
git reset --hard railway/main

AFTER_COMMIT=$(git rev-parse HEAD)
log_success "✅ 代码更新完成"
log_info "更新前: $BEFORE_COMMIT"
log_info "更新后: $AFTER_COMMIT"
echo ""

# 显示最近3次提交
log_info "最近的提交:"
git log --oneline -3
echo ""

# =================================================================
# 步骤3: 检查并添加缺失的环境变量
# =================================================================
print_separator
log_info "步骤3: 检查环境变量..."
print_separator

# 检查JWT_SECRET
if ! grep -q "^JWT_SECRET=" .env 2>/dev/null; then
    log_warning "⚠️  JWT_SECRET 未设置"

    # 生成JWT_SECRET
    JWT_SECRET=$(openssl rand -base64 32)
    echo "" >> .env
    echo "# User Management Service - 添加于 $(date)" >> .env
    echo "JWT_SECRET=$JWT_SECRET" >> .env
    log_success "✅ JWT_SECRET 已生成并添加到.env"
else
    log_success "✅ JWT_SECRET 已设置"
fi

# 检查REFRESH_TOKEN_SECRET
if ! grep -q "^REFRESH_TOKEN_SECRET=" .env 2>/dev/null; then
    log_warning "⚠️  REFRESH_TOKEN_SECRET 未设置"

    # 生成REFRESH_TOKEN_SECRET
    REFRESH_SECRET=$(openssl rand -base64 32)
    echo "REFRESH_TOKEN_SECRET=$REFRESH_SECRET" >> .env
    log_success "✅ REFRESH_TOKEN_SECRET 已生成并添加到.env"
else
    log_success "✅ REFRESH_TOKEN_SECRET 已设置"
fi

# 检查其他必需的环境变量
REQUIRED_VARS=(
    "GEMINI_API_KEY"
    "BRIGHT_DATA_API_KEY"
    "LINKUP_API_KEY"
    "LINKUP_API_KEY_2"
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
)

log_info "检查其他必需的环境变量..."
MISSING_COUNT=0
for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "^${var}=" .env 2>/dev/null; then
        echo -e "${GREEN}✅${NC} $var"
    else
        echo -e "${RED}❌${NC} $var - 缺失"
        ((MISSING_COUNT++))
    fi
done

if [ $MISSING_COUNT -gt 0 ]; then
    log_warning "⚠️  发现 $MISSING_COUNT 个缺失的环境变量"
    log_warning "这些变量可能需要手动配置"
fi

echo ""

# =================================================================
# 步骤4: 移除docker-compose.yml中的version属性
# =================================================================
print_separator
log_info "步骤4: 更新docker-compose.yml..."
print_separator

if grep -q "^version:" docker-compose.yml; then
    log_warning "⚠️  发现过时的version属性，正在移除..."
    # 备份原文件
    cp docker-compose.yml docker-compose.yml.tmp
    # 删除version行
    sed '/^version:/d' docker-compose.yml.tmp > docker-compose.yml
    rm docker-compose.yml.tmp
    log_success "✅ version属性已移除"
else
    log_success "✅ docker-compose.yml 无需更新"
fi

# 验证docker-compose.yml语法
if docker compose config &>/dev/null; then
    log_success "✅ docker-compose.yml 语法验证通过"
else
    log_error "❌ docker-compose.yml 语法错误"
    exit 1
fi

echo ""

# =================================================================
# 步骤5: 停止所有容器
# =================================================================
print_separator
log_info "步骤5: 停止所有容器..."
print_separator

docker compose down
log_success "✅ 所有容器已停止"
echo ""

# =================================================================
# 步骤6: 重新构建Docker镜像
# =================================================================
print_separator
log_info "步骤6: 重新构建Docker镜像..."
print_separator
log_warning "⚠️  这可能需要5-15分钟，取决于Droplet性能"
echo ""

START_TIME=$(date +%s)

# 重新构建所有镜像（不使用缓存）
docker compose build --no-cache

END_TIME=$(date +%s)
BUILD_TIME=$((END_TIME - START_TIME))
BUILD_MINUTES=$((BUILD_TIME / 60))
BUILD_SECONDS=$((BUILD_TIME % 60))

log_success "✅ 镜像构建完成 (耗时: ${BUILD_MINUTES}分${BUILD_SECONDS}秒)"
echo ""

# 显示新构建的镜像
log_info "新构建的镜像:"
docker images | grep chainreactions
echo ""

# =================================================================
# 步骤7: 启动所有服务
# =================================================================
print_separator
log_info "步骤7: 启动所有服务..."
print_separator

docker compose up -d
log_success "✅ 所有服务已启动"
echo ""

# =================================================================
# 步骤8: 等待服务启动
# =================================================================
print_separator
log_info "步骤8: 等待服务启动..."
print_separator

log_info "等待30秒让服务完全启动..."
for i in {30..1}; do
    echo -ne "倒计时: ${i}秒\r"
    sleep 1
done
echo -ne "\n"
echo ""

# =================================================================
# 步骤9: 检查容器状态
# =================================================================
print_separator
log_info "步骤9: 检查容器健康状态..."
print_separator

docker compose ps
echo ""

# =================================================================
# 步骤10: 测试健康检查端点
# =================================================================
print_separator
log_info "步骤10: 测试健康检查端点..."
print_separator

HEALTHY_COUNT=0
UNHEALTHY_COUNT=0

for port in 3002 3003 3004 3005 3006 3007; do
    response=$(curl -s http://localhost:$port/api/health 2>/dev/null || echo "failed")
    if [[ "$response" == *"operational"* ]]; then
        echo -e "${GREEN}✅ Port $port:${NC} healthy"
        ((HEALTHY_COUNT++))
    else
        echo -e "${RED}❌ Port $port:${NC} unhealthy or failed"
        ((UNHEALTHY_COUNT++))
    fi
done

echo ""

# =================================================================
# 最终报告
# =================================================================
print_separator
echo -e "${GREEN}   更新完成${NC}"
print_separator
echo "完成时间: $(date)"
echo ""

if [ $HEALTHY_COUNT -eq 6 ]; then
    log_success "🎉 所有服务都运行正常！"
    echo ""
    echo "你可以："
    echo "  1. 查看服务日志: docker compose logs -f"
    echo "  2. 查看容器状态: docker compose ps"
    echo "  3. 测试API端点: curl http://localhost:3002/api/health"
    echo ""
elif [ $HEALTHY_COUNT -gt 0 ]; then
    log_warning "⚠️  部分服务运行正常 ($HEALTHY_COUNT/6)"
    log_warning "⚠️  $UNHEALTHY_COUNT 个服务不健康"
    echo ""
    echo "查看不健康服务的日志："
    echo "  docker compose logs <service-name>"
    echo ""
else
    log_error "❌ 所有服务都不健康，请检查日志"
    echo ""
    echo "查看所有服务日志："
    echo "  docker compose logs"
    echo ""
    echo "回滚到之前版本："
    echo "  git reset --hard $BEFORE_COMMIT"
    echo "  docker compose build"
    echo "  docker compose up -d"
    echo ""
fi

print_separator
echo "备份位置: $BACKUP_DIR"
echo "回滚commit: $BEFORE_COMMIT"
print_separator
