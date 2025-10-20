# Entity Search - Google Search 实施计划

## 执行概要

将 `entity-search` 服务从 Linkup API 迁移到 Gemini Google Search,实现更高质量的商业情报搜索,同时获得完整的 grounding metadata 支持。

---

## 阶段 1: 代码迁移 (Phase 1: Code Migration)

### 1.1 文件替换
```bash
# 备份当前版本
cd /Users/kanbei/Code/chainreactions_backend
cp -r services/entity-search services/entity-search.backup

# 复制新文件
cp test/GeminiSearchService.ts services/entity-search/src/services/
cp test/EntitySearchController.ts services/entity-search/src/controllers/
cp test/app.ts services/entity-search/src/
cp test/.env.example services/entity-search/
```

### 1.2 删除旧代码
```bash
cd services/entity-search/src/services
rm -f LinkupService.ts
rm -f responseParser.ts  # 如果只用于 Linkup
```

### 1.3 更新类型定义
- 合并 `GeminiSearchService.ts` 中的类型到 `src/types/types.ts`
- 或者保持类型定义在 Service 文件中

---

## 阶段 2: 环境配置 (Phase 2: Environment Setup)

### 2.1 更新 .env
```bash
cd services/entity-search

# 添加 Gemini API Key
echo "GEMINI_API_KEY=your_actual_gemini_api_key" >> .env

# 注释或删除 Linkup 配置
# LINKUP_API_KEY=...
# LINKUP_BASE_URL=...
```

### 2.2 验证配置
```bash
# 检查环境变量
cat .env | grep GEMINI_API_KEY
```

---

## 阶段 3: 构建与测试 (Phase 3: Build & Test)

### 3.1 TypeScript 编译
```bash
cd services/entity-search

# 安装依赖(如有新增)
npm install

# 类型检查
npm run type-check

# 构建
npm run build
```

### 3.2 启动服务
```bash
# 开发模式
npm run dev

# 或生产模式
npm start
```

### 3.3 功能测试
```bash
# 1. 健康检查
curl http://localhost:3003/api/health

# 2. 服务信息
curl http://localhost:3003/api/info

# 3. 实际搜索测试
curl -X POST http://localhost:3003/api/entity-search \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Tesla Inc",
    "location": "United States"
  }'

# 4. 测试中文公司
curl -X POST http://localhost:3003/api/entity-search \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "华为技术有限公司",
    "location": "China"
  }'
```

---

## 阶段 4: API Gateway 更新 (Phase 4: API Gateway Update)

### 4.1 验证路由
确保 API Gateway 的 entity-search 路由仍然正常工作:

```bash
# 通过 API Gateway 测试
curl -X POST http://localhost:3000/api/entity-search \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Apple Inc"
  }'
```

### 4.2 更新健康检查
API Gateway 的 `/api/health` 应该反映 entity-search 使用 Google Search。

---

## 阶段 5: 前端集成测试 (Phase 5: Frontend Integration)

### 5.1 响应格式验证
确保新的响应格式与前端兼容:

**关键变更**:
- `sources`: 从简单 URL 数组变为对象数组(包含 title, url, type)
- 新增字段: `key_evidence`, `search_queries`, `quality_metrics`

**前端需要适配**:
```typescript
// 旧格式
interface OldResponse {
  data: {
    sources: string[]  // 简单 URL 数组
  }
}

// 新格式
interface NewResponse {
  data: {
    sources: Array<{
      id: number;
      title: string;
      url: string;
      type: string;
    }>,
    key_evidence: Array<{
      text: string;
      source_indices: number[];
    }>,
    search_queries: string[],
    quality_metrics: {
      sources_count: number;
      evidence_count: number;
      vendors_count: number;
      partnerships_count: number;
    }
  }
}
```

### 5.2 前端测试清单
- [ ] 公司信息显示正常
- [ ] 来源链接可点击
- [ ] 新增的 evidence/queries 数据不破坏 UI
- [ ] 错误处理正常

---

## 阶段 6: 文档更新 (Phase 6: Documentation)

### 6.1 更新 CLAUDE.md
```markdown
### Entity Search (Port 3003)
- **Purpose**: Google Search integration for professional business intelligence
- **Features**: Grounding metadata, evidence extraction, vendor/partnership detection
- **Key Configuration**: `GEMINI_API_KEY`
- **Search Engine**: Google Search (via Gemini 2.5 Flash)
```

### 6.2 更新服务 README
```bash
cd services/entity-search
# 更新 README.md 说明使用 Google Search
```

---

## 阶段 7: 部署 (Phase 7: Deployment)

### 7.1 本地验证
确保所有测试通过后:
```bash
# 停止所有服务
pkill -f "node.*entity-search"

# 重新启动
cd services/entity-search
npm start
```

### 7.2 Docker 构建(如果使用)
```bash
cd services/entity-search
docker build -t chainreactions-entity-search:2.0 .
docker run -p 3003:3003 \
  -e GEMINI_API_KEY=your_key \
  chainreactions-entity-search:2.0
```

### 7.3 Railway/Vercel 部署
1. 更新环境变量: 添加 `GEMINI_API_KEY`
2. 推送代码到 main 分支
3. 触发自动部署
4. 验证生产环境

---

## 回滚计划 (Rollback Plan)

如果出现问题,快速回滚:

```bash
# 恢复备份
rm -rf services/entity-search
cp -r services/entity-search.backup services/entity-search

# 重启服务
cd services/entity-search
npm install
npm start
```

---

## 性能与成本对比

### 响应时间
- **Linkup**: 通常 30-60 秒
- **Google Search**: 60-120 秒(更全面的搜索)

### API 成本
- **Linkup**: 按调用计费,通常 $0.10-0.50/查询
- **Gemini**:
  - Input: $0.15/1M tokens
  - Output: $0.60/1M tokens
  - 估计: $0.05-0.15/查询(取决于响应长度)

### 搜索质量
- **Linkup**: 专注于商业数据库
- **Google Search**:
  - ✅ 更广泛的覆盖面
  - ✅ 政府/学术/新闻等多元来源
  - ✅ 完整的证据追踪
  - ✅ 搜索查询透明度

---

## 验收标准 (Acceptance Criteria)

- [ ] 所有 TypeScript 编译无错误
- [ ] 健康检查返回 `healthy` 状态
- [ ] 可以成功搜索英文公司(如 Tesla, Apple)
- [ ] 可以成功搜索中文公司(如 华为, 阿里巴巴)
- [ ] 响应包含完整的 grounding metadata
- [ ] 前端集成无破坏性变更
- [ ] API Gateway 路由正常
- [ ] 文档已更新

---

## 时间估算

- **代码迁移**: 30 分钟
- **环境配置**: 15 分钟
- **构建测试**: 30 分钟
- **前端适配**: 1-2 小时
- **文档更新**: 30 分钟
- **部署验证**: 30 分钟

**总计**: 约 3-4 小时

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Gemini API 配额不足 | 高 | 监控使用量,设置告警 |
| 响应时间过长 | 中 | 增加超时时间,前端显示进度 |
| JSON 解析失败 | 中 | 已实现健壮的解析逻辑 |
| 前端兼容性问题 | 高 | 保持响应格式向后兼容 |
| 搜索质量不符预期 | 中 | 可调整 system prompt |

---

## 联系与支持

- **代码问题**: 检查 `test/` 目录中的实现
- **API 配额**: 访问 Google AI Studio
- **前端适配**: 参考响应格式文档

---

**准备好后,请确认是否开始实施!**
