import { useState, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { TableSkeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { usersApi } from '../api/users';
import { clientsApi } from '../api/clients';
import { useAuthStore } from '../store/authStore';

function InviteModal({ isOpen, onClose, onInvited }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await usersApi.create({ name, email, password, role });
      toast.success(`Team member "${name}" added`);
      setName(''); setEmail(''); setPassword(''); setRole('member');
      onInvited();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add team member');
    } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Team Member" size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={loading} onClick={submit}>Add Member</Button>
      </>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} required />
        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Input label="Temporary Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <div>
          <label className="text-sm font-medium text-primary-color block mb-1.5">Role</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full bg-surface border border-color rounded-lg px-3 py-2 text-sm text-primary-color focus:outline-none focus:ring-2 focus:ring-brand-green"
          >
            <option value="member">Team Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}

export default function Team() {
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const { user: me } = useAuthStore();

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, clientsRes] = await Promise.all([usersApi.list(), clientsApi.list()]);
      setUsers(usersRes.data.users);
      setClients(clientsRes.data.clients);
    } catch (err) {
      toast.error('Failed to load team');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const deactivate = async (userId) => {
    if (!window.confirm('Deactivate this user?')) return;
    try {
      await usersApi.deactivate(userId);
      toast.success('User deactivated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const toggleClientAccess = async (userId, clientId, hasAccess) => {
    try {
      if (hasAccess) {
        await clientsApi.revokeAccess(clientId, userId);
      } else {
        await clientsApi.grantAccess(clientId, userId);
      }
      load();
    } catch (err) {
      toast.error('Failed to update access');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Team"
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowInvite(true)}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
          >
            Add Member
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-6"><TableSkeleton /></div>
          ) : users.length === 0 ? (
            <EmptyState title="No team members" description="Add team members to collaborate on client accounts." action={() => setShowInvite(true)} actionLabel="Add Member" />
          ) : (
            users.map(user => (
              <div key={user.id} className="border-b border-color last:border-b-0">
                <div className="flex items-center gap-4 px-5 py-4">
                  <Avatar name={user.name} src={user.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-primary-color">{user.name}</p>
                      {user.id === me?.id && <Badge variant="green" className="text-xs">You</Badge>}
                    </div>
                    <p className="text-xs text-muted-color">{user.email}</p>
                  </div>
                  <Badge variant={user.role === 'admin' ? 'green' : 'default'}>{user.role}</Badge>
                  {!user.is_active && <Badge variant="red">Inactive</Badge>}
                  {user.role !== 'admin' && user.id !== me?.id && (
                    <Button variant="ghost" size="xs" className="text-red-500 hover:bg-red-50" onClick={() => deactivate(user.id)}>
                      Deactivate
                    </Button>
                  )}
                </div>

                {/* Client access for members */}
                {user.role === 'member' && clients.length > 0 && (
                  <div className="px-5 pb-4 ml-14">
                    <p className="text-xs font-medium text-muted-color mb-2">Client Access</p>
                    <div className="flex flex-wrap gap-2">
                      {clients.map(client => {
                        // We'd need the actual access data — simplified toggle here
                        return (
                          <span key={client.id} className="text-xs bg-surface-secondary border border-color px-2 py-1 rounded-full text-secondary-color">
                            {client.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <InviteModal isOpen={showInvite} onClose={() => setShowInvite(false)} onInvited={load} />
    </div>
  );
}
