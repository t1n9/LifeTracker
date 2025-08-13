/**
 * 全局时间格式化拦截器
 * 统一处理API响应中的时间字段格式
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { formatApiResponse, ApiTimeConfig, TIME_FIELD_CONFIGS } from '../utils/api-time.util';

@Injectable()
export class TimeFormatInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // 获取请求信息
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        
        // 获取用户时区（如果有的话）
        const timezone = user?.timezone || 'Asia/Shanghai';
        
        // 时间格式化配置
        const config: ApiTimeConfig = {
          timezone,
          includeUnixMs: false, // 默认不包含Unix时间戳
          includeDateString: false, // 默认不包含日期字符串
        };
        
        // 根据路径确定时间字段配置
        const path = request.route?.path || request.url;
        const timeFields = this.getTimeFieldsForPath(path);
        
        // 格式化响应数据
        return this.formatResponse(data, timeFields, config);
      }),
    );
  }
  
  /**
   * 根据API路径确定需要格式化的时间字段
   */
  private getTimeFieldsForPath(path: string): string[] {
    if (path.includes('/tasks')) {
      return TIME_FIELD_CONFIGS.TASK;
    }
    
    if (path.includes('/study')) {
      return TIME_FIELD_CONFIGS.STUDY;
    }
    
    if (path.includes('/pomodoro')) {
      return TIME_FIELD_CONFIGS.POMODORO;
    }
    
    if (path.includes('/users') || path.includes('/auth')) {
      return TIME_FIELD_CONFIGS.USER;
    }
    
    if (path.includes('/countdown')) {
      return TIME_FIELD_CONFIGS.COUNTDOWN;
    }
    
    if (path.includes('/exercise')) {
      return TIME_FIELD_CONFIGS.EXERCISE;
    }
    
    if (path.includes('/expense')) {
      return TIME_FIELD_CONFIGS.EXPENSE;
    }
    
    if (path.includes('/health')) {
      return TIME_FIELD_CONFIGS.HEALTH;
    }
    
    // 默认使用基础时间字段
    return TIME_FIELD_CONFIGS.BASIC;
  }
  
  /**
   * 格式化响应数据
   */
  private formatResponse(data: any, timeFields: string[], config: ApiTimeConfig): any {
    if (!data) {
      return data;
    }
    
    // 如果响应已经是标准格式（包含success字段），格式化data部分
    if (data && typeof data === 'object' && 'success' in data) {
      return {
        ...data,
        data: formatApiResponse(data.data, timeFields, config),
        timestamp: new Date().toISOString(), // 确保响应时间戳是UTC格式
      };
    }
    
    // 如果响应包含data字段，格式化data部分
    if (data && typeof data === 'object' && 'data' in data) {
      return {
        ...data,
        data: formatApiResponse(data.data, timeFields, config),
      };
    }
    
    // 直接格式化整个响应
    return formatApiResponse(data, timeFields, config);
  }
}

/**
 * 时间字段验证拦截器
 * 验证请求中的时间字段格式
 */
@Injectable()
export class TimeValidationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const body = request.body;
    
    if (body && typeof body === 'object') {
      this.validateTimeFields(body);
    }
    
    return next.handle();
  }
  
  /**
   * 验证时间字段格式
   */
  private validateTimeFields(data: any): void {
    const timeFields = [
      'startedAt', 'completedAt', 'targetDate', 'examDate', 'dueDate',
      'pausedAt', 'resumedAt', 'createdAt', 'updatedAt'
    ];
    
    for (const field of timeFields) {
      if (data[field]) {
        if (!this.isValidTimeFormat(data[field])) {
          throw new Error(`Invalid time format for field ${field}: ${data[field]}`);
        }
      }
    }
    
    // 递归验证嵌套对象
    for (const key in data) {
      if (data[key] && typeof data[key] === 'object' && !timeFields.includes(key)) {
        if (Array.isArray(data[key])) {
          data[key].forEach((item: any) => {
            if (typeof item === 'object') {
              this.validateTimeFields(item);
            }
          });
        } else {
          this.validateTimeFields(data[key]);
        }
      }
    }
  }
  
  /**
   * 验证时间格式
   */
  private isValidTimeFormat(value: any): boolean {
    if (value instanceof Date) {
      return !isNaN(value.getTime());
    }
    
    if (typeof value === 'number') {
      return !isNaN(value) && value > 0;
    }
    
    if (typeof value === 'string') {
      // 验证ISO8601格式
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
      if (isoRegex.test(value)) {
        return !isNaN(new Date(value).getTime());
      }
      
      // 验证日期格式 YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(value)) {
        return !isNaN(new Date(value).getTime());
      }
    }
    
    return false;
  }
}
