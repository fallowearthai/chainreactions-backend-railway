import { DemoRequestData } from '../types/DemoRequestTypes';

export function getDemoRequestEmailTemplate(data: DemoRequestData): string {
  // Format timestamp for display
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return timestamp;
    }
  };

  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 15px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .field { margin-bottom: 10px; }
        .label { font-weight: bold; color: #555; }
        .value { margin-left: 10px; }
        .empty { color: #999; font-style: italic; }
        .footer { background-color: #333; color: white; padding: 10px; text-align: center; border-radius: 0 0 5px 5px; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🎯 新的 Demo 请求通知</h2>
        </div>

        <div class="content">
            <p>您好！我们收到了一个新的 Demo 请求，详细信息如下：</p>

            <div class="field">
                <span class="label">👤 姓名:</span>
                <span class="value">${data.firstName} ${data.lastName}</span>
            </div>

            <div class="field">
                <span class="label">📧 邮箱:</span>
                <span class="value">${data.email}</span>
            </div>

            <div class="field">
                <span class="label">🏢 机构:</span>
                <span class="value">${data.institution || '<span class="empty">未提供</span>'}</span>
            </div>

            <div class="field">
                <span class="label">💼 职位:</span>
                <span class="value">${data.jobTitle || '<span class="empty">未提供</span>'}</span>
            </div>

            <div class="field">
                <span class="label">🌐 来源:</span>
                <span class="value">${data.source}</span>
            </div>

            <div class="field">
                <span class="label">⏰ 提交时间:</span>
                <span class="value">${formatTimestamp(data.timestamp)}</span>
            </div>
        </div>

        <div class="footer">
            <p>请及时跟进此 Demo 请求 | 由 Node.js 后端自动发送</p>
        </div>
    </div>
</body>
</html>`;
}