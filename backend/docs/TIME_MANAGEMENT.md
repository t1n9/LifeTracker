# 时间管理统一规范

## 概述

本项目采用统一的时间管理策略，确保在不同层级（数据库、API、前端）之间的时间处理一致性。

## 核心原则

1. **数据库存储**: 使用 `TIMESTAMPTZ` 类型，统一存储UTC时间
2. **API传输**: 使用ISO8601格式，统一传输UTC时间
3. **前端显示**: 根据用户时区进行本地化显示
4. **日期字段**: 使用 `YYYY-MM-DD` 格式，表示日期概念

## 数据库层

### 字段类型
```sql
-- 时间戳字段（带时区）
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW(),

-- 日期字段（仅日期，无时区概念）
date DATE NOT NULL
```

### 存储规则
- 所有时间戳字段使用 `TIMESTAMPTZ` 类型
- 数据库自动处理时区转换
- 内部统一存储为UTC时间

## API层

### 请求格式
```typescript
// 时间戳字段
{
  "startTime": "2024-03-20T08:00:00Z",        // 带Z的ISO8601（推荐）
  "endTime": "2024-03-20T16:00:00+08:00",     // 带时区偏移
  "createdAt": 1679875200000                  // Unix时间戳（毫秒）
}

// 日期字段
{
  "date": "2024-03-20"                        // YYYY-MM-DD格式
}
```

### 响应格式
```typescript
// 统一返回UTC时间的ISO8601格式
{
  "id": 123,
  "eventName": "会议",
  "startTime": "2024-03-20T00:00:00.000Z",    // UTC时间
  "endTime": "2024-03-20T08:00:00.000Z",      // UTC时间
  "date": "2024-03-20",                       // 日期字符串
  "createdAt": "2024-03-20T12:00:00.000Z",    // UTC时间
  "updatedAt": "2024-03-20T12:00:00.000Z"     // UTC时间
}
```

### 工具函数

#### 日期处理
```typescript
import { getTodayStart, parseDateString, formatDateString } from '@/common/utils/date.util';

// 获取今日开始时间（用于查询）
const todayStart = getTodayStart(); // 返回UTC时间

// 解析日期字符串
const date = parseDateString('2024-03-20'); // 返回UTC时间

// 格式化日期
const dateStr = formatDateString(new Date()); // 返回YYYY-MM-DD
```

#### 时间戳处理
```typescript
import { getCurrentBeijingTime } from '@/common/utils/date.util';

// 获取当前时间（用于createdAt/updatedAt）
const now = getCurrentBeijingTime(); // 返回当前UTC时间
```

## 前端层

### 显示时间
```typescript
// 使用Intl.DateTimeFormat进行本地化显示
const formatDateTime = (utcTimeString: string) => {
  const date = new Date(utcTimeString);
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
};

// 示例
formatDateTime('2024-03-20T08:00:00.000Z'); // "2024/03/20 16:00:00"
```

### 提交时间
```typescript
// 将本地时间转换为UTC时间提交
const submitDateTime = (localDateTime: Date) => {
  return localDateTime.toISOString(); // 自动转换为UTC
};

// 日期字段直接使用YYYY-MM-DD格式
const submitDate = (date: Date) => {
  return date.toISOString().split('T')[0]; // "2024-03-20"
};
```

## 实际应用示例

### 消费记录API

#### 创建记录
```typescript
// 请求
POST /api/expense/meals
{
  "date": "2024-03-20",           // 日期字符串
  "breakfast": 15.5,
  "lunch": 25.0,
  "dinner": 18.0
}

// 响应
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "date": "2024-03-20",                    // 日期字符串
      "type": "MEAL",
      "category": "breakfast",
      "amount": 15.5,
      "time": "08:00",
      "createdAt": "2024-03-20T12:00:00.000Z", // UTC时间
      "updatedAt": "2024-03-20T12:00:00.000Z"  // UTC时间
    }
  ]
}
```

#### 查询今日记录
```typescript
// 请求
GET /api/expense/today

// 后端处理
const todayStart = getTodayStart(); // 获取今日开始UTC时间
const records = await prisma.expenseRecord.findMany({
  where: {
    userId,
    date: todayStart // 直接使用UTC时间查询
  }
});
```

### 运动记录API

#### 创建记录
```typescript
// 请求
POST /api/exercise/records
{
  "exerciseId": "uuid",
  "date": "2024-03-20",           // 日期字符串
  "value": 5.0,
  "unit": "km"
}

// 响应
{
  "success": true,
  "data": {
    "id": "uuid",
    "exerciseId": "uuid",
    "date": "2024-03-20",                    // 日期字符串
    "value": 5.0,
    "unit": "km",
    "createdAt": "2024-03-20T12:00:00.000Z", // UTC时间
    "updatedAt": "2024-03-20T12:00:00.000Z"  // UTC时间
  }
}
```

## 迁移和测试

### 数据迁移
- 现有数据已使用新的日期处理函数重新迁移
- 确保所有日期字段正确存储为UTC时间

### 测试验证
- 单元测试覆盖所有日期工具函数
- 集成测试验证API的时间处理
- 前端测试验证时区显示

## 注意事项

1. **避免混用时区**: 统一使用UTC时间进行存储和传输
2. **前端本地化**: 仅在前端显示时进行时区转换
3. **日期vs时间戳**: 区分日期概念（date字段）和时间戳概念（timestamp字段）
4. **测试覆盖**: 确保在不同时区环境下测试功能正确性

## 工具函数参考

详见 `src/common/utils/date.util.ts` 文件中的完整实现。
