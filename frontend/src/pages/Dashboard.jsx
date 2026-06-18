import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, startOfDay } from 'date-fns';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { postsApi } from '../api/posts';
import { clientsApi } from '../api/clients';
import { useClientStore } from '../store/clientStore';
import { useAuthStore } from '../store/authStore';

const PlatformIcon = ({ platform, size = 4 }) => {
  if (platform === 'instagram') return (
    <svg className={`w-${size} h-${size}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
  return (
    <svg className={`w-${size} h-${size}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
};

function StatCard({ label, value, icon, color = 'green' }) {
  const colors = {
    green: 'bg-brand-green-50 text-brand-green',
    orange: 'bg-brand-orange-50 text-brand-orange',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-color">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-primary-color">{value ?? '—'}</p>
    </div>
  );
}

function PostRow({ post }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/posts/${post.id}`)}
      className="w-full flex items-center gap-4 p-4 hover:bg-surface-secondary rounded-xl transition-colors text-left"
    >
      <div className="w-12 h-12 rounded-lg bg-surface-tertiary flex-shrink-0 overflow-hidden">
        {post.thumbnail ? (
          <img src={post.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-color">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary-color truncate">
          {post.caption || '(No caption)'}
        </p>
        <p className="text-xs text-muted-color mt-0.5">
          {post.client_name} · {post.scheduled_time ? format(new Date(post.scheduled_time), 'MMM d, h:mm a') : 'Draft'}
        </p>
      </div>
      <StatusBadge status={post.status} />
    </button>
  );
}

export default function Dashboard() {
  const [upcoming, setUpcoming] = useState([]);
  const [recent, setRecent] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { activeClientId } = useClientStore();
  const { clients } = useAuthStore();
  const navigate = useNavigate();

  const activeClient = clients.find(c => c.id === activeClientId);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = activeClientId ? { clientId: activeClientId } : {};

        const [upcomingRes, recentRes] = await Promise.all([
          postsApi.list({ ...params, status: 'scheduled', limit: 5 }),
          postsApi.list({ ...params, limit: 6 }),
        ]);

        setUpcoming(upcomingRes.data.posts);
        setRecent(recentRes.data.posts);

        if (activeClientId) {
          const statsRes = await clientsApi.get(activeClientId);
          setStats(statsRes.data.stats);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeClientId]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title={activeClient ? activeClient.name : 'All Clients'}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/compose')}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
          >
            New Post
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Published" value={stats.published} color="green"
              icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M5 13l4 4L19 7" /></svg>} />
            <StatCard label="Scheduled" value={stats.scheduled} color="blue"
              icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>} />
            <StatCard label="Drafts" value={stats.drafts} color="orange"
              icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>} />
            <StatCard label="Failed" value={stats.failed} color="red"
              icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Posts */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-color">
              <h2 className="font-semibold text-primary-color">Upcoming Scheduled</h2>
              <Button variant="ghost" size="xs" onClick={() => navigate('/posts?status=scheduled')}>View all</Button>
            </div>
            <div className="divide-y divide-border">
              {loading ? (
                <div className="p-4"><CardSkeleton /></div>
              ) : upcoming.length === 0 ? (
                <EmptyState
                  title="No scheduled posts"
                  description="Schedule your first post to see it here."
                  action={() => navigate('/compose')}
                  actionLabel="Compose post"
                />
              ) : (
                upcoming.map(post => <PostRow key={post.id} post={post} />)
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-color">
              <h2 className="font-semibold text-primary-color">Recent Activity</h2>
              <Button variant="ghost" size="xs" onClick={() => navigate('/posts')}>View all</Button>
            </div>
            <div className="divide-y divide-border">
              {loading ? (
                <div className="p-4"><CardSkeleton /></div>
              ) : recent.length === 0 ? (
                <EmptyState title="No posts yet" description="Create your first post to get started." />
              ) : (
                recent.map(post => <PostRow key={post.id} post={post} />)
              )}
            </div>
          </div>
        </div>

        {/* Quick nav to clients */}
        {!activeClientId && clients.length > 0 && (
          <div className="card p-5">
            <h2 className="font-semibold text-primary-color mb-4">Clients</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {clients.map(client => (
                <button
                  key={client.id}
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-surface-secondary transition-colors"
                >
                  <Avatar name={client.name} src={client.logo_url} size="lg" />
                  <p className="text-xs font-medium text-primary-color text-center line-clamp-2">{client.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
