import { clsx } from 'clsx';

const sizes = { xs: 'w-6 h-6 text-xs', sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base', xl: 'w-16 h-16 text-xl' };

function initials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const colors = [
  'bg-brand-green text-white',
  'bg-brand-orange text-white',
  'bg-blue-500 text-white',
  'bg-purple-500 text-white',
  'bg-pink-500 text-white',
  'bg-teal-500 text-white',
];

function colorForName(name = '') {
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({ src, name = '', size = 'md', className, badge }) {
  return (
    <div className={clsx('relative inline-flex flex-shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={clsx('rounded-full object-cover', sizes[size])}
          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling?.style.removeProperty('display'); }}
        />
      ) : null}
      <div
        className={clsx(
          'rounded-full flex items-center justify-center font-semibold flex-shrink-0',
          sizes[size],
          colorForName(name),
          src && 'hidden'
        )}
      >
        {initials(name) || '?'}
      </div>
      {badge && (
        <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-white border border-white">
          {badge}
        </span>
      )}
    </div>
  );
}
