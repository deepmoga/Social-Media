import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { Tabs } from '../components/ui/Tabs';
import { EmptyState } from '../components/ui/EmptyState';
import { TableSkeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { postsApi } from '../api/posts';
import { useClientStore } from '../store/clientStore';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
  { value: 'failed', label: 'Failed' },
];

export default function Posts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeClientId } = useClientStore();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('status') || '');

  const load = async () => {
    if (!activeClientId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await postsApi.list({ clientId: activeClientId, status: activeTab || undefined });
      setPosts(res.data.posts);
    } catch (err) {
      toast.error('Failed to load posts');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [activeClientId, activeTab]);

  const deletePost = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this post?')) return;
    try {
      await postsApi.delete(id);
      toast.success('Post deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete post');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Posts"
        actions={
          <Button variant="primary" size="sm" onClick={() => navigate('/compose')}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
          >
            New Post
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="px-6 pt-4 border-b border-color bg-surface">
          <Tabs tabs={STATUS_TABS} active={activeTab} onChange={setActiveTab} />
        </div>

        <div className="flex-1 p-6">
          {!activeClientId ? (
            <EmptyState
              title="Select a client"
              description="Choose a client from the sidebar to view their posts."
            />
          ) : (
            <div className="card overflow-hidden">
              {loading ? (
                <div className="p-6"><TableSkeleton /></div>
              ) : posts.length === 0 ? (
                <EmptyState
                  title="No posts found"
                  description={activeTab ? `No ${activeTab} posts for this client.` : 'Create your first post to get started.'}
                  action={() => navigate('/compose')}
                  actionLabel="Compose Post"
                />
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-color">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-color uppercase tracking-wide">Post</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-color uppercase tracking-wide hidden md:table-cell">Type</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-color uppercase tracking-wide">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-color uppercase tracking-wide hidden lg:table-cell">Scheduled</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-muted-color uppercase tracking-wide hidden lg:table-cell">Author</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-muted-color uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {posts.map(post => (
                      <tr
                        key={post.id}
                        className="hover:bg-surface-secondary transition-colors cursor-pointer"
                        onClick={() => navigate(`/posts/${post.id}`)}
                      >
                        <td className="px-5 py-4 max-w-xs">
                          <p className="text-sm font-medium text-primary-color truncate">
                            {post.caption || '(No caption)'}
                          </p>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          <span className="text-sm text-secondary-color capitalize">{post.content_type}</span>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={post.status} />
                        </td>
                        <td className="px-5 py-4 text-sm text-secondary-color hidden lg:table-cell">
                          {post.scheduled_time ? format(new Date(post.scheduled_time), 'MMM d, h:mm a') : '—'}
                        </td>
                        <td className="px-5 py-4 text-sm text-secondary-color hidden lg:table-cell">
                          {post.author_name}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={(e) => deletePost(post.id, e)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-muted-color hover:text-red-600 transition-colors"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
