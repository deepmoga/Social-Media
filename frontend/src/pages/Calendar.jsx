import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { clsx } from 'clsx';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import { postsApi } from '../api/posts';
import { useClientStore } from '../store/clientStore';

const STATUS_COLORS = {
  scheduled: 'bg-blue-500',
  published: 'bg-brand-green',
  failed: 'bg-red-500',
  partially_failed: 'bg-brand-orange',
  draft: 'bg-gray-400',
  publishing: 'bg-yellow-500',
};

export default function Calendar() {
  const navigate = useNavigate();
  const { activeClientId } = useClientStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const paddingDays = startOfMonth(currentMonth).getDay();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
        const res = await postsApi.calendar({ clientId: activeClientId || undefined, start, end });
        setPosts(res.data.posts);
      } catch (err) {
        toast.error('Failed to load calendar');
      } finally { setLoading(false); }
    };
    load();
  }, [currentMonth, activeClientId]);

  const postsOnDay = (day) =>
    posts.filter(p => p.scheduled_time && isSameDay(new Date(p.scheduled_time), day));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Content Calendar"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
            <span className="text-sm font-semibold text-primary-color min-w-32 text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M9 18l7-7-7-7" />
              </svg>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>Today</Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="card overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-color">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-3 text-center text-xs font-semibold text-muted-color">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {/* padding */}
            {Array.from({ length: paddingDays }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-24 border-r border-b border-color last:border-r-0 bg-surface-tertiary/30" />
            ))}

            {days.map((day, i) => {
              const dayPosts = postsOnDay(day);
              const today = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className={clsx(
                    'min-h-24 border-r border-b border-color last:border-r-0 p-1.5 transition-colors',
                    today && 'bg-brand-green-50/50',
                    !isSameMonth(day, currentMonth) && 'opacity-40'
                  )}
                >
                  <div className={clsx(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-1 ml-auto',
                    today ? 'bg-brand-green text-white' : 'text-primary-color'
                  )}>
                    {format(day, 'd')}
                  </div>

                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 3).map(post => (
                      <button
                        key={post.id}
                        onClick={() => navigate(`/posts/${post.id}`)}
                        className="w-full flex items-center gap-1 text-left hover:opacity-80 transition-opacity"
                      >
                        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', STATUS_COLORS[post.status] || 'bg-gray-400')} />
                        <span className="text-xs text-primary-color truncate">{post.caption || post.content_type}</span>
                      </button>
                    ))}
                    {dayPosts.length > 3 && (
                      <p className="text-xs text-muted-color pl-2.5">+{dayPosts.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={clsx('w-2.5 h-2.5 rounded-full', color)} />
              <span className="text-xs text-muted-color capitalize">{status.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
