import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import { useClientStore } from '../../store/clientStore';
import { Avatar } from '../ui/Avatar';

export function ClientSwitcher() {
  const [open, setOpen] = useState(false);
  const { clients } = useAuthStore();
  const { activeClientId, setActiveClient } = useClientStore();
  const ref = useRef(null);

  const active = clients.find(c => c.id === activeClientId);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-surface-tertiary transition-colors"
      >
        <Avatar name={active?.name || 'All'} src={active?.logo_url} size="sm" />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs text-muted-color">Client</p>
          <p className="text-sm font-medium text-primary-color truncate">{active?.name || 'All Clients'}</p>
        </div>
        <svg className="w-4 h-4 text-muted-color flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-color rounded-xl shadow-modal py-1.5 z-50 animate-slide-up max-h-64 overflow-y-auto">
          <button
            onClick={() => { setActiveClient(null); setOpen(false); }}
            className={clsx(
              'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
              !activeClientId ? 'bg-brand-green-50 text-brand-green' : 'text-primary-color hover:bg-surface-tertiary'
            )}
          >
            <div className="w-7 h-7 rounded-full bg-surface-tertiary flex items-center justify-center text-muted-color flex-shrink-0">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
              </svg>
            </div>
            <span className="font-medium">All Clients</span>
          </button>

          {clients.filter(c => c.status !== 'inactive').map(client => (
            <button
              key={client.id}
              onClick={() => { setActiveClient(client.id); setOpen(false); }}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                activeClientId === client.id ? 'bg-brand-green-50 text-brand-green' : 'text-primary-color hover:bg-surface-tertiary'
              )}
            >
              <Avatar name={client.name} src={client.logo_url} size="xs" />
              <span className="truncate">{client.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
