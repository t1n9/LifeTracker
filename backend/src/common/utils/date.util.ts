/**
 * 统一时间管理工具函数
 * 支持用户时区，统一API时间格式为ISO8601 UTC
 */

// 时区偏移量映射（分钟，相对于UTC的偏移）
const TIMEZONE_OFFSETS: Record<string, number> = {
  'Asia/Shanghai': 480,       // UTC+8 (东八区，比UTC快8小时)
  'Asia/Tokyo': 540,          // UTC+9 (东九区，比UTC快9小时)
  'America/New_York': -300,   // UTC-5 (EST) / UTC-4 (EDT)
  'America/Los_Angeles': -480, // UTC-8 (PST) / UTC-7 (PDT)
  'Europe/London': 0,         // UTC+0 (GMT) / UTC+1 (BST)
  'UTC': 0,
};

/**
 * 时间输入类型
 */
export type TimeInput = string | number | Date;

/**
 * API时间响应格式
 */
export interface ApiTimeResponse {
  timestamp: string;      // ISO8601 UTC格式
  timezone?: string;      // 可选时区信息
  unixMs?: number;       // Unix时间戳（毫秒）
}

/**
 * 解析时间输入为UTC Date对象
 * 支持多种格式：ISO8601字符串、Unix时间戳（毫秒）、Date对象
 */
export function parseTimeInput(input: TimeInput): Date {
  if (input instanceof Date) {
    return new Date(input.getTime());
  }

  if (typeof input === 'number') {
    // Unix时间戳（毫秒）
    return new Date(input);
  }

  if (typeof input === 'string') {
    // ISO8601字符串
    return new Date(input);
  }

  throw new Error(`Invalid time input: ${input}`);
}

/**
 * 格式化时间为API响应格式
 */
export function formatApiTime(date: Date, timezone?: string): ApiTimeResponse {
  return {
    timestamp: date.toISOString(),
    timezone,
    unixMs: date.getTime(),
  };
}

/**
 * 获取当前UTC时间
 */
export function getCurrentUTC(): Date {
  return new Date();
}

/**
 * 获取用户时区的今日开始时间（UTC表示）
 */
export function getTodayStart(timezone: string = 'Asia/Shanghai'): Date {
  const now = new Date();
  const offset = TIMEZONE_OFFSETS[timezone] || TIMEZONE_OFFSETS['Asia/Shanghai'];

  // 转换到用户时区（加上偏移量）
  const userTime = new Date(now.getTime() + (offset * 60000));

  // 获取该时区的今日开始（00:00:00），然后转换回UTC
  const todayStartInUserTz = new Date(Date.UTC(
    userTime.getUTCFullYear(),
    userTime.getUTCMonth(),
    userTime.getUTCDate(),
    0, 0, 0, 0
  ));

  // 转换回UTC时间
  return new Date(todayStartInUserTz.getTime() - (offset * 60000));
}

/**
 * 获取用户时区的今日结束时间（UTC表示）
 */
export function getTodayEnd(timezone: string = 'Asia/Shanghai'): Date {
  const now = new Date();
  const offset = TIMEZONE_OFFSETS[timezone] || TIMEZONE_OFFSETS['Asia/Shanghai'];

  // 转换到用户时区（加上偏移量）
  const userTime = new Date(now.getTime() + (offset * 60000));

  // 获取该时区的今日结束（23:59:59.999），然后转换回UTC
  const todayEndInUserTz = new Date(Date.UTC(
    userTime.getUTCFullYear(),
    userTime.getUTCMonth(),
    userTime.getUTCDate(),
    23, 59, 59, 999
  ));

  // 转换回UTC时间
  return new Date(todayEndInUserTz.getTime() - (offset * 60000));
}

/**
 * 获取指定天数前的开始时间（用户时区）
 */
export function getDaysAgoStart(days: number, timezone: string = 'Asia/Shanghai'): Date {
  const now = new Date();
  const offset = TIMEZONE_OFFSETS[timezone] || TIMEZONE_OFFSETS['Asia/Shanghai'];

  // 转换到用户时区
  const userTime = new Date(now.getTime() - (offset * 60000));

  // 计算目标日期
  const targetDate = new Date(userTime);
  targetDate.setUTCDate(userTime.getUTCDate() - days + 1);

  // 获取该日期的开始时间
  return new Date(Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate(),
    0, 0, 0, 0
  ));
}

