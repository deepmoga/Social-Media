import { useState, useEffect } from 'react';
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
import { useAuthStore } from '../store/authStore';

const PlatformIcon = ({ platform }) => platform === 'instagram' ? (
  <svg className="w-4 h-4 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
) : (
  <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export default function ClientDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [data, setData] = useState(null);
  const [tab, setTab] = useState('accounts');
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await clientsApi.get(clientId);
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load client');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [clientId]);

  const disconnectAccount = async (accountId) => {
    if (!window.confirm('Disconnect this account? Scheduled posts targeting it will fail.')) return;
    try {
      await metaApi.disconnect(accountId);
      toast.success('Account disconnected');
      load();
    } catch (err) {
      toast.error('Failed to disconnect');
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-green border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) return null;
  const { client, accounts, team, stats } = data;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title={client.name}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>Back</Button>
            {isAdmin && (
              <Button variant="primary" size="sm" onClick={() => setShowWizard(true)}
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>}
              >
                Connect Account
              </Button>
            )}
          </>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Stats row */}
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
                  description="Connect Facebook Pages and Instagram accounts to start posting."
                  action={isAdmin ? () => setShowWizard(true) : undefined}
                  actionLabel="Connect Account"
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
                        {acc.username && <p className="text-xs text-muted-color">@{acc.username}</p>}
                        {acc.token_expires_at && (
                          <p className="text-xs text-muted-color">
                            Token expires: {new Date(acc.token_expires_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={acc.status} />
                      {isAdmin && (
                        <Button variant="ghost" size="xs" onClick={() => disconnectAccount(acc.id)}
                          className="text-red-500 hover:bg-red-50"
                        >
                          Disconnect
                        </Button>
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
                      <Badge variant={member.role === 'admin' ? 'green' : 'default'}>
                        {member.role}
                      </Badge>
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
    </div>
  );
}
