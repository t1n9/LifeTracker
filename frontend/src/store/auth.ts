import { create } from 'zustand';
import { authAPI } from '@/lib/api';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasInitialized: boolean;

  // Actions
  initializeAuth: () => Promise<void>;
  setToken: (token: string) => void;
  login: (token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  isAuthenticated: false,
  isLoading: true,
  hasInitialized: false,

  initializeAuth: async () => {
    const { hasInitialized } = get();
    if (hasInitialized) {
      return;
    }

    set({ isLoading: true });

    if (typeof window === 'undefined') {
      set({ isLoading: false, hasInitialized: true });
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      set({
        token: null,
        isAuthenticated: false,
        isLoading: false,
        hasInitialized: true,
      });
      return;
    }

    try {
      await authAPI.getProfile();
      set({
        token,
        isAuthenticated: true,
        isLoading: false,
        hasInitialized: true,
      });
    } catch {
      localStorage.removeItem('token');
      set({
        token: null,
        isAuthenticated: false,
        isLoading: false,
        hasInitialized: true,
      });
    }
  },

  setToken: (token) => {
    localStorage.setItem('token', token);
    set({
      token,
      isAuthenticated: true,
      isLoading: false,
      hasInitialized: true,
    });
  },

  login: (token) => {
    localStorage.setItem('token', token);
    set({
      token,
      isAuthenticated: true,
      isLoading: false,
      hasInitialized: true,
    });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({
      token: null,
      isAuthenticated: false,
      isLoading: false,
      hasInitialized: true,
    });
  },

  setLoading: (isLoading) => set({ isLoading }),
}));
