import { create } from 'zustand';

interface PomodoroState {
  isRunning: boolean;
  timeLeft: number;
  duration: number;
  currentTask: string | null;
  type: 'work' | 'break';
}

interface AppState {
  // 主题
  theme: 'light' | 'dark';
  
  // 番茄钟状态
  pomodoro: PomodoroState;
  
  // 专注模式
  focusMode: boolean;
  
  // 侧边栏
  sidebarOpen: boolean;
  
  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  
  // 番茄钟操作
  startPomodoro: (taskId?: string, duration?: number) => void;
  pausePomodoro: () => void;
  resumePomodoro: () => void;
  stopPomodoro: () => void;
  updatePomodoroTime: (timeLeft: number) => void;
  
  // 其他操作
  setFocusMode: (enabled: boolean) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: 'dark',
  
  pomodoro: {
    isRunning: false,
    timeLeft: 25 * 60, // 25分钟
    duration: 25 * 60,
    currentTask: null,
    type: 'work',
  },
  
  focusMode: false,
  sidebarOpen: false,

  setTheme: (theme) => set({ theme }),
  
  toggleTheme: () => {
    const currentTheme = get().theme;
    set({ theme: currentTheme === 'light' ? 'dark' : 'light' });
  },

  startPomodoro: (taskId, duration = 25 * 60) => {
    set({
      pomodoro: {
        isRunning: true,
        timeLeft: duration,
        duration,
        currentTask: taskId || null,
        type: 'work',
      },
    });
  },

  pausePomodoro: () => {
    set((state) => ({
      pomodoro: {
        ...state.pomodoro,
        isRunning: false,
      },
    }));
  },

  resumePomodoro: () => {
    set((state) => ({
      pomodoro: {
        ...state.pomodoro,
        isRunning: true,
      },
    }));
  },

  stopPomodoro: () => {
    set((state) => ({
      pomodoro: {
        ...state.pomodoro,
        isRunning: false,
        timeLeft: state.pomodoro.duration,
        currentTask: null,
      },
    }));
  },

  updatePomodoroTime: (timeLeft) => {
    set((state) => ({
      pomodoro: {
        ...state.pomodoro,
        timeLeft,
      },
    }));
  },

  setFocusMode: (focusMode) => set({ focusMode }),
  
  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },
}));
