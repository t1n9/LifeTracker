import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';

// 创建axios实例
export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => {
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

// API接口定义
export const authAPI = {
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  register: (data: { email: string; password: string; name?: string }) =>
    api.post('/auth/register', data),
  getProfile: () => api.get('/auth/me'),
};

export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data: Record<string, unknown>) => api.patch('/users/profile', data),
  getStats: () => api.get('/users/stats'),
  updateTheme: (theme: string) => api.patch('/users/theme', { theme }),
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
