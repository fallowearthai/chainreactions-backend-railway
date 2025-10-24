#!/bin/bash

# =================================================================
# ChainReactions Backend - 开发到生产环境同步脚本
# =================================================================
# Purpose: 将开发环境的代码安全同步到生产环境
# Strategy: 验证 -> 备份 -> 同步 -> 测试
# Updated: October 2025
# =================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DEV_ENV_PATH="/Users/kanbei/Code/chainreactions_backend"
PROD_ENV_PATH="/Users/kanbei/Code/chainreactions_backend_railway"

# Functions
print_step() {
    echo -e "\n${BLUE}===================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# =================================================================
# PREAMBLE: VALIDATION AND CONFIRMATION
# =================================================================
print_step "ChainReactions Backend - 开发到生产环境同步"

echo -e "${CYAN}此脚本将执行以下操作：${NC}"
echo -e "  1. 验证开发环境和生产环境的状态"
echo -e "  2. 分析将要同步的代码变更"
echo -e "  3. 创建生产环境的自动备份"
echo -e "  4. 同步核心业务代码（保留生产部署配置）"
echo -e "  5. 运行同步后验证测试"
echo -e ""

# Confirm paths exist
if [ ! -d "$DEV_ENV_PATH" ]; then
    print_error "开发环境路径不存在: $DEV_ENV_PATH"
    exit 1
fi

if [ ! -d "$PROD_ENV_PATH" ]; then
    print_error "生产环境路径不存在: $PROD_ENV_PATH"
    exit 1
fi

print_success "环境路径验证通过"
print_info "开发环境: $DEV_ENV_PATH"
print_info "生产环境: $PROD_ENV_PATH"

# Final confirmation
echo -e "\n${YELLOW}⚠️  重要提醒：${NC}"
echo -e "  • 此操作将同步业务代码到生产环境"
echo -e "  • 生产环境的部署配置将被保留"
echo -e "  • 建议先提交开发环境的Git变更"
echo -e ""

read -p "确认继续同步？(y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "同步操作已取消"
    exit 0
fi

# =================================================================
# STAGE 1: ENVIRONMENT VALIDATION
# =================================================================
print_step "STAGE 1: 环境验证"

cd "$DEV_ENV_PATH"
print_info "当前工作目录: $(pwd)"

# Check Git status in development
if [ -d ".git" ]; then
    GIT_STATUS=$(git status --porcelain)
    if [ -n "$GIT_STATUS" ]; then
        print_warning "开发环境有未提交的Git变更："
        echo "$GIT_STATUS"
        read -p "是否继续同步？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "请先提交Git变更后再进行同步"
            exit 1
        fi
    else
        print_success "开发环境Git状态正常"
    fi
else
    print_warning "开发环境不是Git仓库"
fi

# Check if production environment is a Git repository
cd "$PROD_ENV_PATH"
if [ -d ".git" ]; then
    print_success "生产环境是Git仓库"

    # Check for uncommitted changes in production
    PROD_GIT_STATUS=$(git status --porcelain)
    if [ -n "$PROD_GIT_STATUS" ]; then
        print_warning "生产环境有未提交的变更："
        echo "$PROD_GIT_STATUS"
        print_info "这些变更可能会被覆盖"
        read -p "是否继续？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "请先处理生产环境的Git变更"
            exit 1
        fi
    fi
else
    print_warning "生产环境不是Git仓库"
fi

# =================================================================
# STAGE 2: SYNCHRONIZATION ANALYSIS
# =================================================================
print_step "STAGE 2: 同步分析"

cd "$DEV_ENV_PATH"

print_info "分析将要同步的文件..."

# Define what to sync (business code only)
SYNC_PATTERNS=(
    "services/*/src/"
    "services/*/package.json"
    "services/*/tsconfig.json"
    "services/*/.dockerignore"
    "CLAUDE.md"
    "package.json"
    "tsconfig.json"
    ".env.docker.example"
    "redis.conf"
    "docs/"
)

# Define what to exclude (production-specific)
EXCLUDE_PATTERNS=(
    "deploy.sh"
    "test_deployment.sh"
    "docs/*DEPLOYMENT*"
    "*.md"
    "!CLAUDE.md"
    "!docs/COMMERCIAL_OPTIMIZATION_PLAN.md"
    "test/"
    "*.log"
    "node_modules/"
    "dist/"
    ".env"
)

# Count files to sync
TOTAL_FILES=0
for pattern in "${SYNC_PATTERNS[@]}"; do
    if [ -d "$pattern" ]; then
        FILE_COUNT=$(find "$pattern" -type f | wc -l | tr -d ' ')
        TOTAL_FILES=$((TOTAL_FILES + FILE_COUNT))
    elif [ -f "$pattern" ]; then
        TOTAL_FILES=$((TOTAL_FILES + 1))
    fi
done

print_info "预计同步文件数量: $TOTAL_FILES"

# Show key directories that will be synced
print_info "将要同步的主要目录："
for service_dir in services/*/; do
    if [ -d "$service_dir" ]; then
        service_name=$(basename "$service_dir")
        src_size=$(du -sh "$service_dir/src" 2>/dev/null | cut -f1 || echo "unknown")
        print_info "  • $service_name/src ($src_size)"
    fi
done

# =================================================================
# STAGE 3: PRODUCTION BACKUP
# =================================================================
print_step "STAGE 3: 生产环境备份"

cd "$PROD_ENV_PATH"

# Create backup directory with timestamp
BACKUP_DIR="./backups/sync_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

print_info "创建备份目录: $BACKUP_DIR"

# Backup critical files
backup_files=(
    ".env"
    "deploy.sh"
    "test_deployment.sh"
    "docker-compose.yml"
    "railway.toml"
    "docs/"
)

for file in "${backup_files[@]}"; do
    if [ -e "$file" ]; then
        cp -r "$file" "$BACKUP_DIR/" 2>/dev/null || true
        print_success "已备份: $file"
    fi
done

# Backup current Git state if it's a Git repository
if [ -d ".git" ]; then
    git log --oneline -10 > "$BACKUP_DIR/git_commit_history.txt"
    git status > "$BACKUP_DIR/git_status.txt"
    print_success "已备份Git状态信息"
fi

print_success "生产环境备份完成"

# =================================================================
# STAGE 4: CORE BUSINESS CODE SYNCHRONIZATION
# =================================================================
print_step "STAGE 4: 核心业务代码同步"

cd "$DEV_ENV_PATH"
SYNC_SUCCESS=0
SYNC_FAILED=0

print_info "开始同步业务代码..."

# Function to sync a file or directory
sync_item() {
    local source="$1"
    local target="$PROD_ENV_PATH/$2"

    if [ -e "$source" ]; then
        # Create target directory if it doesn't exist
        local target_dir=$(dirname "$target")
        mkdir -p "$target_dir"

        # Use rsync for efficient copying
        if rsync -av --delete "$source" "$target"; then
            print_success "同步成功: $source"
            ((SYNC_SUCCESS++))
        else
            print_error "同步失败: $source"
            ((SYNC_FAILED++))
        fi
    else
        print_warning "源文件不存在: $source"
    fi
}

# Sync service source code
for service_dir in services/*/; do
    if [ -d "$service_dir" ]; then
        service_name=$(basename "$service_dir")

        # Sync source code
        if [ -d "$service_dir/src" ]; then
            sync_item "$service_dir/src" "services/$service_name/src"
        fi

        # Sync configuration files
        if [ -f "$service_dir/package.json" ]; then
            sync_item "$service_dir/package.json" "services/$service_name/package.json"
        fi

        if [ -f "$service_dir/tsconfig.json" ]; then
            sync_item "$service_dir/tsconfig.json" "services/$service_name/tsconfig.json"
        fi

        if [ -f "$service_dir/.dockerignore" ]; then
            sync_item "$service_dir/.dockerignore" "services/$service_name/.dockerignore"
        fi
    fi
done

# Sync root level files
root_files=(
    "CLAUDE.md"
    "package.json"
    "tsconfig.json"
    ".env.docker.example"
    "redis.conf"
)

for file in "${root_files[@]}"; do
    if [ -f "$file" ]; then
        sync_item "$file" "$file"
    fi
done

# Sync documentation (excluding deployment docs)
if [ -d "docs" ]; then
    mkdir -p "$PROD_ENV_PATH/docs"
    # Copy only non-deployment docs
    find docs -name "*.md" ! -name "*DEPLOYMENT*" -exec cp {} "$PROD_ENV_PATH/docs/" \;
    print_success "同步文档目录（排除部署文档）"
fi

print_info "同步统计: 成功 $SYNC_SUCCESS，失败 $SYNC_FAILED"

if [ $SYNC_FAILED -gt 0 ]; then
    print_error "部分文件同步失败，请检查错误信息"
    read -p "是否继续？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "同步操作已取消"
        exit 1
    fi
fi

# =================================================================
# STAGE 5: POST-SYNC VALIDATION
# =================================================================
print_step "STAGE 5: 同步后验证"

cd "$PROD_ENV_PATH"

print_info "验证同步结果..."

# Check if critical files exist
validation_files=(
    "services/entity-relations/src/app.ts"
    "services/entity-search/src/app.ts"
    "services/dataset-matching/src/app.ts"
    "services/data-management/src/app.ts"
    "services/dataset-search/src/app.ts"
    "CLAUDE.md"
    ".env.docker.example"
)

validation_passed=0
validation_total=${#validation_files[@]}

for file in "${validation_files[@]}"; do
    if [ -f "$file" ]; then
        print_success "验证通过: $file"
        ((validation_passed++))
    else
        print_error "验证失败: $file"
    fi
done

if [ $validation_passed -eq $validation_total ]; then
    print_success "所有关键文件验证通过"
else
    print_error "$validation_passed/$validation_total 文件验证通过"
    print_warning "同步可能不完整"
fi

# Check Node.js version consistency
print_info "检查Node.js版本一致性..."
nodejs_versions_inconsistent=0

for service_dir in services/*/; do
    if [ -f "$service_dir/Dockerfile" ]; then
        node_version=$(grep "^FROM node:" "$service_dir/Dockerfile" | head -1)
        if [[ "$node_version" == *"node:20"* ]]; then
            print_success "$(basename "$service_dir"): Node.js 20 LTS ✓"
        else
            print_error "$(basename "$service_dir"): $node_version ✗"
            ((nodejs_versions_inconsistent++))
        fi
    fi
done

if [ $nodejs_versions_inconsistent -eq 0 ]; then
    print_success "所有服务使用统一的Node.js版本"
else
    print_warning "$nodejs_versions_inconsistent 个服务Node.js版本不一致"
fi

# =================================================================
# STAGE 6: CLEANUP AND FINALIZATION
# =================================================================
print_step "STAGE 6: 清理和完成"

print_info "同步操作完成！"

echo -e "\n${CYAN}同步摘要：${NC}"
echo -e "  • 源环境: $DEV_ENV_PATH"
echo -e "  • 目标环境: $PROD_ENV_PATH"
echo -e "  • 备份位置: $BACKUP_DIR"
echo -e "  • 同步文件: 成功 $SYNC_SUCCESS，失败 $SYNC_FAILED"
echo -e "  • 验证结果: $validation_passed/$validation_total 通过"

echo -e "\n${YELLOW}下一步操作建议：${NC}"
echo -e "  1. 进入生产环境: cd $PROD_ENV_PATH"
echo -e "  2. 检查Git状态: git status"
echo -e "  3. 提交同步的代码: git add . && git commit -m 'Sync from development'"
echo -e "  4. 运行部署测试: ./test_deployment.sh"
echo -e "  5. 如果测试通过，执行部署: ./deploy.sh"

echo -e "\n${GREEN}重要提醒：${NC}"
echo -e "  • 生产部署配置已保留"
echo -e "  • 备份文件位于: $BACKUP_DIR"
echo -e "  • 如需回滚，可从备份目录恢复"

if [ $SYNC_FAILED -gt 0 ] || [ $validation_passed -lt $validation_total ]; then
    echo -e "\n${RED}⚠️  同步过程中发现问题，请检查上述错误信息${NC}"
    exit 1
else
    print_success "🎉 代码同步完成，可以进行生产部署！"
fi