/**
 * 日期时间工具函数
 * 统一处理北京时间
 */

/**
 * 获取北京时间的今日开始时间 (00:00:00)
 * 返回北京时间的今日开始，用于date字段
 */
export function getTodayStart(): Date {
  const now = new Date();
  // 获取北京时间
  const beijingTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
  beijingTime.setHours(0, 0, 0, 0);
  return beijingTime;
}

/**
 * 获取北京时间的今日结束时间 (23:59:59.999)
 * 返回北京时间的今日结束，用于date字段
 */
export function getTodayEnd(): Date {
  const now = new Date();
  // 获取北京时间
  const beijingTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
  beijingTime.setHours(23, 59, 59, 999);
  return beijingTime;
}

/**
 * 获取北京时间的当前时间
 */
export function getNowBeijing(): Date {
  // 获取北京时间
  return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
}

/**
 * 获取指定天数前的开始时间（北京时间）
 */
export function getDaysAgoStart(days: number): Date {
  const now = new Date();
  // 获取北京时间
  const beijingTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
  beijingTime.setDate(beijingTime.getDate() - days + 1);
  beijingTime.setHours(0, 0, 0, 0);
  return beijingTime;
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

/**
 * 获取当前北京时间的时间字符串 (HH:mm)
 */
export function getCurrentTimeString(): string {
  const beijingTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
  return beijingTime.toTimeString().slice(0, 5); // HH:mm
}

/**
 * 获取当前北京时间，用于createdAt和updatedAt字段
 */
export function getCurrentBeijingTime(): Date {
  return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
}
