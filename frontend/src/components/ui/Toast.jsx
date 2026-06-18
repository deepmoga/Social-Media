// We use react-hot-toast — this file just provides the configured Toaster
import { Toaster, toast } from 'react-hot-toast';
import { useThemeStore } from '../../store/themeStore';

export function AppToaster() {
  const { theme } = useThemeStore();
  return (
    <Toaster
      position="top-right"
      gutter={8}
      toastOptions={{
        style: {
          background: theme === 'dark' ? '#1a1d27' : '#fff',
          color: theme === 'dark' ? '#f0f4f8' : '#0f1117',
          border: `1px solid ${theme === 'dark' ? '#2e3347' : '#e2e8f0'}`,
          borderRadius: '12px',
          fontSize: '14px',
          padding: '12px 16px',
          boxShadow: theme === 'dark'
            ? '0 8px 24px rgba(0,0,0,0.4)'
            : '0 8px 24px rgba(0,0,0,0.12)',
          maxWidth: '380px',
        },
        success: { iconTheme: { primary: '#2D6A1F', secondary: '#fff' }, duration: 3000 },
        error: { iconTheme: { primary: '#dc2626', secondary: '#fff' }, duration: 5000 },
      }}
    />
  );
}

export { toast };
