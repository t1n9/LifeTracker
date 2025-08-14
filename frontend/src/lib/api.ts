import axios from 'axios';
import { processApiTimeFields, toUTCForSubmit } from './time';

// 开发环境和生产环境的API配置
const API_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3002/api'  // 开发环境直接连接后端
  : process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}/api`
      : 'http://localhost:3002/api');

// 创建axios实例
export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证token和处理时间字段
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    // 处理请求体中的时间字段，转换为UTC格式
    if (config.data && typeof config.data === 'object') {
      config.data = processRequestTimeFields(config.data);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理错误和时间字段
api.interceptors.response.use(
  (response) => {
    // 处理响应中的时间字段
    if (response.data) {
      response.data = processApiTimeFields(response.data);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // 清除token并重定向到登录页
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// 处理请求中的时间字段
function processRequestTimeFields(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => processRequestTimeFields(item));
  }

  const result = { ...data };
  const timeFields = ['startedAt', 'completedAt', 'targetDate', 'examDate', 'dueDate'];

  for (const field of timeFields) {
    if (result[field]) {
      try {
        result[field] = toUTCForSubmit(result[field]);
      } catch (error) {
        console.warn(`Failed to process time field ${field}:`, error);
      }
    }
  }

  return result;
}

// API接口定义
export const authAPI = {
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  register: (data: { email: string; password: string; name?: string; verificationCode: string }) =>
    api.post('/auth/register', data),
  getProfile: () => api.get('/auth/me'),
};

export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data: Record<string, unknown>) => api.patch('/users/profile', data),
  getStats: () => api.get('/users/stats'),
  updateTheme: (theme: string) => api.patch('/users/theme', { theme }),
  getExerciseConfig: () => api.get('/users/exercise-config'),
};

export const taskAPI = {
  getTasks: () => api.get('/tasks'),
  createTask: (data: Record<string, unknown>) => api.post('/tasks', data),
  updateTask: (id: string, data: Record<string, unknown>) => api.patch(`/tasks/${id}`, data),
  deleteTask: (id: string) => api.delete(`/tasks/${id}`),
  getTaskStats: () => api.get('/tasks/stats'),
  getTodayTasks: () => api.get('/tasks/today'),
};

export const studyAPI = {
  getStats: () => api.get('/study/stats'),
  getDailyData: (date?: string) => api.get('/study/daily', { params: { date } }),
  getRecords: (limit?: number) => api.get('/study/records', { params: { limit } }),
  getPomodoroSessions: (limit?: number) => api.get('/study/pomodoro', { params: { limit } }),
  createStudyRecord: (data: {
    duration: number;
    subject?: string;
    taskId?: string;
    startedAt?: string;
    completedAt?: string;
  }) => api.post('/study/records', data),
  createPomodoroSession: (data: {
    duration: number;
    type: 'WORK' | 'SHORT_BREAK' | 'LONG_BREAK';
    status: 'COMPLETED' | 'CANCELLED';
    taskId?: string;
    startedAt?: string;
    completedAt?: string;
  }) => api.post('/study/pomodoro', data),
  deleteStudyRecord: (id: string) => api.delete(`/study/records/${id}`),
  getTodayStats: () => api.get('/study/today'),
};

export const healthAPI = {
  getStats: () => api.get('/health/stats'),
  getHealthRecords: (limit?: number) => api.get('/health/records', { params: { limit } }),
  getExerciseRecords: (limit?: number) => api.get('/health/exercise', { params: { limit } }),
  getExpenseRecords: (limit?: number) => api.get('/health/expense', { params: { limit } }),
  checkHealth: () => api.get('/health'),
};

export const pomodoroAPI = {
  startPomodoro: (data: { duration: number; taskId?: string; isCountUpMode?: boolean }) =>
    api.post('/pomodoro/start', data),
  pausePomodoro: (sessionId: string) =>
    api.post(`/pomodoro/pause/${sessionId}`),
  resumePomodoro: (sessionId: string) =>
    api.post(`/pomodoro/resume/${sessionId}`),
  stopPomodoro: (sessionId: string) =>
    api.post(`/pomodoro/stop/${sessionId}`),
  getPomodoroStatus: (sessionId: string) =>
    api.get(`/pomodoro/status/${sessionId}`),
  getActiveSession: () =>
    api.get('/pomodoro/active'),
  getAllSessions: () =>
    api.get('/pomodoro/sessions'),
};

export const importantInfoAPI = {
  getCurrentInfo: () => api.get('/important-info'),
  updateInfo: (content: string) => api.put('/important-info', { content }),
  getHistoryCount: () => api.get('/important-info/history/count'),
};

export const exerciseAPI = {
  getExerciseTypes: () => api.get('/exercise/types'),
  createExerciseType: (data: {
    name: string;
    type: 'COUNT' | 'DISTANCE';
    unit: string;
    increment?: number;
    icon?: string;
    color?: string;
  }) => api.post('/exercise/types', data),
  updateExerciseType: (id: string, data: any) => api.put(`/exercise/types/${id}`, data),
  deleteExerciseType: (id: string) => api.delete(`/exercise/types/${id}`),
  getTodayRecords: () => api.get('/exercise/today'),
  addExerciseRecord: (data: {
    exerciseId: string;
    value: number;
    notes?: string;
  }) => api.post('/exercise/records', data),
  setTodayExerciseValue: (data: {
    exerciseId: string;
    totalValue: number;
    notes?: string;
  }) => api.put('/exercise/records/today', data),
  setExerciseFeeling: (feeling: string) => api.put('/exercise/feeling', { feeling }),
  getExerciseFeeling: () => api.get('/exercise/feeling'),
  getExerciseStats: (days?: number) => api.get('/exercise/stats', { params: { days } }),
};

export const expenseAPI = {
  getTodayExpenses: () => api.get('/expense/today'),
  setMealExpense: (data: {
    category: 'breakfast' | 'lunch' | 'dinner';
    amount: number;
  }) => api.put('/expense/meals', data),
  addOtherExpense: (data: {
    description: string;
    amount: number;
    notes?: string;
  }) => api.post('/expense/others', data),
  deleteOtherExpense: (id: string) => api.delete(`/expense/others/${id}`),
  getExpenseStats: (days?: number) => api.get('/expense/stats', { params: { days } }),
};

// 系统配置API
export const systemConfigAPI = {
  getPublicConfigs: () => api.get('/system-config/public'),
  getAllConfigs: () => api.get('/system-config'),
  updateConfig: (key: string, data: { value: string; description?: string; isPublic?: boolean }) =>
    api.put(`/system-config/${key}`, data),
};

// 每日数据API
export const dailyAPI = {
  getDailyData: (date?: string) => api.get('/daily', { params: { date } }),
  getTodayStatus: () => api.get('/daily/status'),
  updateDayStart: (data: { dayStart: string; date?: string }) => api.put('/daily/start', data),
  updateDayReflection: (data: { dayReflection: string; reflectionTime?: string; phoneUsage?: number; date?: string }) =>
    api.put('/daily/reflection', data),
  clearDayStart: (date?: string) => api.delete('/daily/start', { params: { date } }),
  clearDayReflection: (date?: string) => api.delete('/daily/reflection', { params: { date } }),
};

// 学习概况API
export const overviewAPI = {
  getFullOverview: () => api.get('/overview'),
  getHeatmapData: (days?: number) => api.get('/overview/heatmap', { params: { days } }),
  getRecentActivities: (limit?: number) => api.get('/overview/activities', { params: { limit } }),
  getChartData: (days?: number) => api.get('/overview/chart', { params: { days } }),
  getStats: () => api.get('/overview/stats'),
};

// 邮箱验证API
export const emailAPI = {
  sendVerificationCode: (email: string, purpose: 'register' | 'reset_password' | 'change_email') =>
    api.post('/email/send-code', { email, purpose }),
  verifyCode: (email: string, code: string, purpose: string) =>
    api.post('/email/verify-code', { email, code, purpose }),
};
