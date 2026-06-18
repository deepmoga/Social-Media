import { clsx } from 'clsx';

const variants = {
  default: 'bg-surface-tertiary text-secondary-color border-color',
  green: 'bg-brand-green-50 text-brand-green border-brand-green-100',
  orange: 'bg-brand-orange-50 text-brand-orange-dark border-brand-orange-100',
  red: 'bg-red-50 text-red-700 border-red-100',
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
};

const statusMap = {
  published: 'green',
  scheduled: 'blue',
  draft: 'default',
  failed: 'red',
  partially_failed: 'orange',
  publishing: 'yellow',
  pending: 'default',
  active: 'green',
  token_expired: 'orange',
  disconnected: 'red',
  inactive: 'default',
};

export function Badge({ variant = 'default', status, dot = false, children, className }) {
  const v = status ? (statusMap[status] || 'default') : variant;
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
      variants[v],
      className
    )}>
      {dot && (
        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', {
          'bg-brand-green': v === 'green',
          'bg-blue-500': v === 'blue',
          'bg-red-500': v === 'red',
          'bg-brand-orange': v === 'orange',
          'bg-yellow-500': v === 'yellow',
          'bg-gray-400': v === 'default',
        })} />
      )}
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const labels = {
    published: 'Published',
    scheduled: 'Scheduled',
    draft: 'Draft',
    failed: 'Failed',
    partially_failed: 'Partial',
    publishing: 'Publishing',
    pending: 'Pending',
    active: 'Active',
    token_expired: 'Token Expired',
    disconnected: 'Disconnected',
    inactive: 'Inactive',
  };
  return <Badge status={status} dot>{labels[status] || status}</Badge>;
}
