import { clsx } from 'clsx';
import { forwardRef } from 'react';

export const Input = forwardRef(({
  label,
  error,
  hint,
  icon,
  iconRight,
  className,
  inputClassName,
  ...props
}, ref) => {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="text-sm font-medium text-primary-color">
          {label}
          {props.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-color w-4 h-4">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full bg-surface border rounded-lg px-3 py-2 text-sm text-primary-color placeholder-text-muted',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent',
            error ? 'border-red-400 focus:ring-red-400' : 'border-color',
            icon && 'pl-9',
            iconRight && 'pr-9',
            inputClassName
          )}
          {...props}
        />
        {iconRight && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-color w-4 h-4">
            {iconRight}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-color">{hint}</p>}
    </div>
  );
});

Input.displayName = 'Input';

export const Textarea = forwardRef(({ label, error, hint, className, rows = 4, ...props }, ref) => {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="text-sm font-medium text-primary-color">
          {label}
          {props.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={clsx(
          'w-full bg-surface border rounded-lg px-3 py-2 text-sm text-primary-color placeholder-text-muted resize-vertical',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent',
          error ? 'border-red-400 focus:ring-red-400' : 'border-color'
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-color">{hint}</p>}
    </div>
  );
});

Textarea.displayName = 'Textarea';
