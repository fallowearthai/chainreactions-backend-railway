# Docker 构建修复指南

## 问题摘要

在DigitalOcean Droplet上部署时，`docker compose build` 遇到多个TypeScript编译错误：

1. **缺少共享依赖**：ioredis, pg, axios 等包未在各个服务中安装
2. **导入路径错误**：使用 `../../../src/shared/...` 路径，但Docker构建中共享模块在 `./src/shared/`
3. **TypeScript类型错误**：多个类型不匹配和缺失类型声明

## 已完成的修复

### 1. 添加共享依赖到所有服务 ✅

**脚本**: `scripts/update-shared-deps.js`

为以下所有服务添加了共享模块所需的依赖：
- entity-relations
- entity-search
- dataset-matching
- data-management
- dataset-search
- user-management

**添加的依赖**:
```json
{
  "dependencies": {
    "ioredis": "^5.3.2",
    "pg": "^8.11.3",
    "axios": "^1.6.2",
    "compression": "^1.7.4"
  },
  "devDependencies": {
    "@types/ioredis": "^5.0.0",
    "@types/pg": "^8.10.9",
    "@types/compression": "^1.7.5"
  }
}
```

### 2. 修复TypeScript编译错误 ✅

**修复的文件**:
- `src/shared/cache/CacheService.ts` - 添加Error类型注解
- `src/shared/cache/CachedAPIService.ts` - 修复类型断言和filter类型
- `src/shared/database/DatabaseOptimizer.ts` - 修复类型导入和属性初始化
- `src/shared/errors/ServiceErrors.ts` - 修复类继承问题
- `src/shared/utils/CommonUtilities.ts` - 修复索引类型和类型约束
- `src/shared/testing/PerformanceTestSuite.ts` - 修复数组类型

### 3. 修复导入路径 ✅

**脚本**: `scripts/fix-import-paths-correct.js`

将所有服务的导入路径从：
```typescript
import { Logger } from '../../../src/shared/utils/Logger';
```

改为：
```typescript
import { Logger } from './shared/utils/Logger';
```

### 4. 创建符号链接 ✅

**脚本**: `scripts/setup-symlinks.sh`

为本地开发创建符号链接：
```bash
services/[service-name]/src/shared -> ../../../src/shared
```

这样本地开发和Docker构建可以使用相同的导入路径 `./shared/...`。

## 部署到DigitalOcean步骤

### 选项1：使用完整准备脚本（推荐）

```bash
# 在本地运行完整准备流程
bash scripts/prepare-all-services.sh
```

这个脚本会自动完成：
1. 更新所有服务的依赖
2. 创建符号链接
3. 修复导入路径
4. 安装依赖包
5. 验证构建

### 选项2：手动步骤

如果需要手动控制，可以按以下步骤：

```bash
# 1. 添加共享依赖
node scripts/update-shared-deps.js

# 2. 创建符号链接（用于本地开发）
bash scripts/setup-symlinks.sh

# 3. 修复导入路径
node scripts/fix-import-paths-correct.js

# 4. 为每个服务安装依赖
for service in entity-relations entity-search dataset-matching data-management dataset-search user-management; do
  cd services/$service && npm install && cd ../..
done

# 5. 验证本地构建
for service in entity-relations entity-search dataset-matching data-management dataset-search user-management; do
  cd services/$service && npm run build && cd ../..
done
```

### 部署到Droplet

```bash
# 1. 提交所有更改
git add .
git commit -m "fix: 修复Docker构建问题 - 添加共享依赖和修复TypeScript错误"
git push

# 2. SSH到Droplet
ssh root@your-droplet-ip

# 3. 拉取最新代码
cd /root/chainreactions_backend
git pull

# 4. 构建Docker镜像
docker compose build

# 5. 启动服务
docker compose up -d

# 6. 查看日志
docker compose logs -f
```

## 重要说明

### 本地开发 vs Docker构建

- **本地开发**：符号链接 `src/shared -> ../../../src/shared` 允许使用 `./shared/...` 路径
- **Docker构建**：`COPY src/shared/ ./src/shared/` 将共享模块复制到正确位置

两者现在使用相同的导入路径：`from './shared/...'`

### 首次部署需要运行的脚本

**重要**：符号链接不会提交到Git。在新环境中首次部署时需要运行：

```bash
# 在Droplet上首次部署时
cd /root/chainreactions_backend
bash scripts/setup-symlinks.sh
bash scripts/fix-import-paths-correct.js

# 然后再构建
docker compose build
```

或者将符号链接创建添加到 `deploy.sh` 脚本中。

### 依赖安装

Docker构建时会自动安装依赖（Dockerfile中的 `npm install`），但建议在本地先验证构建成功。

## 验证构建

### 本地验证

```bash
# 测试单个服务
cd services/data-management
npm run build

# 测试所有服务
bash scripts/prepare-all-services.sh
```

### Docker验证

```bash
# 构建所有服务
docker compose build

# 检查构建结果
docker images | grep chainreactions
```

## 故障排查

### 构建失败：找不到模块

**原因**：符号链接未创建或导入路径未修复

**解决**：
```bash
bash scripts/setup-symlinks.sh
node scripts/fix-import-paths-correct.js
```

### 构建失败：类型错误

**原因**：依赖未安装

**解决**：
```bash
cd services/[service-name]
npm install
npm run build
```

### Docker构建超时

**原因**：依赖安装时间过长

**解决**：在Dockerfile中已配置npm超时设置
```dockerfile
RUN npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-timeout 300000
```

## 文件清单

### 新增脚本

1. `scripts/update-shared-deps.js` - 更新所有服务的共享依赖
2. `scripts/fix-import-paths.js` - 修复导入路径（第一版）
3. `scripts/fix-import-paths-correct.js` - 修复导入路径（正确版）
4. `scripts/setup-symlinks.sh` - 创建符号链接
5. `scripts/prepare-all-services.sh` - 完整准备流程

### 修改的文件

所有服务的 `package.json` - 添加了共享依赖
所有服务的 `src/app.ts` - 修复了导入路径
多个共享模块文件 - 修复了TypeScript类型错误

## 总结

所有Docker构建问题已修复：
- ✅ 添加了所有必需的依赖包
- ✅ 修复了TypeScript编译错误
- ✅ 统一了导入路径（本地和Docker）
- ✅ 创建了自动化脚本
- ✅ 提供了完整的部署指南

现在可以在DigitalOcean Droplet上成功构建和部署所有微服务。
