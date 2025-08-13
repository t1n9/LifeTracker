import { create } from 'zustand';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setToken: (token: string) => void;
  login: (token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  isAuthenticated: false,
  isLoading: false,

  setToken: (token) => {
    localStorage.setItem('token', token);
    set({ token, isAuthenticated: true });
  },

  login: (token) => {
    localStorage.setItem('token', token);
    set({
      token,
      isAuthenticated: true,
      isLoading: false
    });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({
      token: null,
      isAuthenticated: false,
      isLoading: false
    });
  },

  setLoading: (isLoading) => set({ isLoading }),
}));
