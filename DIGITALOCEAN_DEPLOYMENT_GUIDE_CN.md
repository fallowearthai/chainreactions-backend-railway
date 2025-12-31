# DigitalOcean 部署详细指南

**目标：** 将 ChainReactions Backend 的6个微服务部署到 DigitalOcean App Platform

**部署日期：** 2025-12-31
**架构：** 6个微服务 + Redis
**Node.js版本：** 20-alpine

---

## 📋 部署前准备清单

### 第一步：获取所有必需的API密钥

在开始部署之前，你需要准备以下API密钥和配置：

#### 1. Google Gemini API Key（必需）
- **用途：** Entity Relations服务（端口3002）
- **获取方式：**
  1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
  2. 使用Google账号登录
  3. 点击 "Create API Key"
  4. 复制并保存API密钥
- **格式：** `AIzaSy...`（以AIzaSy开头）

#### 2. Bright Data API Key（必需）
- **用途：** Entity Relations服务（端口3002）
- **获取方式：**
  1. 访问 [Bright Data](https://brightdata.com) 并登录
  2. 进入 Dashboard → API & Management
  3. 创建API密钥
  4. 配置SERP区域，记下区域名称
- **格式：** 任意字符串

#### 3. Linkup API Keys（需要2个不同的密钥）
- **用途：** Entity Search（端口3003）和 Dataset Search（端口3006）
- **获取方式：**
  1. 访问 [Linkup](https://linkup.ai)
  2. 注册账号
  3. 从Dashboard获取API密钥
  4. **重要：** 创建2个不同的密钥（一个给Entity Search，一个给Dataset Search）
- **格式：** `sk-...` 或其他格式

#### 4. Supabase凭证（必需）
- **用途：** Dataset Matching, Data Management, Dataset Search, User Management服务
- **获取方式：**
  1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
  2. 选择你的项目（或创建新项目）
  3. 进入 Settings → API
  4. 复制以下信息：
     - **Project URL** → `SUPABASE_URL`
     - **anon/public key** → `SUPABASE_ANON_KEY`
     - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`
- **格式：**
  - URL: `https://xxx.supabase.co`
  - Keys: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

#### 5. 生成JWT密钥（必需）
- **用途：** User Management服务（端口3007）
- **生成方式：** 使用以下命令生成32字符以上的随机字符串：

```bash
# 方法1：使用OpenSSL
openssl rand -base64 32

# 方法2：使用Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

- **需要生成2个不同的密钥：**
  - `JWT_SECRET`（用于访问令牌）
  - `REFRESH_TOKEN_SECRET`（用于刷新令牌）
- **重要：** 这两个密钥必须不同！

#### 6. Redis密码（可选但推荐）
- **用途：** 所有服务的缓存层
- **生成方式：** 使用上面的方法生成一个强密码
- **备注：** 如果不使用Redis，服务会使用内存缓存

---

### 准备工作检查表

在开始部署前，确保你已准备好：

- [ ] Gemini API key
- [ ] Bright Data API key
- [ ] Bright Data SERP zone name
- [ ] Linkup API key #1（Entity Search用）
- [ ] Linkup API key #2（Dataset Search用）
- [ ] Supabase Project URL
- [ ] Supabase anon key
- [ ] Supabase service_role key
- [ ] JWT_SECRET（32+字符）
- [ ] REFRESH_TOKEN_SECRET（32+字符）
- [ ] Redis密码（如果使用Redis）
- [ ] GitHub仓库已推送代码
- [ ] DigitalOcean账号已创建

---

## 🚀 开始部署到DigitalOcean

### 方案选择：推荐部署架构

DigitalOcean App Platform支持两种部署方式：

#### 方案A：单个App包含多个组件（推荐）
- **优点：** 统一管理，资源共享，成本较低
- **缺点：** 所有服务在同一App中
- **适合：** 中小型项目，预算有限

#### 方案B：每个服务独立App
- **优点：** 独立扩展，隔离性好
- **缺点：** 管理复杂，成本较高
- **适合：** 大型项目，需要独立扩展

**本文使用方案A（单个App多组件）进行讲解。**

---

## 📝 详细部署步骤

### 步骤1：创建DigitalOcean App

1. **登录DigitalOcean**
   - 访问 [https://cloud.digitalocean.com](https://cloud.digitalocean.com)
   - 使用邮箱/密码登录

2. **创建新App**
   - 点击顶部导航 "Apps" → "Create App"
   - 或直接访问：https://cloud.digitalocean.com/apps/create

3. **连接GitHub仓库**
   - 在 "Source" 部分，选择 "GitHub"
   - 首次使用需要授权DigitalOcean访问你的GitHub
   - 点击 "Authorize DigitalOcean"
   - 选择你的GitHub账号授权

4. **选择仓库**
   - 在仓库列表中找到：`fallowearthai/chainreactions-backend-railway`
   - 点击仓库名称
   - 选择分支：`main`（默认）

5. **配置区域**
   - 选择部署区域（推荐选择离用户最近的区域）
   - 亚洲用户推荐：Singapore
   - 中国用户推荐：Singapore（速度更快）
   - 全球用户推荐：San Francisco 或 New York

---

### 步骤2：配置服务组件

DigitalOcean会自动检测你的项目结构。由于我们使用微服务架构，需要手动添加每个服务。

#### 组件1：Entity Relations Service（端口3002）

1. **添加新组件**
   - 点击 "Add Component"
   - 选择 "From this repository's code"

2. **配置构建设置**
   ```
   Component Name: entity-relations
   Directory: /services/entity-relations
   Build Command: npm run build
   Run Command: npm start
   HTTP Port: 3002
   ```

3. **选择容器规格**
   - 开发/测试：Basic（0.1 vCPU, 256MB RAM）- $5/月
   - 生产环境：Professional（1 vCPU, 2GB RAM）- $40/月（推荐）
   - 高流量：Professional L（4 vCPU, 8GB RAM）- $200/月

4. **环境变量配置**
   点击 "Env Variables" → "Add Variable"，添加以下变量：

   | 变量名 | 值 | 加密 | 说明 |
   |--------|-----|------|------|
   | GEMINI_API_KEY | `你的Gemini密钥` | ✅ 是 | Google AI API密钥 |
   | BRIGHT_DATA_API_KEY | `你的Bright Data密钥` | ✅ 是 | Bright Data API密钥 |
   | BRIGHT_DATA_SERP_ZONE | `你的SERP区域名` | ❌ 否 | SERP区域名称 |
   | NODE_ENV | `production` | ❌ 否 | 生产环境 |
   | PORT | `3002` | ❌ 否 | 服务端口 |

   **如果使用Redis（可选）：**
   | REDIS_HOST | `redis` | ❌ 否 | Redis主机名 |
   | REDIS_PORT | `6379` | ❌ 否 | Redis端口 |
   | REDIS_PASSWORD | `你的Redis密码` | ✅ 是 | Redis密码 |

#### 组件2：Entity Search Service（端口3003）

1. **添加新组件**
   - 点击 "Add Component" → "From this repository's code"

2. **配置构建设置**
   ```
   Component Name: entity-search
   Directory: /services/entity-search
   Build Command: npm run build
   Run Command: npm start
   HTTP Port: 3003
   ```

3. **环境变量配置**

   | 变量名 | 值 | 加密 | 说明 |
   |--------|-----|------|------|
   | LINKUP_API_KEY | `你的Linkup密钥1` | ✅ 是 | Linkup API密钥（第1个） |
   | LINKUP_BASE_URL | `https://api.linkup.ai` | ❌ 否 | Linkup API地址 |
   | NODE_ENV | `production` | ❌ 否 | 生产环境 |
   | PORT | `3003` | ❌ 否 | 服务端口 |

#### 组件3：Dataset Matching Service（端口3004）

1. **添加新组件**
   - 点击 "Add Component" → "From this repository's code"

2. **配置构建设置**
   ```
   Component Name: dataset-matching
   Directory: /services/dataset-matching
   Build Command: npm run build
   Run Command: npm start
   HTTP Port: 3004
   ```

3. **环境变量配置**

   | 变量名 | 值 | 加密 | 说明 |
   |--------|-----|------|------|
   | SUPABASE_URL | `你的Supabase URL` | ✅ 是 | Supabase项目URL |
   | SUPABASE_ANON_KEY | `你的Supabase anon key` | ✅ 是 | Supabase匿名密钥 |
   | NODE_ENV | `production` | ❌ 否 | 生产环境 |
   | PORT | `3004` | ❌ 否 | 服务端口 |

   **如果使用Redis（可选）：**
   | REDIS_HOST | `redis` | ❌ 否 | Redis主机名 |
   | REDIS_PORT | `6379` | ❌ 否 | Redis端口 |
   | REDIS_PASSWORD | `你的Redis密码` | ✅ 是 | Redis密码 |

#### 组件4：Data Management Service（端口3005）

1. **添加新组件**
   - 点击 "Add Component" → "From this repository's code"

2. **配置构建设置**
   ```
   Component Name: data-management
   Directory: /services/data-management
   Build Command: npm run build
   Run Command: npm start
   HTTP Port: 3005
   ```

3. **环境变量配置**

   | 变量名 | 值 | 加密 | 说明 |
   |--------|-----|------|------|
   | SUPABASE_URL | `你的Supabase URL` | ✅ 是 | 与Dataset Matching相同 |
   | SUPABASE_SERVICE_ROLE_KEY | `你的Service Role Key` | ✅ 是 | Supabase服务角色密钥 |
   | UPLOAD_PATH | `/app/uploads` | ❌ 否 | 文件上传路径 |
   | NODE_ENV | `production` | ❌ 否 | 生产环境 |
   | PORT | `3005` | ❌ 否 | 服务端口 |

#### 组件5：Dataset Search Service（端口3006）

1. **添加新组件**
   - 点击 "Add Component" → "From this repository's code"

2. **配置构建设置**
   ```
   Component Name: dataset-search
   Directory: /services/dataset-search
   Build Command: npm run build
   Run Command: npm start
   HTTP Port: 3006
   ```

3. **环境变量配置**

   | 变量名 | 值 | 加密 | 说明 |
   |--------|-----|------|------|
   | SUPABASE_URL | `你的Supabase URL` | ✅ 是 | 与其他服务相同 |
   | SUPABASE_ANON_KEY | `你的Supabase anon key` | ✅ 是 | 与其他服务相同 |
   | LINKUP_API_KEY_2 | `你的Linkup密钥2` | ✅ 是 | Linkup API密钥（第2个，与Entity Search不同） |
   | NODE_ENV | `production` | ❌ 否 | 生产环境 |
   | PORT | `3006` | ❌ 否 | 服务端口 |

#### 组件6：User Management Service（端口3007）

1. **添加新组件**
   - 点击 "Add Component" → "From this repository's code"

2. **配置构建设置**
   ```
   Component Name: user-management
   Directory: /services/user-management
   Build Command: npm run build
   Run Command: npm start
   HTTP Port: 3007
   ```

3. **环境变量配置**

   | 变量名 | 值 | 加密 | 说明 |
   |--------|-----|------|------|
   | SUPABASE_URL | `你的Supabase URL` | ✅ 是 | 与其他服务相同 |
   | SUPABASE_ANON_KEY | `你的Supabase anon key` | ✅ 是 | 与其他服务相同 |
   | SUPABASE_SERVICE_ROLE_KEY | `你的Service Role Key` | ✅ 是 | 与Data Management相同 |
   | JWT_SECRET | `你生成的JWT密钥` | ✅ 是 | 访问令牌密钥（32+字符） |
   | REFRESH_TOKEN_SECRET | `你生成的刷新密钥` | ✅ 是 | 刷新令牌密钥（32+字符，与JWT_SECRET不同） |
   | FRONTEND_URL | `https://chainreactions.site` | ❌ 否 | 前端URL |
   | ALLOWED_ORIGINS | `https://chainreactions.site,https://www.chainreactions.site,https://chainreactions-frontend-dev.vercel.app` | ❌ 否 | CORS允许的源（逗号分隔） |
   | NODE_ENV | `production` | ❌ 否 | 生产环境 |
   | PORT | `3007` | ❌ 否 | 服务端口 |

---

### 步骤3：配置Redis（可选但推荐）

如果你的服务需要高性能缓存，可以添加Redis组件：

1. **添加Redis组件**
   - 点击 "Add Component" → "Redis"
   - 选择版本：7.x（推荐）

2. **配置Redis**
   ```
   Component Name: redis
   Plan: Basic $5/mo（256MB）或 Professional $15/mo（1GB）
   ```

3. **设置密码**
   - 在Redis组件设置中，点击 "Settings"
   - 找到 "Redis Password"
   - 输入你生成的Redis密码
   - 保存设置

4. **更新所有服务的Redis连接字符串**
   - 回到每个服务的环境变量设置
   - 确保 `REDIS_HOST` = `redis`（组件名称）
   - 确保 `REDIS_PORT` = `6379`
   - 确保 `REDIS_PASSWORD` 与Redis组件设置的密码一致

---

### 步骤4：健康检查配置

DigitalOcean会自动配置健康检查。每个服务都有 `/api/health` 端点。

**验证健康检查设置：**
- Path: `/api/health`
- Check interval: 30秒（默认）
- Timeout: 3秒（默认）
- Retries: 3次（默认）

如果需要修改，点击组件 → "Settings" → "Health Checks"

---

### 步骤5：部署应用

1. **检查所有配置**
   - 确认所有6个服务已添加
   - 确认所有环境变量已设置
   - 确认敏感变量已标记为"Encrypted"（锁形图标🔒）
   - 确认容器规格已选择

2. **点击部署**
   - 点击页面顶部的 "Deploy" 按钮
   - 或 "Create Resources" → "Deploy"

3. **等待部署完成**
   - 部署时间：5-15分钟
   - 可以看到每个组件的构建日志
   - 绿色✅表示成功，红色❌表示失败

4. **查看部署状态**
   - 部署完成后，会显示每个服务的URL
   - 格式：`https://<component-name>-<app-name>.ondigitalocean.app`

---

## ✅ 部署后验证

### 测试所有服务的健康检查

在终端或浏览器中运行以下命令：

```bash
# Entity Relations
curl https://entity-relations-你的app名.ondigitalocean.app/api/health

# Entity Search
curl https://entity-search-你的app名.ondigitalocean.app/api/health

# Dataset Matching
curl https://dataset-matching-你的app名.ondigitalocean.app/api/health

# Data Management
curl https://data-management-你的app名.ondigitalocean.app/api/health

# Dataset Search
curl https://dataset-search-你的app名.ondigitalocean.app/api/health

# User Management
curl https://user-management-你的app名.ondigitalocean.app/api/health
```

**期望响应：**
```json
{
  "status": "operational",
  "service": "服务名称",
  "version": "1.0.0",
  "timestamp": "2025-12-31T12:00:00.000Z"
}
```

### 测试CORS配置

```bash
curl -H "Origin: https://chainreactions.site" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://entity-relations-你的app名.ondigitalocean.app/api/health
```

**检查响应头：**
- `Access-Control-Allow-Origin: https://chainreactions.site`
- `Access-Control-Allow-Credentials: true`

---

## 🌐 配置自定义域名（可选）

### 步骤1：添加自定义域名

1. 在DigitalOcean App中，点击 "Settings" → "Domains"
2. 点击 "Add Domain"
3. 输入域名：`api.chainreactions.site`
4. 点击 "Add Domain"

### 步骤2：配置DNS

DigitalOcean会提供DNS记录，有两种方式：

**方式A：CNAME记录（推荐）**
```
类型: CNAME
名称: api
值: 你的app名.ondigitalocean.app
TTL: 3600（或默认）
```

**方式B：A记录**
```
类型: A
名称: api
值: DigitalOcean提供的IP地址
TTL: 3600（或默认）
```

### 步骤3：更新域名DNS

在你的域名注册商（GoDaddy, Namecheap, Cloudflare等）：
1. 登录到DNS管理
2. 添加上述DNS记录
3. 保存并等待DNS传播（通常5-30分钟）

### 步骤4：启用SSL/TLS

1. 回到DigitalOcean App的Domains设置
2. 等待DNS验证完成（绿色勾✅）
3. 点击 "Provision Certificate"
4. DigitalOcean会自动配置Let's Encrypt SSL证书
5. 等待证书生成完成（1-5分钟）

### 步骤5：配置路由规则

在App Settings → Routing中配置：

```
/api/entity-relations/* → entity-relations组件
/api/entity-search/* → entity-search组件
/api/dataset-matching/* → dataset-matching组件
/api/data-management/* → data-management组件
/api/dataset-search/* → dataset-search组件
/api/user-management/* → user-management组件
```

这样，所有服务都可以通过 `https://api.chainreactions.site` 访问。

---

## 📊 监控和日志

### 查看实时日志

1. 在DigitalOcean App中，点击 "Logs"
2. 选择要查看的服务组件
3. 可以看到实时日志流
4. 支持过滤和搜索

### 下载日志

1. 在Logs页面，点击 "Download"
2. 选择时间范围
3. 下载为日志文件

### 配置告警

1. 点击 "Alerts" → "Create Alert Policy"
2. 配置告警规则：
   - CPU使用率 > 80%持续5分钟
   - 内存使用率 > 85%持续5分钟
   - 健康检查失败3次
3. 选择通知方式：Email, Slack, PagerDuty
4. 保存告警策略

---

## 🔄 更新部署

当你的代码有更新时：

### 方式1：自动部署（推荐）

1. 在App Settings中，开启 "Automatic Deployments"
2. 每次push到GitHub main分支，自动触发部署
3. 适合开发/测试环境

### 方式2：手动部署

1. 推送代码到GitHub
   ```bash
   git add .
   git commit -m "Update services"
   git push origin main
   ```

2. 在DigitalOcean Dashboard
   - 进入你的App
   - 点击 "Deployments"
   - 点击 "Deploy" 按钮
   - 选择要部署的分支（main）
   - 点击 "Deploy Now"

3. 等待部署完成

---

## 🐛 常见问题和故障排除

### 问题1：构建失败

**症状：** 构建日志显示错误，红色❌

**解决方案：**
1. 检查构建日志中的错误信息
2. 常见原因：
   - `package.json`中缺少依赖
   - TypeScript编译错误
   - 构建命令配置错误
3. 修复后重新push代码，触发重新部署

### 问题2：服务启动失败

**症状：** 健康检查失败，日志显示启动错误

**解决方案：**
1. 查看服务日志
2. 检查环境变量是否正确设置
3. 验证数据库连接（Supabase服务是否正常运行）
4. 检查端口配置是否正确

### 问题3：CORS错误

**症状：** 浏览器控制台显示CORS policy错误

**解决方案：**
1. 检查 `ALLOWED_ORIGINS` 环境变量
2. 确保包含你的前端域名
3. 检查协议是否匹配（http vs https）
4. 清除浏览器缓存重试

### 问题4：数据库连接错误

**症状：** 日志显示 "ECONNREFUSED" 或 "connection timeout"

**解决方案：**
1. 验证 `SUPABASE_URL` 是否正确
2. 检查Supabase项目是否被暂停
3. 确认Supabase项目的区域设置
4. 测试从DigitalOcean到Supabase的网络连接

### 问题5：内存不足

**症状：** 服务崩溃，日志显示 "JavaScript heap out of memory"

**解决方案：**
1. 升级容器规格（Basic → Professional）
2. 检查代码是否有内存泄漏
3. 添加内存限制环境变量：
   ```
   NODE_OPTIONS=--max-old-space-size=2048
   ```

---

## 💰 成本估算

### 基础套餐（开发/测试）
- 每个服务：$5/月（0.1 vCPU, 256MB RAM）
- 6个服务：$30/月
- Redis（可选）：$15/月
- **总计：** $45-60/月

### 专业套餐（生产环境推荐）
- 每个服务：$40/月（1 vCPU, 2GB RAM）
- 6个服务：$240/月
- Redis（专业版）：$60/月
- **总计：** $300/月

### 高性能套餐（高流量）
- 每个服务：$200/月（4 vCPU, 8GB RAM）
- 6个服务：$1,200/月
- Redis（专用）：$120/月
- **总计：** $1,320/月

**额外费用：**
- 带宽超额：$0.10/GB
- 存储：$0.25/GB/月
- 负载均衡器：包含在App Platform中

---

## 📞 获取帮助

### DigitalOcean文档
- [App Platform文档](https://docs.digitalocean.com/products/app-platform/)
- [环境变量配置](https://docs.digitalocean.com/products/app-platform/how-to/configure-apps/#environment-variables)
- [自定义域名](https://docs.digitalocean.com/products/app-platform/how-to/configure-domains/)

### Supabase文档
- [项目设置](https://supabase.com/docs/guides/platform/projects)
- [数据库备份](https://supabase.com/docs/guides/platform/backups)
- [行级安全（RLS）](https://supabase.com/docs/guides/auth/row-level-security)

### ChainReactions支持
- 仓库：https://github.com/fallowearthai/chainreactions-backend-railway
- 部署文档：`DIGITALOCEAN_DEPLOYMENT.md`
- 环境变量清单：`ENVIRONMENT_VARIABLES_CHECKLIST.md`

---

## ✅ 最终检查清单

部署完成后，确保：

- [ ] 所有6个服务的健康检查返回200 OK
- [ ] CORS配置正确，前端可以访问
- [ ] 数据库连接正常
- [ ] 所有外部API密钥工作正常
- [ ] 自定义域名配置完成（如使用）
- [ ] SSL证书已启用（绿色锁🔒）
- [ ] 日志可以正常查看
- [ ] 告警策略已配置
- [ ] 备份策略已确认
- [ ] 成本估算已确认

---

**部署成功！** 🎉

你现在可以：
1. 从前端访问所有后端服务
2. 监控服务性能和日志
3. 根据流量调整容器规格
4. 配置CI/CD自动化流程

祝你部署顺利！如有问题，请参考上面的故障排除部分。

---

**最后更新：** 2025-12-31
**文档版本：** 1.0
**作者：** ChainReactions Team
