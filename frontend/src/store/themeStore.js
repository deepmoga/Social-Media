import { create } from 'zustand';

const saved = () => localStorage.getItem('odm-theme') || 'light';

export const useThemeStore = create((set) => ({
  theme: saved(),
  toggle: () =>
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('odm-theme', next);
      document.documentElement.setAttribute('data-theme', next);
      return { theme: next };
    }),
  set: (theme) => {
    localStorage.setItem('odm-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
}));
