import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Tabs } from '../components/ui/Tabs';
import { EmptyState } from '../components/ui/EmptyState';
import { toast } from '../components/ui/Toast';
import { ConnectWizard } from '../components/accounts/ConnectWizard';
import { clientsApi } from '../api/clients';
import { metaApi } from '../api/meta';
import { tiktokApi } from '../api/tiktok';
import { googleApi } from '../api/google';
import { useAuthStore } from '../store/authStore';

// ── Platform Icons ────────────────────────────────────────────────────────────
const PlatformIcon = ({ platform }) => {
  if (platform === 'instagram') return (
    <svg className="w-4 h-4 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
  if (platform === 'tiktok') return (
    <svg className="w-4 h-4 text-gray-900 dark:text-white" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.19 8.19 0 004.79 1.54V6.78a4.85 4.85 0 01-1.02-.09z"/>
    </svg>
  );
  if (platform === 'google_gmb') return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4285F4"/>
    </svg>
  );
  return (
    <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
};

// ── Google GMB Location Picker Modal ─────────────────────────────────────────
function GmbLocationPicker({ sessionKey, clientId, onSuccess, onClose }) {
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    googleApi.getLocations(sessionKey)
      .then(r => setLocations(r.data.discovered || []))
      .catch(() => toast.error('Failed to load locations'))
      .finally(() => setLoading(false));
  }, [sessionKey]);

  const toggle = (name) => setSelected(prev =>
    prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
  );

  const save = async () => {
    if (!selected.length) { toast.error('Select at least one location'); return; }
    setSaving(true);
    try {
      await googleApi.connect(sessionKey, selected, clientId);
      toast.success(`${selected.length} Google Business location(s) connected!`);
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to connect locations');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-primary-color mb-1">Select Google Business Locations</h2>
        <p className="text-xs text-muted-color mb-4">Choose which locations to connect for this client.</p>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
          </div>
        ) : locations.length === 0 ? (
          <p className="text-sm text-muted-color text-center py-6">No locations found in this Google Business account.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
            {locations.map(loc => (
              <label key={loc.locationName} className="flex items-start gap-3 p-3 rounded-xl border border-color cursor-pointer hover:border-brand-green transition-colors">
                <input
                  type="checkbox"
                  checked={selected.includes(loc.locationName)}
                  onChange={() => toggle(loc.locationName)}
                  className="mt-0.5 accent-green-500"
                />
                <div>
                  <p className="text-sm font-medium text-primary-color">{loc.locationTitle}</p>
                  {loc.locationAddress && <p className="text-xs text-muted-color">{loc.locationAddress}</p>}
                </div>
              </label>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button variant="primary" loading={saving} onClick={save} className="flex-1">
            Connect {selected.length > 0 ? `(${selected.length})` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ClientDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [data, setData] = useState(null);
  const [tab, setTab] = useState('accounts');
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectingTiktok, setConnectingTiktok] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [gmbSession, setGmbSession] = useState(null);
  const popupRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await clientsApi.get(clientId);
      setData(res.data);
    } catch { toast.error('Failed to load client'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [clientId]);

  const disconnectAccount = async (accountId, platform) => {
    if (!window.confirm('Disconnect this account? Scheduled posts targeting it will fail.')) return;
    try {
      if (platform === 'tiktok') await tiktokApi.disconnect(accountId);
      else if (platform === 'google_gmb') await googleApi.disconnect(accountId);
      else await metaApi.disconnect(accountId);
      toast.success('Account disconnected');
      load();
    } catch { toast.error('Failed to disconnect'); }
  };

  // ── TikTok OAuth popup ───────────────────────────────────────────────────
  const connectTikTok = async () => {
    setConnectingTiktok(true);
    try {
      const res = await tiktokApi.getOAuthUrl(clientId);
      const url = res.data.url;

      const popup = window.open(url, 'tiktok-oauth', 'width=600,height=700,scrollbars=yes');
      popupRef.current = popup;

      const channel = new BroadcastChannel('tiktok-oauth');
      channel.onmessage = (e) => {
        channel.close();
        if (e.data?.success) {
          toast.success(`TikTok account "${e.data.accountName}" connected!`);
          load();
        } else {
          toast.error(e.data?.error || 'TikTok connection failed');
        }
        setConnectingTiktok(false);
      };

      // Fallback: poll localStorage
      const poll = setInterval(() => {
        try {
          const raw = localStorage.getItem('tiktok_oauth_result');
          if (raw) {
            localStorage.removeItem('tiktok_oauth_result');
            clearInterval(poll);
            channel.close();
            const data = JSON.parse(raw);
            if (data.success) { toast.success(`TikTok account "${data.accountName}" connected!`); load(); }
            else toast.error(data.error || 'TikTok connection failed');
            setConnectingTiktok(false);
          }
        } catch {}
        if (popup?.closed) { clearInterval(poll); setConnectingTiktok(false); }
      }, 500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start TikTok OAuth');
      setConnectingTiktok(false);
    }
  };

  // ── Google GMB OAuth popup ───────────────────────────────────────────────
  const connectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const res = await googleApi.getOAuthUrl(clientId);
      const url = res.data.url;

      const popup = window.open(url, 'google-oauth', 'width=600,height=700,scrollbars=yes');

      const channel = new BroadcastChannel('google-oauth');
      channel.onmessage = (e) => {
        channel.close();
        if (e.data?.sessionKey) {
          setGmbSession({ sessionKey: e.data.sessionKey, clientId });
        } else {
          toast.error(e.data?.error || 'Google connection failed');
        }
        setConnectingGoogle(false);
      };

      // Fallback: poll localStorage
      const poll = setInterval(() => {
        try {
          const raw = localStorage.getItem('google_oauth_result');
          if (raw) {
            localStorage.removeItem('google_oauth_result');
            clearInterval(poll);
            channel.close();
            const data = JSON.parse(raw);
            if (data.sessionKey) setGmbSession({ sessionKey: data.sessionKey, clientId });
            else toast.error(data.error || 'Google connection failed');
            setConnectingGoogle(false);
          }
        } catch {}
        if (popup?.closed) { clearInterval(poll); setConnectingGoogle(false); }
      }, 500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start Google OAuth');
      setConnectingGoogle(false);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) return null;
  const { client, accounts, team, stats } = data;

  const platformLabel = (p) => ({
    facebook: 'Facebook', instagram: 'Instagram',
    tiktok: 'TikTok', google_gmb: 'Google Business',
  }[p] || p);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title={client.name}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>Back</Button>
            {isAdmin && (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" loading={connectingTiktok} onClick={connectTikTok}
                  icon={<svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.19 8.19 0 004.79 1.54V6.78a4.85 4.85 0 01-1.02-.09z"/></svg>}
                >TikTok</Button>
                <Button variant="secondary" size="sm" loading={connectingGoogle} onClick={connectGoogle}
                  icon={<svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4285F4"/></svg>}
                >Google GMB</Button>
                <Button variant="primary" size="sm" onClick={() => setShowWizard(true)}
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>}
                >Facebook / IG</Button>
              </div>
            )}
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Published', value: stats?.published },
            { label: 'Scheduled', value: stats?.scheduled },
            { label: 'Drafts', value: stats?.drafts },
            { label: 'Failed', value: stats?.failed },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <p className="text-2xl font-bold text-primary-color">{s.value ?? 0}</p>
              <p className="text-xs text-muted-color mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          <Tabs
            tabs={[
              { value: 'accounts', label: 'Accounts', count: accounts.length },
              { value: 'team', label: 'Team', count: team.length },
            ]}
            active={tab}
            onChange={setTab}
          />

          <div className="p-5">
            {tab === 'accounts' && (
              accounts.length === 0 ? (
                <EmptyState
                  title="No accounts connected"
                  description="Connect Facebook, Instagram, TikTok or Google Business accounts."
                  action={isAdmin ? () => setShowWizard(true) : undefined}
                  actionLabel="Connect Facebook / IG"
                />
              ) : (
                <div className="space-y-3">
                  {accounts.map(acc => (
                    <div key={acc.id} className="flex items-center gap-3 p-3 bg-surface-secondary rounded-xl">
                      <Avatar src={acc.profile_pic_url} name={acc.account_name} size="sm"
                        badge={<PlatformIcon platform={acc.platform} />}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary-color">{acc.account_name}</p>
                        <p className="text-xs text-muted-color capitalize">{platformLabel(acc.platform)}</p>
                        {acc.username && <p className="text-xs text-muted-color">@{acc.username}</p>}
                      </div>
                      <StatusBadge status={acc.status} />
                      {isAdmin && (
                        <Button variant="ghost" size="xs"
                          onClick={() => disconnectAccount(acc.id, acc.platform)}
                          className="text-red-500 hover:bg-red-50"
                        >Disconnect</Button>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === 'team' && (
              team.length === 0 ? (
                <EmptyState title="No team members" description="Grant team members access to this client." />
              ) : (
                <div className="space-y-3">
                  {team.map(member => (
                    <div key={member.id} className="flex items-center gap-3 p-3 bg-surface-secondary rounded-xl">
                      <Avatar name={member.name} src={member.avatar_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary-color">{member.name}</p>
                        <p className="text-xs text-muted-color">{member.email}</p>
                      </div>
                      <Badge variant={member.role === 'admin' ? 'green' : 'default'}>{member.role}</Badge>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <ConnectWizard
        clientId={clientId}
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onSuccess={load}
      />

      {gmbSession && (
        <GmbLocationPicker
          sessionKey={gmbSession.sessionKey}
          clientId={gmbSession.clientId}
          onSuccess={() => { setGmbSession(null); load(); }}
          onClose={() => setGmbSession(null)}
        />
      )}
    </div>
  );
}
