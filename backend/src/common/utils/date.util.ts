/**
 * 日期时间工具函数
 * 统一处理北京时间
 */

/**
 * 获取北京时间的今日开始时间 (00:00:00)
 */
export function getTodayStart(): Date {
  const now = new Date();
  // 转换为北京时间
  const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  beijingTime.setUTCHours(0, 0, 0, 0);
  // 转换回 UTC 时间存储到数据库
  return new Date(beijingTime.getTime() - (8 * 60 * 60 * 1000));
}

/**
 * 获取北京时间的今日结束时间 (23:59:59.999)
 */
export function getTodayEnd(): Date {
  const now = new Date();
  // 转换为北京时间
  const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  beijingTime.setUTCHours(23, 59, 59, 999);
  // 转换回 UTC 时间存储到数据库
  return new Date(beijingTime.getTime() - (8 * 60 * 60 * 1000));
}

/**
 * 获取北京时间的当前时间
 */
export function getNowBeijing(): Date {
  const now = new Date();
  // 转换为北京时间
  return new Date(now.getTime() + (8 * 60 * 60 * 1000));
}

/**
 * 获取指定天数前的开始时间（北京时间）
 */
export function getDaysAgoStart(days: number): Date {
  const now = new Date();
  // 转换为北京时间
  const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  beijingTime.setUTCDate(beijingTime.getUTCDate() - days + 1);
  beijingTime.setUTCHours(0, 0, 0, 0);
  // 转换回 UTC 时间存储到数据库
  return new Date(beijingTime.getTime() - (8 * 60 * 60 * 1000));
}

/**
 * 将 UTC 时间转换为北京时间显示
 */
export function toBeijingTime(utcDate: Date): Date {
  return new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
}

/**
 * 将北京时间转换为 UTC 时间存储
 */
export function toUTCTime(beijingDate: Date): Date {
  return new Date(beijingDate.getTime() - (8 * 60 * 60 * 1000));
}
