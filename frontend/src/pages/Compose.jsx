import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { postsApi } from '../api/posts';
import { mediaApi } from '../api/media';
import { clientsApi } from '../api/clients';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import { useClientStore } from '../store/clientStore';

const CONTENT_TYPES = [
  { value: 'image', label: 'Image', icon: '🖼️', maxMedia: 1 },
  { value: 'carousel', label: 'Carousel', icon: '📸', maxMedia: 10 },
  { value: 'video', label: 'Video / Reel', icon: '🎬', maxMedia: 1 },
  { value: 'story', label: 'Story', icon: '⭕', maxMedia: 1 },
];

const MAX_CAPTION = 2200;

function SortableMedia({ item, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx(
        'relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 group',
        isDragging && 'opacity-50 ring-2 ring-brand-green'
      )}
      {...attributes}
      {...listeners}
    >
      {item.mediaType === 'video' ? (
        <video src={item.previewUrl} className="w-full h-full object-cover" muted />
      ) : (
        <img src={item.previewUrl || item.url} alt="" className="w-full h-full object-cover" />
      )}
      {item.uploading && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          {item.progress > 0 && (
            <span className="text-white text-xs font-semibold">{item.progress}%</span>
          )}
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {item.mediaType === 'video' && (
        <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1 py-0.5">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
    </div>
  );
}

function PostPreview({ caption, media, contentType, platform = 'instagram' }) {
  const first = media[0];
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-card max-w-xs w-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-100">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600" />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-900">your_account</p>
          {contentType === 'story' && <p className="text-xs text-gray-400">Story · 24h</p>}
        </div>
        <div className="ml-auto">
          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
        </div>
      </div>

      {/* Media */}
      {first ? (
        <div className={clsx('bg-gray-100', contentType === 'story' ? 'aspect-[9/16]' : 'aspect-square')}>
          {first.mediaType === 'video' ? (
            <video src={first.previewUrl || first.url} className="w-full h-full object-cover" muted playsInline />
          ) : (
            <img src={first.previewUrl || first.url} alt="" className="w-full h-full object-cover" />
          )}
        </div>
      ) : (
        <div className={clsx('bg-gray-100 flex items-center justify-center', contentType === 'story' ? 'aspect-[9/16]' : 'aspect-square')}>
          <svg className="w-10 h-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
      )}

      {/* Actions + caption */}
      {contentType !== 'story' && (
        <div className="p-3">
          <div className="flex gap-3 mb-2">
            <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          {caption && (
            <p className="text-xs text-gray-700 line-clamp-3 leading-relaxed">{caption}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Compose() {
  const navigate = useNavigate();
  const { clients } = useAuthStore();
  const { activeClientId } = useClientStore();

  const [clientId, setClientId] = useState(activeClientId || '');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [contentType, setContentType] = useState('image');
  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState([]);
  const [coverImage, setCoverImage] = useState(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [scheduleMode, setScheduleMode] = useState('now'); // 'now' | 'schedule' | 'draft'
  const [scheduledTime, setScheduledTime] = useState('');
  const [alsoStory, setAlsoStory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState('instagram');

  const selectedType = CONTENT_TYPES.find(t => t.value === contentType);

  useEffect(() => {
    if (!clientId) { setAccounts([]); return; }
    clientsApi.get(clientId).then(res => {
      setAccounts(res.data.accounts.filter(a => a.status === 'active'));
      setSelectedAccountIds([]);
    }).catch(() => {});
  }, [clientId]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDrop = useCallback(async (accepted) => {
    if (!clientId) { toast.error('Select a client first'); return; }
    const maxMedia = selectedType?.maxMedia || 1;
    const remaining = maxMedia - media.filter(m => !m.uploading).length;
    const toAdd = accepted.slice(0, Math.max(0, remaining));

    const previews = toAdd.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      mediaType: file.type.startsWith('video/') ? 'video' : 'image',
      uploading: true,
      progress: 0,
      url: null,
      r2Key: null,
    }));

    setMedia(prev => [...prev, ...previews]);

    for (const item of previews) {
      try {
        const res = await mediaApi.upload(item.file, clientId, (e) => {
          if (e.total) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setMedia(prev => prev.map(m => m.id === item.id ? { ...m, progress: pct } : m));
          }
        });
        const { media: uploaded } = res.data;
        setMedia(prev => prev.map(m =>
          m.id === item.id
            ? { ...m, url: uploaded.url, r2Key: uploaded.r2Key, mimeType: uploaded.mimeType, fileSize: uploaded.fileSize, uploading: false, progress: 100 }
            : m
        ));
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Upload failed';
        toast.error(`${item.file.name}: ${msg}`);
        setMedia(prev => prev.filter(m => m.id !== item.id));
      }
    }
  }, [clientId, selectedType, media]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'video/*': [] },
    maxSize: 500 * 1024 * 1024,
  });

  const removeMedia = (id) => {
    setMedia(prev => prev.filter(m => m.id !== id));
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setCoverUploading(true);
    try {
      const res = await mediaApi.upload(file, clientId);
      setCoverImage({ url: res.data.media.url, r2Key: res.data.media.r2Key, previewUrl: URL.createObjectURL(file) });
    } catch {
      toast.error('Cover image upload failed');
    } finally { setCoverUploading(false); }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setMedia(prev => {
        const oldIndex = prev.findIndex(m => m.id === active.id);
        const newIndex = prev.findIndex(m => m.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const toggleAccount = (id) => {
    setSelectedAccountIds(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const generateCaption = async () => {
    const uploaded = media.find(m => !m.uploading && m.url);
    if (!uploaded) { toast.error('Pehle media upload karo'); return; }
    setAiLoading(true);
    try {
      const clientName = clients.find(c => String(c.id) === String(clientId))?.name || '';
      const isVideo = uploaded.mediaType === 'video';
      const res = await api.post('/ai/caption', {
        imageUrl: isVideo ? (coverImage?.url || null) : uploaded.url,
        mediaType: uploaded.mediaType,
        contentType,
        clientName,
      });
      setCaption(res.data.caption.slice(0, MAX_CAPTION));
      toast.success('Caption generated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI caption generate nahi hui');
    } finally { setAiLoading(false); }
  };

  const handleSubmit = async (mode) => {
    if (!clientId) { toast.error('Select a client'); return; }
    if (!selectedAccountIds.length) { toast.error('Select at least one account'); return; }
    if (media.some(m => m.uploading)) { toast.error('Wait for uploads to finish'); return; }
    if (!media.length) { toast.error('Add at least one media item'); return; }
    if (mode === 'schedule' && !scheduledTime) { toast.error('Select a scheduled time'); return; }

    setLoading(true);
    try {
      const status = mode === 'draft' ? 'draft' : mode === 'schedule' ? 'scheduled' : 'publishing';
      const scheduled_time = mode === 'schedule' ? new Date(scheduledTime).toISOString() : undefined;
      const mediaPayload = media.map(m => ({ url: m.url, r2Key: m.r2Key, mediaType: m.mediaType, mimeType: m.mimeType, fileSize: m.fileSize, coverUrl: m.mediaType === 'video' ? coverImage?.url : undefined }));

      const res = await postsApi.create({
        clientId: parseInt(clientId), caption, content_type: contentType,
        status, scheduled_time, accountIds: selectedAccountIds, media: mediaPayload,
      });

      // Also post as Story if toggled
      if (alsoStory && contentType !== 'story') {
        await postsApi.create({
          clientId: parseInt(clientId), caption: '',
          content_type: 'story', status, scheduled_time,
          accountIds: selectedAccountIds, media: mediaPayload,
        });
        toast.success(mode === 'draft' ? 'Draft + Story draft saved' : mode === 'schedule' ? 'Post + Story scheduled!' : 'Publishing post + Story…');
      } else {
        toast.success(mode === 'draft' ? 'Draft saved' : mode === 'schedule' ? 'Post scheduled!' : 'Publishing…');
      }

      navigate(`/posts/${res.data.postId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Compose Post" />

      <div className="flex-1 overflow-hidden flex">
        {/* Left: form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Client & Account Selection */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-primary-color">Target</h3>

            <div>
              <label className="text-sm font-medium text-primary-color block mb-1.5">Client</label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="w-full bg-surface border border-color rounded-lg px-3 py-2 text-sm text-primary-color focus:outline-none focus:ring-2 focus:ring-brand-green"
              >
                <option value="">— Select a client —</option>
                {clients.filter(c => c.status !== 'inactive').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {accounts.length > 0 && (
              <div>
                <label className="text-sm font-medium text-primary-color block mb-1.5">Publish to</label>
                <div className="flex flex-wrap gap-2">
                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => toggleAccount(acc.id)}
                      className={clsx(
                        'flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-all',
                        selectedAccountIds.includes(acc.id)
                          ? 'bg-brand-green-50 border-brand-green text-brand-green'
                          : 'border-color text-secondary-color hover:border-brand-green-100'
                      )}
                    >
                      <Avatar name={acc.account_name} src={acc.profile_pic_url} size="xs" />
                      {acc.account_name}
                      {acc.platform === 'instagram' ? (
                        <svg className="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Content Type */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-primary-color mb-3">Content Type</h3>
            <div className="grid grid-cols-4 gap-2">
              {CONTENT_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => { setContentType(type.value); setMedia([]); setCoverImage(null); }}
                  className={clsx(
                    'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-sm transition-all',
                    contentType === type.value
                      ? 'border-brand-green bg-brand-green-50 text-brand-green'
                      : 'border-color text-secondary-color hover:border-brand-green-100'
                  )}
                >
                  <span className="text-xl">{type.icon}</span>
                  <span className="text-xs font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Media Upload */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-primary-color">Media</h3>
              <span className="text-xs text-muted-color">{media.length}/{selectedType?.maxMedia || 1}</span>
            </div>

            {media.length < (selectedType?.maxMedia || 1) && (
              <div
                {...getRootProps()}
                className={clsx(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all mb-4',
                  isDragActive ? 'border-brand-green bg-brand-green-50' : 'border-color hover:border-brand-green-100'
                )}
              >
                <input {...getInputProps()} />
                <div className="w-10 h-10 rounded-xl bg-surface-tertiary flex items-center justify-center mx-auto mb-3 text-muted-color">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-primary-color">Drop files here or click to browse</p>
                <p className="text-xs text-muted-color mt-1">JPG, PNG, MP4 up to 500MB</p>
              </div>
            )}

            {media.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={media.map(m => m.id)} strategy={horizontalListSortingStrategy}>
                  <div className="flex gap-2 flex-wrap">
                    {media.map(item => (
                      <SortableMedia key={item.id} item={item} onRemove={removeMedia} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Cover Image for Video */}
            {contentType === 'video' && media.some(m => m.mediaType === 'video' && !m.uploading) && (
              <div className="mt-4 pt-4 border-t border-color">
                <h4 className="text-xs font-semibold text-primary-color mb-2">Cover Image (Thumbnail)</h4>
                {coverImage ? (
                  <div className="flex items-center gap-3">
                    <img src={coverImage.previewUrl || coverImage.url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-color">Cover image set</p>
                      <p className="text-xs text-green-600">AI Caption will analyze this image</p>
                    </div>
                    <button onClick={() => setCoverImage(null)} className="p-1.5 rounded-lg text-muted-color hover:text-red-600 hover:bg-red-50">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                ) : (
                  <label className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed cursor-pointer transition-all',
                    coverUploading ? 'border-blue-300 bg-blue-50' : 'border-color hover:border-brand-green'
                  )}>
                    <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" disabled={coverUploading} />
                    {coverUploading ? (
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4 text-muted-color" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                      </svg>
                    )}
                    <span className="text-xs text-muted-color">{coverUploading ? 'Uploading…' : 'Upload cover image for reel'}</span>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Caption */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-primary-color">Caption</h3>
              <span className={clsx('text-xs', caption.length > MAX_CAPTION * 0.9 ? 'text-brand-orange' : 'text-muted-color')}>
                {caption.length} / {MAX_CAPTION}
              </span>
            </div>
            <div className="relative">
              <Textarea
                placeholder="Write your caption here…"
                rows={6}
                value={caption}
                onChange={e => setCaption(e.target.value.slice(0, MAX_CAPTION))}
              />
              <button
                type="button"
                onClick={generateCaption}
                disabled={aiLoading || !media.find(m => !m.uploading && m.url)}
                title={media.find(m => !m.uploading && m.url) ? 'AI se caption generate karo' : 'Pehle media upload karo'}
                className={clsx(
                  'absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  aiLoading
                    ? 'bg-surface-tertiary text-muted-color cursor-wait'
                    : media.find(m => !m.uploading && m.url && m.mediaType === 'image')
                      ? 'bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200 shadow-sm'
                      : 'bg-surface-tertiary text-muted-color cursor-not-allowed opacity-50'
                )}
              >
                {aiLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                )}
                {aiLoading ? 'Generating…' : 'AI Caption'}
              </button>
            </div>
            {contentType === 'story' && (
              <p className="text-xs text-muted-color mt-2">Note: Captions are not supported on Stories (Instagram limitation)</p>
            )}
          </div>

          {/* Schedule */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-primary-color mb-3">Publishing</h3>
            <div className="flex gap-2 mb-4">
              {[
                { value: 'now', label: 'Publish now' },
                { value: 'schedule', label: 'Schedule' },
                { value: 'draft', label: 'Save as draft' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setScheduleMode(opt.value)}
                  className={clsx(
                    'flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all',
                    scheduleMode === opt.value
                      ? 'border-brand-green bg-brand-green-50 text-brand-green'
                      : 'border-color text-secondary-color hover:border-brand-green-100'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {scheduleMode === 'schedule' && (
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={e => setScheduledTime(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full bg-surface border border-color rounded-lg px-3 py-2 text-sm text-primary-color focus:outline-none focus:ring-2 focus:ring-brand-green"
              />
            )}

            {contentType !== 'story' && (
              <label className="flex items-center gap-3 mt-4 cursor-pointer select-none">
                <div
                  onClick={() => setAlsoStory(v => !v)}
                  className={clsx(
                    'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
                    alsoStory ? 'bg-brand-green' : 'bg-surface-tertiary border border-color'
                  )}
                >
                  <div className={clsx(
                    'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    alsoStory ? 'translate-x-5' : 'translate-x-0.5'
                  )} />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary-color">Also post as Story</p>
                  <p className="text-xs text-muted-color">FB + Instagram pe story bhi automatically post hogi</p>
                </div>
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pb-6">
            <Button variant="secondary" size="lg" onClick={() => navigate(-1)}>Cancel</Button>
            <Button
              variant="primary"
              size="lg"
              loading={loading}
              className="flex-1"
              onClick={() => handleSubmit(scheduleMode)}
            >
              {scheduleMode === 'draft' ? 'Save Draft' : scheduleMode === 'schedule' ? 'Schedule Post' : 'Publish Now'}
            </Button>
          </div>
        </div>

        {/* Right: preview */}
        <div className="w-80 flex-shrink-0 border-l border-color p-6 overflow-y-auto hidden xl:block">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-primary-color">Preview</h3>
            <div className="flex gap-1 bg-surface-tertiary rounded-lg p-0.5">
              {['instagram', 'facebook'].map(p => (
                <button
                  key={p}
                  onClick={() => setPreviewPlatform(p)}
                  className={clsx(
                    'px-2 py-1 rounded-md text-xs font-medium transition-all',
                    previewPlatform === p ? 'bg-surface text-primary-color shadow-sm' : 'text-muted-color'
                  )}
                >
                  {p === 'instagram' ? 'IG' : 'FB'}
                </button>
              ))}
            </div>
          </div>
          <PostPreview caption={caption} media={media} contentType={contentType} platform={previewPlatform} />
        </div>
      </div>
    </div>
  );
}
