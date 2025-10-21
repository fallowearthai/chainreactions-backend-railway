# 🔄 Git工作流最佳实践指南

> **ChainReactions Backend项目Git管理规范**
> 适用于多环境、微服务架构的企业级项目管理

---

## 📋 目录

1. [分支策略](#分支策略)
2. [提交规范](#提交规范)
3. [环境管理](#环境管理)
4. [代码同步流程](#代码同步流程)
5. [发布管理](#发布管理)
6. [紧急修复流程](#紧急修复流程)
7. [质量保证](#质量保证)

---

## 🌿 分支策略

### 分支结构

```
main (生产分支)
├── develop (开发主分支)
├── feature/xxx (功能开发分支)
├── hotfix/xxx (紧急修复分支)
└── release/vx.x.x (发布准备分支)
```

### 分支说明

#### `main` 分支
- **用途**: 生产环境代码，始终保持可部署状态
- **保护**: 设置分支保护，禁止直接推送
- **同步**: 对应 `chainreactions_backend_railway` 项目
- **要求**: 所有提交必须通过PR和CI检查

#### `develop` 分支
- **用途**: 开发环境主分支，集成最新功能
- **同步**: 对应 `chainreactions_backend` 项目
- **状态**: 可能包含未完成的功能，需要稳定测试

#### `feature/*` 分支
- **命名**: `feature/功能描述` 或 `feature/JIRA-123-功能描述`
- **来源**: 从 `develop` 分支创建
- **合并**: 完成后合并回 `develop`
- **清理**: 合并后删除分支

#### `hotfix/*` 分支
- **命名**: `hotfix/问题描述` 或 `hotfix/JIRA-456-紧急修复`
- **来源**: 从 `main` 分支创建
- **合并**: 修复后同时合并到 `main` 和 `develop`
- **优先级**: 最高优先级，立即处理

#### `release/*` 分支
- **命名**: `release/v1.2.3`
- **用途**: 发布准备，Bug修复和文档更新
- **来源**: 从 `develop` 分支创建
- **合并**: 完成后合并到 `main` 和 `develop`

---

## ✅ 提交规范

### 提交消息格式

```
<类型>(<范围>): <描述>

[可选的正文]

[可选的脚注]
```

### 类型说明

- **feat**: 新功能
- **fix**: Bug修复
- **docs**: 文档更新
- **style**: 代码格式化（不影响功能）
- **refactor**: 代码重构
- **test**: 测试相关
- **chore**: 构建工具、依赖更新等
- **perf**: 性能优化
- **ci**: CI/CD相关

### 范围说明

- **entity-relations**: 实体关系服务
- **entity-search**: 实体搜索服务
- **dataset-matching**: 数据集匹配服务
- **data-management**: 数据管理服务
- **dataset-search**: 数据集搜索服务
- **docker**: Docker配置
- **deploy**: 部署配置
- **docs**: 文档
- **ci**: CI/CD配置

### 示例

```bash
feat(entity-relations): 添加DeepThinking 3阶段OSINT工作流

- 实现元提示词生成逻辑
- 添加多引擎搜索结果聚合
- 集成Gemini AI进行深度分析

Closes #123
```

```bash
fix(docker): 修复dataset-search健康检查配置

- 更新健康检查端点路径
- 优化超时配置
- 增加重试机制
```

```bash
docs(readme): 更新微服务架构文档

- 添加Phase 4直连架构说明
- 更新服务端口配置
- 补充故障排查指南
```

---

## 🌍 环境管理

### 环境映射

| Git分支 | 环境路径 | 用途 | 部署状态 |
|---------|---------|------|---------|
| `main` | `chainreactions_backend_railway` | 生产环境 | 生产就绪 |
| `develop` | `chainreactions_backend` | 开发环境 | 开发测试 |

### 环境特定文件

#### 生产环境特有文件
```
chainreactions_backend_railway/
├── deploy.sh              # 生产部署脚本
├── test_deployment.sh     # 部署测试套件
├── docs/*DEPLOYMENT*.md   # 部署相关文档
├── railway.toml          # 部署平台配置
└── backups/              # 自动备份目录
```

#### 开发环境特有文件
```
chainreactions_backend/
├── src/                  # 开发中的工具脚本
├── test/                 # 开发测试文件
├── .env                  # 本地环境变量
└── docs/DEVELOPMENT*.md  # 开发相关文档
```

### 环境变量管理

#### 共享配置
- `.env.docker.example` - 两个环境共享的模板
- `CLAUDE.md` - 项目说明文档
- `redis.conf` - Redis配置

#### 环境特定配置
- 生产环境: 包含完整的部署配置
- 开发环境: 包含开发调试配置

---

## 🔄 代码同步流程

### 开发到生产同步

```bash
# 1. 开发环境完成开发和测试
cd chainreactions_backend
git checkout develop
git add .
git commit -m "feat: 完成新功能开发"
git push origin develop

# 2. 运行环境差异检查
./environment-diff.sh --all

# 3. 执行代码同步
./sync-to-production.sh

# 4. 生产环境验证
cd chainreactions_backend_railway
git status
git diff
./test_deployment.sh

# 5. 生产环境部署
git add .
git commit -m "sync: 从开发环境同步最新代码"
git push origin main
./deploy.sh
```

### 同步工具使用

#### 环境差异检查
```bash
# 检查所有差异
./environment-diff.sh --all

# 只检查代码差异
./environment-diff.sh --code

# 只检查配置差异
./environment-diff.sh --config

# 只检查部署配置差异
./environment-diff.sh --deployment
```

#### 安全同步
```bash
# 交互式同步，包含备份和验证
./sync-to-production.sh
```

---

## 🚀 发布管理

### 版本号规范

采用语义化版本控制 (Semantic Versioning):
```
主版本.次版本.修订版本 (MAJOR.MINOR.PATCH)
```

- **主版本**: 不兼容的API变更
- **次版本**: 向后兼容的功能新增
- **修订版本**: 向后兼容的问题修正

### 发布流程

#### 准备发布
```bash
# 1. 创建发布分支
git checkout develop
git pull origin develop
git checkout -b release/v1.2.3

# 2. 更新版本号
# 更新各个服务的package.json版本号
# 更新CHANGELOG.md

# 3. 最终测试
npm run test
./test_deployment.sh

# 4. 合并到主分支
git checkout main
git merge --no-ff release/v1.2.3
git tag -a v1.2.3 -m "Release version 1.2.3"

# 5. 合并回开发分支
git checkout develop
git merge --no-ff release/v1.2.3

# 6. 推送所有变更
git push origin main
git push origin develop
git push origin v1.2.3

# 7. 删除发布分支
git branch -d release/v1.2.3
```

#### 发布到生产环境
```bash
# 1. 同步到生产环境目录
./sync-to-production.sh

# 2. 生产环境部署
cd chainreactions_backend_railway
./deploy.sh

# 3. 验证部署
./test_deployment.sh

# 4. 更新文档（如需要）
```

---

## 🚨 紧急修复流程

### Hotfix流程

```bash
# 1. 创建hotfix分支（从main分支）
git checkout main
git pull origin main
git checkout -b hotfix/fix-critical-bug

# 2. 修复问题
# 进行代码修复...

# 3. 测试修复
npm run test
./test_deployment.sh

# 4. 合并到main分支
git checkout main
git merge --no-ff hotfix/fix-critical-bug
git tag -a v1.2.4 -m "Hotfix: 修复关键问题"

# 5. 合并到develop分支
git checkout develop
git merge --no-ff hotfix/fix-critical-bug

# 6. 推送修复
git push origin main
git push origin develop
git push origin v1.2.4

# 7. 同步到生产环境
./sync-to-production.sh
cd chainreactions_backend_railway
./deploy.sh

# 8. 清理分支
git branch -d hotfix/fix-critical-bug
```

### 紧急修复注意事项

- **快速响应**: 优先处理，无需等待常规发布周期
- **最小变更**: 只修复关键问题，避免其他变更
- **充分测试**: 确保修复不会引入新问题
- **文档记录**: 详细记录问题原因和解决方案

---

## 🔍 质量保证

### 代码审查清单

#### 功能性检查
- [ ] 功能是否按需求实现
- [ ] 是否有回归测试
- [ ] API兼容性是否保持
- [ ] 错误处理是否完善

#### 技术性检查
- [ ] 代码是否遵循项目规范
- [ ] 是否有安全漏洞
- [ ] 性能是否有影响
- [ ] 测试覆盖率是否足够

#### 部署相关检查
- [ ] Docker配置是否正确
- [ ] 环境变量是否完整
- [ ] 健康检查是否正常
- [ ] 日志记录是否充分

### 自动化检查

#### Pre-commit Hooks
```bash
#!/bin/sh
# .git/hooks/pre-commit

# 代码格式检查
npm run lint

# TypeScript类型检查
npm run type-check

# 单元测试
npm test

# Docker配置检查
docker-compose config > /dev/null
```

#### CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Type check
        run: npm run type-check

      - name: Build services
        run: |
          for service in services/*/; do
            cd "$service" && npm run build && cd ../..
          done

      - name: Test Docker build
        run: docker-compose build --parallel
```

### 监控和告警

#### 健康检查监控
```bash
# 添加到crontab，每5分钟检查一次
*/5 * * * * /path/to/health-check.sh
```

```bash
#!/bin/bash
# health-check.sh
SERVICES=("3002" "3003" "3004" "3005" "3006")
FAILED_SERVICES=""

for port in "${SERVICES[@]}"; do
    if ! curl -f -s "http://localhost:$port/api/health" > /dev/null; then
        FAILED_SERVICES="$FAILED_SERVICES $port"
    fi
done

if [ -n "$FAILED_SERVICES" ]; then
    # 发送告警通知
    echo "告警: 以下服务健康检查失败:$FAILED_SERVICES" | \
    mail -s "ChainReactions服务告警" admin@example.com
fi
```

---

## 📚 参考资源

### Git工作流参考
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [语义化版本控制](https://semver.org/lang/zh-CN/)

### 工具文档
- [环境差异检查工具](./environment-diff.sh)
- [代码同步工具](./sync-to-production.sh)
- [部署测试工具](./test_deployment.sh)
- [一键部署脚本](./deploy.sh)

### 最佳实践
- [Commitizen](https://commitizen.github.io/cz-cli/) - 标准化提交信息
- [Husky](https://typicode.github.io/husky/) - Git hooks管理
- [ESLint](https://eslint.org/) - 代码质量检查
- [Prettier](https://prettier.io/) - 代码格式化

---

**文档版本**: 1.0.0
**最后更新**: 2025年10月21日
**维护者**: ChainReactions开发团队

如有问题或建议，请创建Issue或联系开发团队。