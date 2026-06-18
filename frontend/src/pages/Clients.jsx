import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { TableSkeleton } from '../components/ui/Skeleton';
import { toast } from '../components/ui/Toast';
import { clientsApi } from '../api/clients';
import { useAuthStore } from '../store/authStore';
import { useClientStore } from '../store/clientStore';

function AddClientModal({ isOpen, onClose, onAdded }) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await clientsApi.create({ name, industry });
      toast.success(`Client "${name}" created`);
      setName(''); setIndustry('');
      onAdded();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create client');
    } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Client" size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={loading} onClick={submit}>Create Client</Button>
      </>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Client Name" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Oslo Cafe" />
        <Input label="Industry" value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. F&B, Healthcare" />
      </form>
    </Modal>
  );
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const navigate = useNavigate();
  const { setClients: storeSetClients } = useAuthStore();
  const { setActiveClient } = useClientStore();

  const load = async () => {
    setLoading(true);
    try {
      const res = await clientsApi.list();
      setClients(res.data.clients);
      storeSetClients(res.data.clients);
    } catch (err) {
      toast.error('Failed to load clients');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Clients"
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
          >
            Add Client
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-6"><TableSkeleton /></div>
          ) : clients.length === 0 ? (
            <EmptyState
              title="No clients yet"
              description="Add your first client to start scheduling posts."
              action={() => setShowAdd(true)}
              actionLabel="Add Client"
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-color">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-color uppercase tracking-wide">Client</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-color uppercase tracking-wide">Industry</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-color uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-color uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clients.map(client => (
                  <tr key={client.id} className="hover:bg-surface-secondary transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={client.name} src={client.logo_url} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-primary-color">{client.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-secondary-color">{client.industry || '—'}</td>
                    <td className="px-5 py-4">
                      <Badge status={client.status} dot>{client.status === 'active' ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          setActiveClient(client.id);
                          navigate(`/clients/${client.id}`);
                        }}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AddClientModal isOpen={showAdd} onClose={() => setShowAdd(false)} onAdded={load} />
    </div>
  );
}
