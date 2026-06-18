import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useClientStore = create(
  persist(
    (set) => ({
      activeClientId: null,   // null = "All Clients"
      setActiveClient: (id) => set({ activeClientId: id }),
      clearActiveClient: () => set({ activeClientId: null }),
    }),
    { name: 'odm-client' }
  )
);
