#!/bin/bash
# verify-deployment.sh - 验证部署配置脚本

set -e

echo "🔍 ChainReactions Backend 部署配置验证"
echo "========================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅ 文件存在: $1${NC}"
        return 0
    else
        echo -e "${RED}❌ 文件缺失: $1${NC}"
        return 1
    fi
}

check_port_in_dockerfile() {
    local service=$1
    local expected_port=$2
    local dockerfile="services/$service/Dockerfile"

    if grep -q "EXPOSE $expected_port" "$dockerfile"; then
        echo -e "${GREEN}✅ $service Dockerfile 端口正确: $expected_port${NC}"
        return 0
    else
        echo -e "${RED}❌ $service Dockerfile 端口错误${NC}"
        return 1
    fi
}

errors=0

echo -e "\n📁 检查必需文件..."
check_file "docker-compose.yml" || ((errors++))
check_file ".env.production.example" || ((errors++))
check_file "DEPLOYMENT_SECURITY.md" || ((errors++))

echo -e "\n🐳 检查 Dockerfile 端口配置..."
check_port_in_dockerfile "entity-relations" "3002" || ((errors++))
check_port_in_dockerfile "entity-search" "3003" || ((errors++))
check_port_in_dockerfile "dataset-matching" "3004" || ((errors++))
check_port_in_dockerfile "data-management" "3005" || ((errors++))
check_port_in_dockerfile "dataset-search" "3006" || ((errors++))
check_port_in_dockerfile "user-management" "3007" || ((errors++))

echo -e "\n🔧 检查 docker-compose.yml 配置..."
if grep -q "user-management:" docker-compose.yml; then
    echo -e "${GREEN}✅ user-management 服务已添加到 docker-compose.yml${NC}"
else
    echo -e "${RED}❌ user-management 服务缺失${NC}"
    ((errors++))
fi

if grep -A 10 "user-management:" docker-compose.yml | grep -q "3007:3007"; then
    echo -e "${GREEN}✅ user-management 端口映射正确${NC}"
else
    echo -e "${RED}❌ user-management 端口映射错误${NC}"
    ((errors++))
fi

if grep -q "REDIS_URL=redis://:\${REDIS_PASSWORD}@" docker-compose.yml; then
    echo -e "${GREEN}✅ Redis 连接配置包含密码${NC}"
else
    echo -e "${RED}❌ Redis 连接配置缺少密码${NC}"
    ((errors++))
fi

if ! grep -q '"6379:6379"' docker-compose.yml; then
    echo -e "${GREEN}✅ Redis 端口已从外部暴露移除${NC}"
else
    echo -e "${RED}❌ Redis 端口仍然对外暴露${NC}"
    ((errors++))
fi

echo -e "\n🔒 检查安全配置..."
if grep -q "requirepass" docker-compose.yml; then
    echo -e "${GREEN}✅ Redis 密码认证已启用${NC}"
else
    echo -e "${RED}❌ Redis 密码认证未启用${NC}"
    ((errors++))
fi

echo -e "\n📊 检查服务目录结构..."
services=("entity-relations" "entity-search" "dataset-matching" "data-management" "dataset-search" "user-management")
for service in "${services[@]}"; do
    if [ -d "services/$service" ]; then
        echo -e "${GREEN}✅ 服务目录存在: $service${NC}"
    else
        echo -e "${RED}❌ 服务目录缺失: $service${NC}"
        ((errors++))
    fi
done

echo -e "\n🔍 Docker Compose 语法检查..."
if docker-compose config > /dev/null 2>&1; then
    echo -e "${GREEN}✅ docker-compose.yml 语法正确${NC}"
else
    echo -e "${RED}❌ docker-compose.yml 语法错误${NC}"
    docker-compose config
    ((errors++))
fi

echo -e "\n📋 验证总结..."
if [ $errors -eq 0 ]; then
    echo -e "${GREEN}🎉 所有检查通过！配置已准备好用于 DigitalOcean 部署${NC}"
    echo -e "\n📝 下一步操作:"
    echo -e "1. 复制 .env.production.example 到 .env 并填入真实的 API 密钥"
    echo -e "2. 在 DigitalOcean Droplet 上设置环境变量"
    echo -e "3. 运行 'docker-compose up -d' 启动服务"
    echo -e "4. 参考 DEPLOYMENT_SECURITY.md 配置防火墙和 SSL"
    exit 0
else
    echo -e "${RED}❌ 发现 $errors 个配置问题，请修复后重新运行验证${NC}"
    echo -e "\n🔧 修复建议:"
    echo -e "- 检查所有错误项"
    echo -e "- 参考 CLAUDE.md 了解正确配置"
    echo -e "- 查看 DEPLOYMENT_SECURITY.md 了解安全要求"
    exit 1
fi
echo -e "\n📊 部署就绪度评估..."
echo -e "✅ Docker 配置: 已修复"
echo -e "✅ 端口映射: 正确"
echo -e "✅ 安全配置: 已加固"
echo -e "✅ 服务完整性: 6 个微服务"
echo -e "✅ 文档完整性: 已完善"

echo -e "\n🎯 DigitalOcean 部署建议:"
echo -e "1. 使用至少 2GB RAM 的 Droplet"
echo -e "2. 配置 DigitalOcean Load Balancer"
echo -e "3. 启用 Cloudflare CDN 和 DDoS 保护"
echo -e "4. 设置定期备份和监控"
echo -e "5. 配置 SSL 证书"