import { useState, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { toast } from '../components/ui/Toast';
import { useAuthStore } from '../store/authStore';
import { useClientStore } from '../store/clientStore';
import api from '../api/client';
import { clsx } from 'clsx';

function StatCard({ label, value, icon, color }) {
  return (
    <div className="flex flex-col items-center justify-center bg-surface-secondary rounded-xl p-3 min-w-[72px]">
      <span className={clsx('text-lg mb-0.5', color)}>{icon}</span>
      <span className="text-base font-bold text-primary-color">{fmtNum(value)}</span>
      <span className="text-xs text-muted-color">{label}</span>
    </div>
  );
}

function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n || 0;
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Analytics() {
  const { clients } = useAuthStore();
  const { activeClientId } = useClientStore();
  const [clientId, setClientId] = useState(activeClientId || '');
  const [platform, setPlatform] = useState('all');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const params = platform !== 'all' ? `?platform=${platform}` : '';
      const res = await api.get(`/insights/${clientId}${params}`);
      setResults(res.data.results || []);
    } catch (err) {
      toast.error('Failed to load insights');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [clientId, platform]);

  const allPosts = results.flatMap(r => r.posts || [])
    .sort((a, b) => new Date(b.created_time) - new Date(a.created_time));

  const totals = allPosts.reduce((acc, p) => ({
    reach: acc.reach + (p.reach || 0),
    impressions: acc.impressions + (p.impressions || 0),
    likes: acc.likes + (p.likes || 0),
    comments: acc.comments + (p.comments || 0),
    shares: acc.shares + (p.shares || 0),
    saved: acc.saved + (p.saved || 0),
  }), { reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, saved: 0 });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Analytics" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            className="bg-surface border border-color rounded-lg px-3 py-2 text-sm text-primary-color focus:outline-none focus:ring-2 focus:ring-brand-green"
          >
            <option value="">— Select Client —</option>
            {clients.filter(c => c.status !== 'inactive').map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <div className="flex gap-1 bg-surface-secondary rounded-lg p-1">
            {[['all', 'All'], ['facebook', 'Facebook'], ['instagram', 'Instagram']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setPlatform(val)}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  platform === val ? 'bg-surface text-primary-color shadow-sm' : 'text-muted-color hover:text-primary-color'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {loading && <div className="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />}
        </div>

        {/* Summary cards */}
        {clientId && !loading && allPosts.length > 0 && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-primary-color mb-4">Total ({allPosts.length} posts)</h3>
            <div className="flex flex-wrap gap-3">
              <StatCard label="Reach" value={totals.reach} icon="👁️" color="text-blue-500" />
              <StatCard label="Impressions" value={totals.impressions} icon="📊" color="text-purple-500" />
              <StatCard label="Likes" value={totals.likes} icon="❤️" color="text-red-500" />
              <StatCard label="Comments" value={totals.comments} icon="💬" color="text-yellow-500" />
              <StatCard label="Shares" value={totals.shares} icon="🔁" color="text-green-500" />
              <StatCard label="Saved" value={totals.saved} icon="🔖" color="text-indigo-500" />
            </div>
          </div>
        )}

        {/* Per account sections */}
        {!clientId && (
          <div className="card p-10 text-center text-muted-color text-sm">Client select karo insights dekhne ke liye</div>
        )}

        {clientId && !loading && results.length === 0 && (
          <div className="card p-10 text-center text-muted-color text-sm">Koi data nahi mila</div>
        )}

        {results.map(account => (
          <div key={account.account_id} className="card overflow-hidden">
            {/* Account header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-color bg-surface-secondary">
              <div className={clsx('w-2 h-2 rounded-full', account.platform === 'instagram' ? 'bg-purple-500' : 'bg-blue-500')} />
              <span className="text-sm font-semibold text-primary-color">{account.account_name}</span>
              <Badge variant={account.platform === 'instagram' ? 'purple' : 'blue'} className="text-xs capitalize">{account.platform}</Badge>
              {account.error && <span className="text-xs text-red-500 ml-auto">{account.error}</span>}
              <span className="text-xs text-muted-color ml-auto">{account.posts?.length || 0} posts</span>
            </div>

            {/* Posts table */}
            {account.posts?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-color">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-color uppercase tracking-wide">Post</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-color uppercase tracking-wide">Date</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-muted-color uppercase tracking-wide">Reach</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-muted-color uppercase tracking-wide">Impressions</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-muted-color uppercase tracking-wide">Likes</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-muted-color uppercase tracking-wide">Comments</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-muted-color uppercase tracking-wide">Shares</th>
                      {account.platform === 'instagram' && (
                        <th className="px-4 py-3 text-center text-xs font-semibold text-muted-color uppercase tracking-wide">Saved</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {account.posts.map(post => (
                      <tr key={post.id} className="hover:bg-surface-secondary transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {post.thumbnail ? (
                              <img src={post.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-surface-tertiary flex-shrink-0" />
                            )}
                            <p className="text-xs text-secondary-color line-clamp-2 max-w-[200px]">
                              {post.caption || '—'}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-color whitespace-nowrap">{fmtDate(post.created_time)}</td>
                        <td className="px-4 py-3 text-center text-sm font-medium text-primary-color">{fmtNum(post.reach)}</td>
                        <td className="px-4 py-3 text-center text-sm text-secondary-color">{fmtNum(post.impressions)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="flex items-center justify-center gap-1 text-sm text-red-500 font-medium">
                            ❤️ {fmtNum(post.likes)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="flex items-center justify-center gap-1 text-sm text-yellow-600 font-medium">
                            💬 {fmtNum(post.comments)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="flex items-center justify-center gap-1 text-sm text-green-600 font-medium">
                            🔁 {fmtNum(post.shares)}
                          </span>
                        </td>
                        {account.platform === 'instagram' && (
                          <td className="px-4 py-3 text-center">
                            <span className="flex items-center justify-center gap-1 text-sm text-indigo-600 font-medium">
                              🔖 {fmtNum(post.saved)}
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !account.error && <p className="px-5 py-4 text-sm text-muted-color">Koi post nahi mili</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
