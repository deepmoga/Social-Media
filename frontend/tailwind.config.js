/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Brand primaries
        brand: {
          green: '#2D6A1F',
          'green-light': '#3D8A29',
          'green-dark': '#1F4A15',
          'green-50': '#F0F7ED',
          'green-100': '#D8EDCF',
          orange: '#F47C00',
          'orange-light': '#FF9B30',
          'orange-dark': '#C06200',
          'orange-50': '#FFF4E6',
          'orange-100': '#FFE0B3',
        },
        // Light mode surfaces
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#F8F9FA',
          tertiary: '#F1F3F5',
          border: '#E2E8F0',
        },
        // Dark mode surfaces (used via CSS vars)
        dark: {
          surface: '#0F1117',
          secondary: '#1A1D27',
          tertiary: '#232635',
          border: '#2E3347',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.08)',
        'modal': '0 20px 60px -10px rgba(0,0,0,0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: 0, transform: 'scale(0.95)' }, to: { opacity: 1, transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
