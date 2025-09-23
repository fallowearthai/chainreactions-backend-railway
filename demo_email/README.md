# Demo Request Email Service

ChainReactions 独立的 Demo 请求邮件服务，用于处理用户的 Demo 申请并发送邮件通知。

## 功能特性

- ✅ 接收前端 Demo 请求表单数据
- ✅ 发送格式化的 HTML 邮件到管理员邮箱
- ✅ 完整的表单验证和错误处理
- ✅ 与 N8N 工作流兼容的 API 响应格式
- ✅ 独立运行，不依赖其他服务
- ✅ TypeScript 支持

## 快速开始

### 1. 安装依赖

```bash
cd demo_email
npm install
```

### 2. 配置环境变量

复制环境变量模板：
```bash
cp .env.example .env
```

编辑 `.env` 文件：
```env
PORT=3001
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-app-password
```

### 3. Gmail 配置

1. 在你的 Gmail 账户中启用 2FA（两步验证）
2. 访问 [Google App Passwords](https://myaccount.google.com/apppasswords)
3. 生成一个应用专用密码
4. 将生成的密码设置为 `GMAIL_APP_PASSWORD`

### 4. 启动服务

开发模式：
```bash
npm run dev
```

生产模式：
```bash
npm run build
npm start
```

## API 端点

### POST /api/demo-request

发送 Demo 请求邮件

**请求体:**
```json
{
  "firstName": "张",
  "lastName": "三",
  "email": "zhangsan@example.com",
  "institution": "示例公司",
  "jobTitle": "产品经理",
  "timestamp": "2024-09-23T08:30:00.000Z",
  "source": "ChainReactions Website"
}
```

**响应:**
```json
{
  "success": true,
  "messageId": "<message-id>",
  "response": "250 OK",
  "labelIds": ["SENT"]
}
```

### GET /api/test-email

测试邮件服务连接

**响应:**
```json
{
  "success": true,
  "message": "Email service is working correctly",
  "timestamp": "2024-09-23T08:30:00.000Z"
}
```

### GET /api/health

健康检查端点

**响应:**
```json
{
  "status": "healthy",
  "timestamp": "2024-09-23T08:30:00.000Z",
  "service": "Demo Request Email Service",
  "version": "1.0.0"
}
```

## 项目结构

```
demo_email/
├── src/
│   ├── controllers/
│   │   └── DemoRequestController.ts  # Demo 请求控制器
│   ├── services/
│   │   └── EmailService.ts          # 邮件发送服务
│   ├── templates/
│   │   └── demoRequestTemplate.ts   # HTML 邮件模板
│   ├── types/
│   │   └── types.ts                 # TypeScript 类型定义
│   └── app.ts                       # 主应用文件
├── dist/                            # 编译输出目录
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 开发

### 可用命令

```bash
npm run dev       # 开发模式运行
npm run build     # 编译 TypeScript
npm start         # 生产模式运行
npm run lint      # 代码检查
npm run type-check # 类型检查
```

### 与前端集成

前端需要将 API 端点从 N8N 切换到本服务：

```typescript
// 从
const response = await fetch("https://n8n.fallowearth.site/webhook/demo-request", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data)
});

// 改为
const response = await fetch("http://localhost:3001/api/demo-request", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data)
});
```

## 安全性

- ✅ 输入验证和清理
- ✅ CORS 配置
- ✅ 错误处理不泄露敏感信息
- ✅ 环境变量管理 Gmail 凭据

## 监控

服务启动时会检查必要的环境变量，并在缺少时显示警告。所有请求都有详细的日志记录。

## 故障排除

### 常见问题

1. **邮件发送失败**
   - 检查 Gmail App Password 是否正确
   - 确认 2FA 已启用
   - 验证环境变量设置

2. **端口冲突**
   - 修改 `.env` 中的 `PORT` 设置
   - 确保端口未被其他服务占用

3. **权限错误**
   - 检查 Gmail 账户权限
   - 验证 App Password 有效性