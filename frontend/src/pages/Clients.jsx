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
  const [search, setSearch] = useState('');
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
        {/* Search */}
        <div className="mb-4">
          <div className="relative max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-color" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-color bg-surface text-sm text-primary-color placeholder-muted-color focus:outline-none focus:border-brand-green transition-colors"
            />
          </div>
        </div>

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
                {clients.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.industry || '').toLowerCase().includes(search.toLowerCase())).map(client => (
                  <tr key={client.id} className="hover:bg-surface-secondary transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={client.name} src={client.logo_url} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-primary-color">{client.name}</p>
                          {client.platforms?.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              {client.platforms.includes('facebook') && (
                                <span title="Facebook connected">
                                  <svg className="w-3.5 h-3.5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                  </svg>
                                </span>
                              )}
                              {client.platforms.includes('instagram') && (
                                <span title="Instagram connected">
                                  <svg className="w-3.5 h-3.5 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                                  </svg>
                                </span>
                              )}
                            </div>
                          )}
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
