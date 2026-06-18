import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { toast } from '../components/ui/Toast';
import { postsApi } from '../api/posts';
import { clsx } from 'clsx';

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [media, setMedia] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await postsApi.get(id);
      setPost(res.data.post);
      setMedia(res.data.media);
      setPlatforms(res.data.platforms);
    } catch (err) {
      toast.error('Failed to load post');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const publishNow = async () => {
    try {
      await postsApi.publishNow(id);
      toast.success('Publishing started');
      setTimeout(load, 2000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to publish');
    }
  };

  const retry = async (ppId) => {
    try {
      await postsApi.retry(id, ppId);
      toast.success('Retry initiated');
      setTimeout(load, 2000);
    } catch (err) {
      toast.error('Retry failed');
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!post) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Post Detail"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>Back</Button>
            {['draft', 'failed', 'partially_failed'].includes(post.status) && (
              <Button variant="orange" size="sm" onClick={publishNow}>Publish Now</Button>
            )}
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Main info */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={post.status} />
                <span className="text-xs text-muted-color capitalize">· {post.content_type}</span>
              </div>
              <p className="text-sm text-primary-color whitespace-pre-wrap">{post.caption || '(No caption)'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-color border-t border-color pt-4">
            <span>Created by <strong className="text-secondary-color">{post.author_name}</strong></span>
            <span>Created <strong className="text-secondary-color">{format(new Date(post.created_at), 'MMM d, yyyy')}</strong></span>
            {post.scheduled_time && (
              <span>Scheduled for <strong className="text-secondary-color">{format(new Date(post.scheduled_time), 'MMM d, yyyy h:mm a')}</strong></span>
            )}
          </div>
        </div>

        {/* Media */}
        {media.length > 0 && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-primary-color mb-3">Media ({media.length})</h3>
            <div className="flex gap-3 flex-wrap">
              {media.map(m => (
                <div key={m.id} className="w-24 h-24 rounded-xl overflow-hidden">
                  {m.media_type === 'video' ? (
                    <video src={m.media_url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={m.media_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platforms */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-primary-color mb-4">Platform Status</h3>
          <div className="space-y-3">
            {platforms.map(pp => (
              <div key={pp.id} className={clsx(
                'flex items-center gap-3 p-3 rounded-xl border',
                pp.publish_status === 'published' ? 'border-brand-green-100 bg-brand-green-50' :
                pp.publish_status === 'failed' ? 'border-red-100 bg-red-50' : 'border-color'
              )}>
                <Avatar name={pp.account_name} src={pp.profile_pic_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary-color">{pp.account_name}</p>
                  <p className="text-xs text-muted-color capitalize">{pp.platform}</p>
                  {pp.error_log && (
                    <p className="text-xs text-red-600 mt-1 bg-red-50 p-1.5 rounded">{pp.error_log}</p>
                  )}
                  {pp.published_at && (
                    <p className="text-xs text-brand-green mt-1">
                      Published {format(new Date(pp.published_at), 'MMM d, h:mm a')}
                    </p>
                  )}
                </div>
                <StatusBadge status={pp.publish_status} />
                {pp.publish_status === 'failed' && pp.attempt_count < 3 && (
                  <Button variant="secondary" size="xs" onClick={() => retry(pp.id)}>Retry</Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
