import { clsx } from 'clsx';

const variants = {
  primary: 'bg-brand-green hover:bg-brand-green-light active:bg-brand-green-dark text-white shadow-sm',
  secondary: 'bg-surface border border-color text-primary-color hover:bg-surface-tertiary',
  danger: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-sm',
  ghost: 'text-primary-color hover:bg-surface-tertiary',
  orange: 'bg-brand-orange hover:bg-brand-orange-light active:bg-brand-orange-dark text-white shadow-sm',
  outline: 'border border-brand-green text-brand-green hover:bg-brand-green-50',
};

const sizes = {
  xs: 'px-2.5 py-1 text-xs gap-1',
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  children,
  className,
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : icon ? (
        <span className="flex-shrink-0 w-4 h-4">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
      {iconRight && !loading && <span className="flex-shrink-0 w-4 h-4">{iconRight}</span>}
    </button>
  );
}
