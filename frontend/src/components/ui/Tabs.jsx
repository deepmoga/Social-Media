import { clsx } from 'clsx';

export function Tabs({ tabs, active, onChange, className }) {
  return (
    <div className={clsx('flex border-b border-color', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={clsx(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            active === tab.value
              ? 'border-brand-green text-brand-green'
              : 'border-transparent text-muted-color hover:text-primary-color'
          )}
        >
          {tab.icon && <span className="inline mr-1.5">{tab.icon}</span>}
          {tab.label}
          {tab.count !== undefined && (
            <span className={clsx(
              'ml-1.5 px-1.5 py-0.5 rounded-full text-xs',
              active === tab.value ? 'bg-brand-green-100 text-brand-green' : 'bg-surface-tertiary text-muted-color'
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
