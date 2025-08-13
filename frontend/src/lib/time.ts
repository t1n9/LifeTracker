/**
 * 前端统一时间处理工具
 * 支持本地化显示和UTC提交
 */

/**
 * 时间输入类型
 */
export type TimeInput = string | number | Date;

/**
 * 时间格式化选项
 */
export interface TimeFormatOptions {
  timezone?: string;
  locale?: string;
  includeSeconds?: boolean;
  includeDate?: boolean;
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
  timeStyle?: 'full' | 'long' | 'medium' | 'short';
}

/**
 * API时间响应格式
 */
export interface ApiTimeResponse {
  timestamp: string;
  timezone?: string;
  unixMs?: number;
  date?: string;
}

/**
 * 默认时区和语言设置
 */
const DEFAULT_TIMEZONE = 'Asia/Shanghai';
const DEFAULT_LOCALE = 'zh-CN';

/**
 * 解析时间输入为Date对象
 */
export function parseTimeInput(input: TimeInput): Date {
  if (input instanceof Date) {
    return new Date(input.getTime());
  }
  
  if (typeof input === 'number') {
    return new Date(input);
  }
  
  if (typeof input === 'string') {
    return new Date(input);
  }
  
  throw new Error(`Invalid time input: ${input}`);
}

/**
 * 验证时间输入格式
 */
export function validateTimeInput(input: any): boolean {
  try {
    const date = parseTimeInput(input);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}

/**
 * 获取当前UTC时间
 */
export function getCurrentUTC(): Date {
  return new Date();
}

/**
 * 将UTC时间转换为本地时间显示
 */
export function formatLocalTime(
  utcTime: TimeInput,
  options: TimeFormatOptions = {}
): string {
  const date = parseTimeInput(utcTime);
  const {
    timezone = DEFAULT_TIMEZONE,
    locale = DEFAULT_LOCALE,
    includeSeconds = false,
    includeDate = true,
    dateStyle = 'medium',
    timeStyle = 'medium'
  } = options;
  
  // 如果只需要时间，不需要日期
  if (!includeDate) {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds && { second: '2-digit' }),
    }).format(date);
  }
  
  // 完整的日期时间格式
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle,
    timeStyle,
  }).format(date);
}

/**
 * 格式化为日期字符串 (YYYY-MM-DD)
 */
export function formatDateString(date: TimeInput, timezone: string = DEFAULT_TIMEZONE): string {
  const d = parseTimeInput(date);
  
  // 转换到指定时区
  const localDate = new Date(d.toLocaleString('en-US', { timeZone: timezone }));
  
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * 格式化为时间字符串 (HH:mm 或 HH:mm:ss)
 */
export function formatTimeString(
  date: TimeInput,
  includeSeconds: boolean = false,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const d = parseTimeInput(date);
  
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds && { second: '2-digit' }),
    hour12: false,
  }).format(d);
}

/**
 * 将本地时间转换为UTC时间（用于API提交）
 */
export function toUTCForSubmit(localTime: Date | string): string {
  if (typeof localTime === 'string') {
    // 如果是日期字符串 (YYYY-MM-DD)，转换为当天的开始时间
    if (/^\d{4}-\d{2}-\d{2}$/.test(localTime)) {
      const [year, month, day] = localTime.split('-').map(Number);
      const date = new Date(year, month - 1, day, 0, 0, 0, 0);
      return date.toISOString();
    }
    
    // 其他字符串格式直接解析
    return new Date(localTime).toISOString();
  }
  
  return localTime.toISOString();
}

/**
 * 解析日期字符串为本地Date对象
 */
export function parseDateString(dateStr: string, timezone: string = DEFAULT_TIMEZONE): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * 获取相对时间描述
 */
export function getRelativeTime(
  time: TimeInput,
  locale: string = DEFAULT_LOCALE
): string {
  const date = parseTimeInput(time);
  const now = new Date();
  
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  
  const diffMs = date.getTime() - now.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);
  
  if (Math.abs(diffSeconds) < 60) {
    return rtf.format(diffSeconds, 'second');
  } else if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute');
  } else if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  } else {
    return rtf.format(diffDays, 'day');
  }
}

/**
 * 格式化持续时间（分钟转换为可读格式）
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分钟`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours}小时`;
  }
  
  return `${hours}小时${remainingMinutes}分钟`;
}

/**
 * 获取今天的日期字符串
 */
export function getTodayDateString(timezone: string = DEFAULT_TIMEZONE): string {
  return formatDateString(new Date(), timezone);
}

/**
 * 检查是否为今天
 */
export function isToday(date: TimeInput, timezone: string = DEFAULT_TIMEZONE): boolean {
  const dateStr = formatDateString(date, timezone);
  const todayStr = getTodayDateString(timezone);
  return dateStr === todayStr;
}

/**
 * 检查是否为昨天
 */
export function isYesterday(date: TimeInput, timezone: string = DEFAULT_TIMEZONE): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = formatDateString(date, timezone);
  const yesterdayStr = formatDateString(yesterday, timezone);
  return dateStr === yesterdayStr;
}

/**
 * 智能时间显示（今天显示时间，其他显示日期）
 */
export function smartTimeDisplay(
  time: TimeInput,
  timezone: string = DEFAULT_TIMEZONE,
  locale: string = DEFAULT_LOCALE
): string {
  if (isToday(time, timezone)) {
    return formatLocalTime(time, { 
      timezone, 
      locale, 
      includeDate: false 
    });
  } else if (isYesterday(time, timezone)) {
    return '昨天 ' + formatLocalTime(time, { 
      timezone, 
      locale, 
      includeDate: false 
    });
  } else {
    return formatLocalTime(time, { 
      timezone, 
      locale, 
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }
}

/**
 * 处理API响应中的时间字段
 */
export function processApiTimeFields<T>(
  data: T,
  timeFields: string[] = ['createdAt', 'updatedAt', 'startedAt', 'completedAt']
): T {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => processApiTimeFields(item, timeFields)) as T;
  }
  
  const result = { ...data } as any;
  
  for (const field of timeFields) {
    if (result[field]) {
      // 确保时间字段是有效的Date对象
      try {
        result[field] = parseTimeInput(result[field]);
      } catch (error) {
        console.warn(`Failed to process time field ${field}:`, error);
      }
    }
  }
  
  return result;
}
