#!/bin/bash

# =================================================================
# ChainReactions Backend - 环境差异检查工具
# =================================================================
# Purpose: 比较开发和生产环境的配置差异
# Usage: ./environment-diff.sh [选项]
# Updated: October 2025
# =================================================================

set -e

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

# Options
SHOW_CODE_DIFFS=false
SHOW_CONFIG_DIFFS=false
SHOW_DEPLOYMENT_DIFFS=false
SHOW_ALL=true

# Functions
print_section() {
    echo -e "\n${BLUE}===================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================================${NC}"
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

print_header() {
    echo -e "${CYAN}--- $1 ---${NC}"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --code)
            SHOW_CODE_DIFFS=true
            SHOW_ALL=false
            shift
            ;;
        --config)
            SHOW_CONFIG_DIFFS=true
            SHOW_ALL=false
            shift
            ;;
        --deployment)
            SHOW_DEPLOYMENT_DIFFS=true
            SHOW_ALL=false
            shift
            ;;
        --all)
            SHOW_ALL=true
            shift
            ;;
        --help)
            echo "用法: $0 [选项]"
            echo "选项:"
            echo "  --code        显示代码差异"
            echo "  --config      显示配置差异"
            echo "  --deployment  显示部署配置差异"
            echo "  --all         显示所有差异（默认）"
            echo "  --help        显示此帮助信息"
            exit 0
            ;;
        *)
            print_error "未知选项: $1"
            echo "使用 --help 查看可用选项"
            exit 1
            ;;
    esac
done

print_section "ChainReactions Backend - 环境差异分析"

# Validate paths
if [ ! -d "$DEV_ENV_PATH" ]; then
    print_error "开发环境路径不存在: $DEV_ENV_PATH"
    exit 1
fi

if [ ! -d "$PROD_ENV_PATH" ]; then
    print_error "生产环境路径不存在: $PROD_ENV_PATH"
    exit 1
fi

print_info "开发环境: $DEV_ENV_PATH"
print_info "生产环境: $PROD_ENV_PATH"

# =================================================================
# BASIC COMPARISON
# =================================================================
print_section "基础环境信息对比"

print_header "Git仓库状态"
if [ -d "$DEV_ENV_PATH/.git" ]; then
    cd "$DEV_ENV_PATH"
    DEV_GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    DEV_GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    DEV_GIT_STATUS=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    print_info "开发环境: 分支=$DEV_GIT_BRANCH, 提交=$DEV_GIT_COMMIT, 变更数=$DEV_GIT_STATUS"
else
    print_warning "开发环境: 不是Git仓库"
fi

if [ -d "$PROD_ENV_PATH/.git" ]; then
    cd "$PROD_ENV_PATH"
    PROD_GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    PROD_GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    PROD_GIT_STATUS=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    print_info "生产环境: 分支=$PROD_GIT_BRANCH, 提交=$PROD_GIT_COMMIT, 变更数=$PROD_GIT_STATUS"
else
    print_warning "生产环境: 不是Git仓库"
fi

print_header "目录结构对比"
print_info "开发环境目录结构:"
ls -la "$DEV_ENV_PATH" | grep -E "^d" | head -10

print_info "生产环境目录结构:"
ls -la "$PROD_ENV_PATH" | grep -E "^d" | head -10

# =================================================================
# DOCKER CONFIGURATION DIFFERENCES
# =================================================================
if [ "$SHOW_ALL" = true ] || [ "$SHOW_CONFIG_DIFFS" = true ]; then
    print_section "Docker配置差异"

    print_header "Dockerfile版本对比"
    echo "检查Node.js版本差异:"

    for service in entity-relations entity-search dataset-matching data-management dataset-search; do
        if [ -f "$DEV_ENV_PATH/services/$service/Dockerfile" ] && [ -f "$PROD_ENV_PATH/services/$service/Dockerfile" ]; then
            DEV_NODE=$(grep "^FROM node:" "$DEV_ENV_PATH/services/$service/Dockerfile" | head -1)
            PROD_NODE=$(grep "^FROM node:" "$PROD_ENV_PATH/services/$service/Dockerfile" | head -1)

            if [ "$DEV_NODE" = "$PROD_NODE" ]; then
                print_success "$service: Node.js版本一致 ($DEV_NODE)"
            else
                print_warning "$service: Node.js版本不同"
                print_info "  开发: $DEV_NODE"
                print_info "  生产: $PROD_NODE"
            fi
        fi
    done

    print_header "健康检查配置对比"
    for service in entity-relations entity-search dataset-matching data-management dataset-search; do
        if [ -f "$DEV_ENV_PATH/services/$service/Dockerfile" ] && [ -f "$PROD_ENV_PATH/services/$service/Dockerfile" ]; then
            DEV_HEALTH=$(grep -A 5 "HEALTHCHECK" "$DEV_ENV_PATH/services/$service/Dockerfile" 2>/dev/null || echo "未找到")
            PROD_HEALTH=$(grep -A 5 "HEALTHCHECK" "$PROD_ENV_PATH/services/$service/Dockerfile" 2>/dev/null || echo "未找到")

            if [ "$DEV_HEALTH" = "$PROD_HEALTH" ]; then
                print_success "$service: 健康检查配置一致"
            else
                print_warning "$service: 健康检查配置不同"
                print_info "  开发环境健康检查可能已优化"
            fi
        fi
    done

    print_header "Docker Compose对比"
    if [ -f "$DEV_ENV_PATH/docker-compose.yml" ] && [ -f "$PROD_ENV_PATH/docker-compose.yml" ]; then
        print_info "Docker Compose文件差异:"
        diff -u "$DEV_ENV_PATH/docker-compose.yml" "$PROD_ENV_PATH/docker-compose.yml" | head -20 || print_success "Docker Compose配置相同"
    fi
