import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

export function Dropdown({ trigger, items, align = 'left', className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <div onClick={() => setOpen(v => !v)}>{trigger}</div>
      {open && (
        <div className={clsx(
          'absolute z-50 mt-1.5 min-w-[160px] bg-surface border border-color rounded-xl shadow-modal py-1.5 animate-slide-up',
          align === 'right' ? 'right-0' : 'left-0'
        )}>
          {items.map((item, i) =>
            item === 'divider' ? (
              <div key={i} className="h-px bg-border-color my-1 mx-2" />
            ) : (
              <button
                key={i}
                onClick={() => { item.onClick?.(); setOpen(false); }}
                disabled={item.disabled}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left',
                  item.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-primary-color hover:bg-surface-tertiary',
                  item.disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