/**
 * 将UTC时间转换为用户时区时间（仅用于显示）
 */
export function toUserTimezone(utcDate: Date, timezone: string = 'Asia/Shanghai'): Date {
  const offset = TIMEZONE_OFFSETS[timezone] || TIMEZONE_OFFSETS['Asia/Shanghai'];
  return new Date(utcDate.getTime() + (offset * 60000));
}

/**
 * 将用户时区时间转换为UTC时间（用于存储）
 */
export function toUTC(userDate: Date, timezone: string = 'Asia/Shanghai'): Date {
  const offset = TIMEZONE_OFFSETS[timezone] || TIMEZONE_OFFSETS['Asia/Shanghai'];
  return new Date(userDate.getTime() - (offset * 60000));
}

/**
 * 获取当前用户时区的时间字符串 (HH:mm)
 */
export function getCurrentTimeString(timezone: string = 'Asia/Shanghai'): string {
  const now = new Date();
  const userTime = toUserTimezone(now, timezone);

  return userTime.toISOString().slice(11, 16); // HH:mm
}

/**
 * 解析日期字符串为UTC日期（用于date字段）
 * @param dateStr 日期字符串，格式：YYYY-MM-DD
 * @returns UTC日期对象，时间为00:00:00
 */
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * 将日期对象转换为日期字符串（基于用户时区）
 * @param date 日期对象（UTC时间）
 * @param timezone 用户时区
 * @returns 日期字符串，格式：YYYY-MM-DD
 */
export function formatDateString(date: Date, timezone: string = 'Asia/Shanghai'): string {
  // 转换到用户时区
  const userTime = toUserTimezone(date, timezone);

  // 格式化为 YYYY-MM-DD
  const year = userTime.getUTCFullYear();
  const month = String(userTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(userTime.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * 获取指定日期在用户时区的开始时间
 * @param dateStr 日期字符串，格式：YYYY-MM-DD
 * @param timezone 用户时区
 * @returns UTC日期对象，表示该日期在用户时区的开始
 */
export function getDateStart(dateStr: string, timezone: string = 'Asia/Shanghai'): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const offset = TIMEZONE_OFFSETS[timezone] || TIMEZONE_OFFSETS['Asia/Shanghai'];

  // 创建该日期在用户时区的开始时间，然后转换为UTC
  const dateStartInUserTz = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return new Date(dateStartInUserTz.getTime() - (offset * 60000));
}

/**
 * 获取指定日期在用户时区的结束时间
 * @param dateStr 日期字符串，格式：YYYY-MM-DD
 * @param timezone 用户时区
 * @returns UTC日期对象，表示该日期在用户时区的结束
 */
export function getDateEnd(dateStr: string, timezone: string = 'Asia/Shanghai'): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const offset = TIMEZONE_OFFSETS[timezone] || TIMEZONE_OFFSETS['Asia/Shanghai'];

  // 创建该日期在用户时区的结束时间，然后转换为UTC
  const dateEndInUserTz = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  return new Date(dateEndInUserTz.getTime() - (offset * 60000));
}

/**
 * 验证时间输入格式
 */
export function validateTimeInput(input: any): boolean {
  if (input instanceof Date) {
    return !isNaN(input.getTime());
  }

  if (typeof input === 'number') {
    return !isNaN(input) && input > 0;
  }

  if (typeof input === 'string') {
    // 验证ISO8601格式
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (isoRegex.test(input)) {
      return !isNaN(new Date(input).getTime());
    }

    // 验证日期格式 YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(input)) {
      return !isNaN(new Date(input).getTime());
    }
  }

  return false;
}

/**
 * 兼容性函数 - 保持向后兼容
 */

// 保持原有函数名，但使用新的实现
export function getCurrentBeijingTime(): Date {
  return getCurrentUTC();
}

export function getNowBeijing(): Date {
  return toUserTimezone(getCurrentUTC(), 'Asia/Shanghai');
}

export function toBeijingTime(utcDate: Date): Date {
  return toUserTimezone(utcDate, 'Asia/Shanghai');
}

export function toUTCTime(beijingDate: Date): Date {
  return toUTC(beijingDate, 'Asia/Shanghai');
}
