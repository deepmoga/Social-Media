import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      clients: [],

      setAuth: ({ user, accessToken, refreshToken, clients }) =>
        set({ user, accessToken, refreshToken, clients: clients || [] }),

      setClients: (clients) => set({ clients }),

      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null, clients: [] }),

      isAdmin: () => get().user?.role === 'admin',
      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'odm-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        clients: state.clients,
      }),
    }
  )
);
