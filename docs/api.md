# 📡 API 文档

LifeTracker 提供完整的 RESTful API，支持所有核心功能。

## 🔗 基础信息

- **基础URL**: `http://localhost:3002/api` (开发环境)
- **API版本**: v1
- **认证方式**: JWT Bearer Token
- **数据格式**: JSON
- **在线文档**: http://localhost:3002/api/docs (Swagger)

## 🔐 认证

### 获取访问令牌

所有需要认证的接口都需要在请求头中包含 JWT 令牌：

```http
Authorization: Bearer <your-jwt-token>
```

### 登录获取令牌

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "用户名"
  }
}
```

## 👤 用户管理

### 用户注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "用户名"
}
```

### 获取用户信息
```http
GET /api/users/profile
Authorization: Bearer <token>
```

### 更新用户信息
```http
PUT /api/users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "新用户名",
  "email": "new@example.com"
}
```

## 📚 任务管理

### 获取任务列表
```http
GET /api/tasks
Authorization: Bearer <token>

# 查询参数
?page=1&limit=10&status=pending&priority=high
```

### 创建任务
```http
POST /api/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "学习数学",
  "description": "复习高等数学第一章",
  "priority": 2,
  "isCompleted": false,
  "sortOrder": 0
}
```

### 更新任务
```http
PUT /api/tasks/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "更新后的任务标题",
  "isCompleted": true
}
```

### 批量更新任务排序
```http
PUT /api/tasks/order
Authorization: Bearer <token>
Content-Type: application/json

[
  { "id": "task-1", "sortOrder": 0 },
  { "id": "task-2", "sortOrder": 1 },
  { "id": "task-3", "sortOrder": 2 }
]
```

### 删除任务
```http
DELETE /api/tasks/:id
Authorization: Bearer <token>
```

## 🍅 番茄钟管理

### 获取番茄钟会话
```http
GET /api/pomodoro/sessions
Authorization: Bearer <token>

# 查询参数
?taskId=uuid&status=COMPLETED&date=2024-01-01
```

### 创建番茄钟会话
```http
POST /api/pomodoro/sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "taskId": "task-uuid",
  "duration": 1500,
  "type": "FOCUS"
}
```

### 更新番茄钟状态
```http
PUT /api/pomodoro/sessions/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "COMPLETED",
  "actualDuration": 1500
}
```

## 📊 学习记录

### 获取学习记录
```http
GET /api/study-records
Authorization: Bearer <token>

# 查询参数
?startDate=2024-01-01&endDate=2024-01-31&subject=数学
```

### 创建学习记录
```http
POST /api/study-records
Authorization: Bearer <token>
Content-Type: application/json

{
  "subject": "数学",
  "duration": 3600,
  "content": "学习内容描述",
  "taskId": "task-uuid"
}
```

## 🏃 运动记录

### 获取运动记录
```http
GET /api/exercise-records
Authorization: Bearer <token>

# 查询参数
?type=running&startDate=2024-01-01
```

### 创建运动记录
```http
POST /api/exercise-records
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "running",
  "duration": 1800,
  "distance": 5.0,
  "calories": 300,
  "notes": "晨跑"
}
```

## 📈 数据统计

### 获取学习统计
```http
GET /api/statistics/study
Authorization: Bearer <token>

# 查询参数
?period=week&startDate=2024-01-01&endDate=2024-01-07
```

**响应示例**:
```json
{
  "totalDuration": 7200,
  "dailyStats": [
    {
      "date": "2024-01-01",
      "duration": 3600,
      "subjects": {
        "数学": 1800,
        "英语": 1800
      }
    }
  ],
  "subjectDistribution": {
    "数学": 3600,
    "英语": 2400,
    "专业课": 1200
  }
}
```

### 获取番茄钟统计
```http
GET /api/statistics/pomodoro
Authorization: Bearer <token>

# 查询参数
?period=month&year=2024&month=1
```

## 🔍 搜索功能

### 全局搜索
```http
GET /api/search
Authorization: Bearer <token>

# 查询参数
?q=数学&type=tasks,records&limit=20
```

## 📤 数据导出

### 导出学习数据
```http
GET /api/export/study-data
Authorization: Bearer <token>

# 查询参数
?format=csv&startDate=2024-01-01&endDate=2024-01-31
```

### 导出任务数据
```http
GET /api/export/tasks
Authorization: Bearer <token>

# 查询参数
?format=json&includeCompleted=true
```

## ❤️ 健康检查

### 服务健康状态
```http
GET /api/health
```

**响应**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "version": "2.1.1"
}
```

## 📋 响应格式

### 成功响应
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数无效",
    "details": [
      {
        "field": "email",
        "message": "邮箱格式不正确"
      }
    ]
  }
}
```

### 分页响应
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

## 🚨 错误代码

| 状态码 | 错误代码 | 说明 |
|--------|----------|------|
| 400 | VALIDATION_ERROR | 请求参数验证失败 |
| 401 | UNAUTHORIZED | 未授权或令牌无效 |
| 403 | FORBIDDEN | 权限不足 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CONFLICT | 资源冲突 |
| 429 | RATE_LIMIT | 请求频率限制 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

## 🔧 开发工具

### Postman 集合
下载 [Postman 集合文件](../postman/LifeTracker.postman_collection.json) 快速测试 API。

### cURL 示例
```bash
# 登录获取令牌
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'

# 获取任务列表
curl -X GET http://localhost:3002/api/tasks \
  -H "Authorization: Bearer <your-token>"
```

## 📚 更多资源

- [Swagger 在线文档](http://localhost:3002/api/docs)
- [GraphQL Playground](http://localhost:3002/graphql) (如果启用)
- [API 变更日志](./api-changelog.md)

---

**需要帮助？** 查看 [故障排除指南](./troubleshooting.md) 或提交 [Issue](https://github.com/your-username/LifeTracker/issues)。
