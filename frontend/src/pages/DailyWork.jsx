import { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { Header } from '../components/layout/Header';
import { Avatar } from '../components/ui/Avatar';
import { toast } from '../components/ui/Toast';
import api from '../api/client';

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function DayPicker({ value, onChange }) {
  const today = formatDate(new Date());
  const goDay = (offset) => {
    const d = new Date(value + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    onChange(formatDate(d));
  };
  const isToday = value === today;

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => goDay(-1)} className="p-1.5 rounded-lg hover:bg-surface-tertiary text-muted-color transition-colors">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      <input
        type="date"
        value={value}
        max={today}
        onChange={e => onChange(e.target.value)}
        className="px-3 py-1.5 rounded-lg border border-color bg-surface text-sm text-primary-color focus:outline-none focus:border-brand-green"
      />
      <button onClick={() => goDay(1)} disabled={isToday} className={clsx('p-1.5 rounded-lg transition-colors', isToday ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-surface-tertiary text-muted-color')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
      {!isToday && (
        <button onClick={() => onChange(today)} className="text-xs px-2 py-1 rounded-md bg-brand-green-50 text-brand-green font-medium hover:bg-brand-green/10">
          Today
        </button>
      )}
    </div>
  );
}

export default function DailyWork() {
  const today = formatDate(new Date());
  const [date, setDate] = useState(today);
  const [clients, setClients] = useState([]);
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [expandedComment, setExpandedComment] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [clientsRes, workRes] = await Promise.all([
        api.get('/clients'),
        api.get(`/daily-work?date=${date}`),
      ]);
      setClients(clientsRes.data.clients || []);
      const map = {};
      for (const e of (workRes.data.entries || [])) {
        map[e.client_id] = { done: !!e.done, comment: e.comment || '' };
      }
      setEntries(map);
    } catch {
      toast.error('Failed to load');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [date]);

  const toggleDone = async (clientId) => {
    const current = entries[clientId] || { done: false, comment: '' };
    const newDone = !current.done;
    setEntries(prev => ({ ...prev, [clientId]: { ...current, done: newDone } }));
    setSaving(prev => ({ ...prev, [clientId]: true }));
    try {
      await api.post('/daily-work', { date, clientId, done: newDone, comment: current.comment });
    } catch {
      setEntries(prev => ({ ...prev, [clientId]: current }));
      toast.error('Failed to save');
    } finally {
      setSaving(prev => ({ ...prev, [clientId]: false }));
    }
  };

  const saveComment = async (clientId, comment) => {
    const current = entries[clientId] || { done: false, comment: '' };
    setEntries(prev => ({ ...prev, [clientId]: { ...current, comment } }));
    try {
      await api.post('/daily-work', { date, clientId, done: current.done, comment });
    } catch {
      toast.error('Failed to save comment');
    }
  };

  const doneCount = useMemo(() => clients.filter(c => entries[c.id]?.done).length, [clients, entries]);
  const pendingCount = clients.length - doneCount;
  const percentage = clients.length ? Math.round((doneCount / clients.length) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Daily Work" />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {/* Top bar: date + stats */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <DayPicker value={date} onChange={setDate} />

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm font-semibold text-primary-color">{doneCount} Done</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="text-sm font-semibold text-primary-color">{pendingCount} Pending</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-color">Progress</span>
              <span className="text-xs font-bold text-brand-green">{percentage}%</span>
            </div>
            <div className="h-2 rounded-full bg-surface-tertiary overflow-hidden">
              <div className="h-full rounded-full bg-brand-green transition-all duration-500" style={{ width: `${percentage}%` }} />
            </div>
          </div>

          {/* Client list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 rounded-xl bg-surface-tertiary animate-pulse" />)}
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-16 text-muted-color">No clients found</div>
          ) : (
            <div className="space-y-2">
              {clients.map(client => {
                const entry = entries[client.id] || { done: false, comment: '' };
                const isExpanded = expandedComment === client.id;

                return (
                  <div
                    key={client.id}
                    className={clsx(
                      'bg-surface border rounded-xl transition-all',
                      entry.done ? 'border-green-200 bg-green-50/30' : 'border-color'
                    )}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleDone(client.id)}
                        disabled={saving[client.id]}
                        className={clsx(
                          'w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all',
                          entry.done
                            ? 'bg-green-500 border-green-500'
                            : 'border-gray-300 hover:border-green-400'
                        )}
                      >
                        {entry.done && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3.5 h-3.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>

                      {/* Client info */}
                      <Avatar name={client.name} src={client.logo_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className={clsx(
                          'text-sm font-medium truncate',
                          entry.done ? 'text-green-700 line-through' : 'text-primary-color'
                        )}>
                          {client.name}
                        </p>
                        <p className="text-xs text-muted-color truncate">{client.industry || 'No industry'}</p>
                      </div>

                      {/* Comment indicator + toggle */}
                      <div className="flex items-center gap-2">
                        {entry.comment && !isExpanded && (
                          <span className="text-xs text-blue-500 max-w-[120px] truncate hidden sm:block">{entry.comment}</span>
                        )}
                        <button
                          onClick={() => setExpandedComment(isExpanded ? null : client.id)}
                          className={clsx(
                            'p-1.5 rounded-lg transition-colors',
                            isExpanded || entry.comment ? 'text-blue-500 bg-blue-50' : 'text-muted-color hover:bg-surface-tertiary'
                          )}
                          title="Add comment"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                          </svg>
                        </button>

                        {/* Status badge */}
                        <span className={clsx(
                          'text-xs font-semibold px-2 py-0.5 rounded-full',
                          entry.done ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        )}>
                          {entry.done ? 'Done' : 'Pending'}
                        </span>
                      </div>
                    </div>

                    {/* Comment area */}
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-0">
                        <textarea
                          rows={2}
                          placeholder="Add notes for today..."
                          value={entry.comment}
                          onChange={e => setEntries(prev => ({ ...prev, [client.id]: { ...entry, comment: e.target.value } }))}
                          onBlur={e => saveComment(client.id, e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-color bg-surface text-sm text-primary-color placeholder-muted-color focus:outline-none focus:border-blue-400 resize-none"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
