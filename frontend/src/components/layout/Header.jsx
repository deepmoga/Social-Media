import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../ui/Button';
import { useNavigate } from 'react-router-dom';

export function Header({ title, actions }) {
  const { theme, toggle } = useThemeStore();
  const navigate = useNavigate();

  return (
    <header className="h-16 px-6 flex items-center justify-between border-b border-color bg-surface flex-shrink-0">
      <h1 className="text-lg font-semibold text-primary-color">{title}</h1>

      <div className="flex items-center gap-3">
        {actions}

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="p-2 rounded-lg hover:bg-surface-tertiary text-muted-color transition-colors"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
        </button>

        {/* Compose shortcut */}
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate('/compose')}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          }
        >
          New Post
        </Button>
      </div>
    </header>
  );
}
