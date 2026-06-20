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

function EditClientModal({ client, isOpen, onClose, onUpdated }) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (client) {
      setName(client.name || '');
      setIndustry(client.industry || '');
      setStatus(client.status || 'active');
    }
  }, [client]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await clientsApi.update(client.id, { name, industry, status });
      toast.success('Client updated');
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update client');
    } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Client" size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={loading} onClick={submit}>Save Changes</Button>
      </>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Client Name" value={name} onChange={e => setName(e.target.value)} required />
        <Input label="Industry" value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. F&B, Healthcare" />
        <div>
          <label className="text-sm font-medium text-primary-color block mb-1.5">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="w-full bg-surface border border-color rounded-lg px-3 py-2 text-sm text-primary-color focus:outline-none focus:ring-2 focus:ring-brand-green"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}

function DeleteClientModal({ client, isOpen, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    setLoading(true);
    try {
      await clientsApi.delete(client.id);
      toast.success(`Client "${client.name}" deleted`);
      onDeleted();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete client');
    } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Client" size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" loading={loading} onClick={confirm}>Delete</Button>
      </>}
    >
      <p className="text-sm text-secondary-color">
        Are you sure you want to delete <strong className="text-primary-color">{client?.name}</strong>? This action cannot be undone.
      </p>
    </Modal>
  );
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [deleteClient, setDeleteClient] = useState(null);
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
                      <div className="flex items-center justify-end gap-2">
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
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => setEditClient(client)}
                        >
                          Edit
                        </Button>
                        <button
                          onClick={() => setDeleteClient(client)}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AddClientModal isOpen={showAdd} onClose={() => setShowAdd(false)} onAdded={load} />
      {editClient && (
        <EditClientModal client={editClient} isOpen={!!editClient} onClose={() => setEditClient(null)} onUpdated={load} />
      )}
      {deleteClient && (
        <DeleteClientModal client={deleteClient} isOpen={!!deleteClient} onClose={() => setDeleteClient(null)} onDeleted={load} />
      )}
    </div>
  );
}
