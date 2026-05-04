// Date helpers (frontend, all UTC midnight semantics to match backend)

export function toDateOnly(value: string | Date): Date {
  const d = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

export function getMonday(d: Date): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  return addDays(d, -diff);
}

export function isSameDay(a: Date, b: Date): boolean {
  return formatDate(a) === formatDate(b);
}

export function isPast(d: Date, today: Date): boolean {
  return d < today;
}

export function formatDisplay(date: Date | string, withWeekday = false): string {
  const d = typeof date === 'string' ? toDateOnly(date) : date;
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (!withWeekday) return `${month}/${day}`;
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${month}/${day} ${weekdays[d.getUTCDay()]}`;
}

export function dayDiff(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}
