import { Button } from './Button';

export function EmptyState({ icon, title, description, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-tertiary flex items-center justify-center mb-4 text-muted-color">
        {icon || (
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        )}
      </div>
      <h3 className="text-base font-semibold text-primary-color mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-color mb-6 max-w-sm">{description}</p>}
      {action && (
        <Button onClick={action} variant="primary">
          {actionLabel || 'Get started'}
        </Button>
      )}
    </div>
  );
}