fi

# =================================================================
# CODE DIFFERENCES
# =================================================================
if [ "$SHOW_ALL" = true ] || [ "$SHOW_CODE_DIFFS" = true ]; then
    print_section "代码差异分析"

    print_header "服务源代码对比"
    services=("entity-relations" "entity-search" "dataset-matching" "data-management" "dataset-search")

    for service in "${services[@]}"; do
        print_info "检查 $service 服务..."

        DEV_SERVICE_PATH="$DEV_ENV_PATH/services/$service"
        PROD_SERVICE_PATH="$PROD_ENV_PATH/services/$service"

        if [ -d "$DEV_SERVICE_PATH" ] && [ -d "$PROD_SERVICE_PATH" ]; then
            # Compare source code directories
            if [ -d "$DEV_SERVICE_PATH/src" ] && [ -d "$PROD_SERVICE_PATH/src" ]; then
                # Count TypeScript files
                DEV_TS_COUNT=$(find "$DEV_SERVICE_PATH/src" -name "*.ts" | wc -l | tr -d ' ')
                PROD_TS_COUNT=$(find "$PROD_SERVICE_PATH/src" -name "*.ts" | wc -l | tr -d ' ')

                if [ "$DEV_TS_COUNT" -eq "$PROD_TS_COUNT" ]; then
                    print_success "$service: TypeScript文件数量一致 ($DEV_TS_COUNT)"
                else
                    print_warning "$service: TypeScript文件数量不同 (开发:$DEV_TS_COUNT, 生产:$PROD_TS_COUNT)"
                fi

                # Check for differences in main files
                MAIN_FILES=("app.ts" "controllers/" "services/" "types/")
                for file in "${MAIN_FILES[@]}"; do
                    if [ -e "$DEV_SERVICE_PATH/src/$file" ] && [ -e "$PROD_SERVICE_PATH/src/$file" ]; then
                        if diff -r "$DEV_SERVICE_PATH/src/$file" "$PROD_SERVICE_PATH/src/$file" > /dev/null 2>&1; then
                            print_success "$service/$file: 内容相同"
                        else
                            print_warning "$service/$file: 内容存在差异"
                        fi
                    fi
                done
            fi

            # Compare package.json
            if [ -f "$DEV_SERVICE_PATH/package.json" ] && [ -f "$PROD_SERVICE_PATH/package.json" ]; then
                DEV_VERSION=$(grep -o '"version": "[^"]*"' "$DEV_SERVICE_PATH/package.json" | cut -d'"' -f4)
                PROD_VERSION=$(grep -o '"version": "[^"]*"' "$PROD_SERVICE_PATH/package.json" | cut -d'"' -f4)

                if [ "$DEV_VERSION" = "$PROD_VERSION" ]; then
                    print_success "$service: package.json版本一致 ($DEV_VERSION)"
                else
                    print_warning "$service: package.json版本不同 (开发:$DEV_VERSION, 生产:$PROD_VERSION)"
                fi
            fi
        else
            print_error "$service: 目录不完整"
        fi
    done
fi

