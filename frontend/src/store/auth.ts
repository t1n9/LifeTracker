import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name?: string;
  targetName?: string;
  targetDate?: string;
  examDate?: string;
  theme?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  updateTheme: (theme: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user }),
      
      setToken: (token) => {
        localStorage.setItem('token', token);
        set({ token });
      },

      login: (user, token) => {
        localStorage.setItem('token', token);
        set({ 
          user, 
          token, 
          isAuthenticated: true,
          isLoading: false 
        });
      },

      logout: () => {
        localStorage.removeItem('token');
        set({ 
          user: null, 
          token: null, 
          isAuthenticated: false,
          isLoading: false 
        });
      },

      setLoading: (isLoading) => set({ isLoading }),

      updateTheme: (theme) => set((state) => ({
        user: state.user ? { ...state.user, theme } : null
      })),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);
