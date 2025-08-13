/**
 * API时间格式化工具
 * 统一处理API请求和响应中的时间格式
 */

import { formatApiTime, parseTimeInput, validateTimeInput, TimeInput } from './date.util';

/**
 * API时间字段配置
 */
export interface ApiTimeConfig {
  timezone?: string;
  includeUnixMs?: boolean;
  includeDateString?: boolean;
}

/**
 * 格式化单个时间字段
 */
export function formatTimeField(
  value: any,
  config: ApiTimeConfig = {}
): string | { timestamp: string; timezone?: string; unixMs?: number; date?: string } {
  if (!value) return value;

  if (!validateTimeInput(value)) {
    throw new Error(`Invalid time format: ${value}`);
  }

  const date = parseTimeInput(value);

  // 默认返回ISO8601字符串格式
  return date.toISOString();
}

/**
 * 递归格式化对象中的时间字段
 */
export function formatApiResponse(
  data: any,
  timeFields: string[] = ['createdAt', 'updatedAt', 'startedAt', 'completedAt', 'targetDate', 'examDate', 'dueDate'],
  config: ApiTimeConfig = {}
): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => formatApiResponse(item, timeFields, config));
  }
  
  const result = { ...data };
  
  for (const field of timeFields) {
    if (result[field]) {
      try {
        result[field] = formatTimeField(result[field], config);
      } catch (error) {
        console.warn(`Failed to format time field ${field}:`, error);
        // 保持原值
      }
    }
  }
  
  // 递归处理嵌套对象
  for (const key in result) {
    if (result[key] && typeof result[key] === 'object' && !timeFields.includes(key)) {
      result[key] = formatApiResponse(result[key], timeFields, config);
    }
  }
  
  return result;
}

/**
 * 解析API请求中的时间字段
 */
export function parseApiRequest(
  data: any,
  timeFields: string[] = ['startedAt', 'completedAt', 'targetDate', 'examDate', 'dueDate']
): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => parseApiRequest(item, timeFields));
  }
  
  const result = { ...data };
  
  for (const field of timeFields) {
    if (result[field]) {
      try {
        const parsed = parseTimeInput(result[field]);
        result[field] = parsed;
      } catch (error) {
        throw new Error(`Invalid time format for field ${field}: ${result[field]}`);
      }
    }
  }
  
  // 递归处理嵌套对象
  for (const key in result) {
    if (result[key] && typeof result[key] === 'object' && !timeFields.includes(key)) {
      result[key] = parseApiRequest(result[key], timeFields);
    }
  }
  
  return result;
}

/**
 * 创建标准化的API响应
 */
export function createApiResponse<T>(
  data: T,
  success: boolean = true,
  message?: string,
  config: ApiTimeConfig = {}
): {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
} {
  return {
    success,
    data: formatApiResponse(data, undefined, config),
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 时间字段验证装饰器（用于DTO）
 */
export function validateTimeFields(timeFields: string[]) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      // 验证请求中的时间字段
      if (args[0] && typeof args[0] === 'object') {
        for (const field of timeFields) {
          if (args[0][field] && !validateTimeInput(args[0][field])) {
            throw new Error(`Invalid time format for field ${field}: ${args[0][field]}`);
          }
        }
      }
      
      return method.apply(this, args);
    };
  };
}

/**
 * 常用时间字段配置
 */
export const TIME_FIELD_CONFIGS = {
  // 基础时间字段
  BASIC: ['createdAt', 'updatedAt'],
  
  // 任务相关时间字段
  TASK: ['createdAt', 'updatedAt', 'dueDate', 'startedAt', 'completedAt'],
  
  // 用户相关时间字段
  USER: ['createdAt', 'updatedAt', 'targetDate', 'examDate'],
  
  // 番茄钟相关时间字段
  POMODORO: ['createdAt', 'startedAt', 'completedAt', 'pausedAt', 'resumedAt'],
  
  // 学习记录相关时间字段
  STUDY: ['createdAt', 'startedAt', 'completedAt'],
  
  // 倒计时相关时间字段
  COUNTDOWN: ['createdAt', 'updatedAt', 'targetDate'],
  
  // 运动记录相关时间字段
  EXERCISE: ['createdAt', 'updatedAt'],
  
  // 消费记录相关时间字段
  EXPENSE: ['createdAt', 'updatedAt'],
  
  // 健康记录相关时间字段
  HEALTH: ['createdAt', 'updatedAt'],
};