# =================================================================
# DEPLOYMENT CONFIGURATION DIFFERENCES
# =================================================================
if [ "$SHOW_ALL" = true ] || [ "$SHOW_DEPLOYMENT_DIFFS" = true ]; then
    print_section "部署配置差异"

    print_header "部署脚本对比"
    deployment_files=("deploy.sh" "test_deployment.sh")

    for file in "${deployment_files[@]}"; do
        if [ -f "$DEV_ENV_PATH/$file" ] && [ -f "$PROD_ENV_PATH/$file" ]; then
            DEV_SIZE=$(stat -f%z "$DEV_ENV_PATH/$file" 2>/dev/null || stat -c%s "$DEV_ENV_PATH/$file" 2>/dev/null || echo "unknown")
            PROD_SIZE=$(stat -f%z "$PROD_ENV_PATH/$file" 2>/dev/null || stat -c%s "$PROD_ENV_PATH/$file" 2>/dev/null || echo "unknown")

            if [ "$DEV_SIZE" = "$PROD_SIZE" ]; then
                print_success "$file: 文件大小一致 ($DEV_SIZE bytes)"
            else
                print_warning "$file: 文件大小不同 (开发:$DEV_SIZE, 生产:$PROD_SIZE)"
            fi
        elif [ -f "$PROD_ENV_PATH/$file" ]; then
            print_warning "$file: 仅生产环境存在"
        else
            print_warning "$file: 两个环境都不存在或仅开发环境存在"
        fi
    done

    print_header "环境变量配置对比"
    if [ -f "$DEV_ENV_PATH/.env.docker.example" ] && [ -f "$PROD_ENV_PATH/.env.docker.example" ]; then
        print_info "环境变量模板差异:"
        diff -u "$DEV_ENV_PATH/.env.docker.example" "$PROD_ENV_PATH/.env.docker.example" | head -20 || print_success "环境变量配置相同"
    fi

    print_header "文档对比"
    doc_files=("DOCKER_DEPLOYMENT.md" "README.md")
    for file in "${doc_files[@]}"; do
        if [ -f "$DEV_ENV_PATH/$file" ] && [ -f "$PROD_ENV_PATH/$file" ]; then
            if diff -q "$DEV_ENV_PATH/$file" "$PROD_ENV_PATH/$file" > /dev/null 2>&1; then
                print_success "$file: 文档内容相同"
            else
                print_warning "$file: 文档内容存在差异"
            fi
        fi
    done
fi

# =================================================================
# PERFORMANCE AND SECURITY COMPARISON
# =================================================================
print_section "性能和安全配置对比"

print_header "性能配置检查"
echo "检查Node.js内存限制配置:"
for service in entity-relations entity-search dataset-matching data-management dataset-search; do
    if [ -f "$DEV_ENV_PATH/services/$service/Dockerfile" ]; then
        MEMORY_LIMIT=$(grep "NODE_OPTIONS.*max-old-space-size" "$DEV_ENV_PATH/services/$service/Dockerfile" || echo "未设置")
        if [ "$MEMORY_LIMIT" != "未设置" ]; then
            print_success "$service: 已设置内存限制"
        else
            print_warning "$service: 未设置内存限制"
        fi
    fi
done

print_header "安全配置检查"
echo "检查非root用户配置:"
for service in entity-relations entity-search dataset-matching data-management dataset-search; do
    if [ -f "$DEV_ENV_PATH/services/$service/Dockerfile" ]; then
        NON_ROOT_USER=$(grep -E "^(USER|adduser)" "$DEV_ENV_PATH/services/$service/Dockerfile" || echo "未找到")
        if [[ "$NON_ROOT_USER" == *"USER"* ]] || [[ "$NON_ROOT_USER" == *"adduser"* ]]; then
            print_success "$service: 使用非root用户"
        else
            print_warning "$service: 可能使用root用户"
        fi
    fi
done

# =================================================================
# SUMMARY AND RECOMMENDATIONS
# =================================================================
print_section "差异总结和建议"

print_info "环境差异分析完成！"

echo -e "\n${CYAN}关键发现：${NC}"
echo -e "  • 开发环境可能包含最新的业务代码"
echo -e "  • 生产环境包含完整的部署工具和配置"
echo -e "  • 两个环境的Docker配置可能存在版本差异"

echo -e "\n${YELLOW}建议：${NC}"
echo -e "  1. 使用 ./sync-to-production.sh 安全同步代码"
echo -e "  2. 在同步前确保开发环境的代码已经过测试"
echo -e "  3. 保留生产环境的部署配置和脚本"
echo -e "  4. 同步后在生产环境运行完整测试"

echo -e "\n${GREEN}可用工具：${NC}"
echo -e "  • ./sync-to-production.sh - 同步代码到生产环境"
echo -e "  • ./test_deployment.sh - 测试部署状态"
echo -e "  • ./deploy.sh - 执行部署"
echo -e "  • ./environment-diff.sh --help - 查看更多选项"

print_success "环境差异分析完成！"