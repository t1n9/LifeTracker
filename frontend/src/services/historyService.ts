// 历史数据服务
import { api } from '@/lib/api';

export interface DayData {
  id?: string;
  date: string;
  dayStart?: string;
  dayReflection?: string;
  reflectionTime?: string;
  wakeUpTime?: string; // 起床时间
  study?: {
    totalMinutes: number;
    pomodoroCount: number;
  };
  tasks?: Array<{
    id: string;
    text: string;
    completed: boolean;
    pomodoroCount: number;
  }>;
  exercise?: {
    running: number;
    pushUps: number;
    pullUps: number;
    squats: number;
    cycling: number;
    swimming: number;
    feeling?: string;
  };
  expenses?: {
    total: number;
    breakfast: number;
    lunch: number;
    dinner: number;
    customCategories?: Record<string, number>;
    other?: Array<{
      name?: string;
      description?: string;
      amount: number;
    }>;
  };
}

// 获取可用的历史日期列表
export async function fetchAvailableDates(): Promise<string[]> {
  try {
    const response = await api.get('/history/dates');
    return response.data.dates || [];
  } catch (error) {
    console.error('获取历史日期失败:', error);
    throw error;
  }
}

// 获取指定日期的数据
export async function fetchDayData(date: string): Promise<DayData | null> {
  try {
    const response = await api.get(`/history/day/${date}`);
    return response.data.data || null;
  } catch (error: unknown) {
    const err = error as { response?: { status?: number } };
    if (err.response?.status === 404) {
      return null; // 该日期没有数据
    }
    console.error(`获取${date}数据失败:`, error);
    throw error;
  }
}

// 导出数据
export function exportDayData(dayData: DayData, date: string) {
  const exportData = {
    exportInfo: {
      exportDate: new Date().toISOString(),
      dataDate: date,
      version: '1.0'
    },
    data: dayData
  };
  
  const filename = `LifeTracker记录_${date}.json`;
  const content = JSON.stringify(exportData, null, 2);
  
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 格式化日期显示
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
}

// 格式化学习时长
export function formatStudyTime(minutes: number): string {
  if (!minutes) return '0小时';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}.${Math.round(mins/6)}小时` : `${mins}分钟`;
}

// 计算任务完成率
export function getTaskStats(tasks: DayData['tasks']) {
  if (!tasks || tasks.length === 0) return { completed: 0, total: 0, rate: 0 };
  const completed = tasks.filter(task => task.completed).length;
  const total = tasks.length;
  const rate = Math.round((completed / total) * 100);
  return { completed, total, rate };
}
