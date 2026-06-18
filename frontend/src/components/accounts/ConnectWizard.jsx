import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { toast } from '../ui/Toast';
import { metaApi } from '../../api/meta';
import { clsx } from 'clsx';

const STEPS = ['auth', 'discovering', 'select', 'success'];

export function ConnectWizard({ clientId, isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState('auth');
  const [sessionKey, setSessionKey] = useState(null);
  const [discovered, setDiscovered] = useState([]);
  const [selected, setSelected] = useState([]);
  const [connected, setConnected] = useState([]);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep('auth');
    setSessionKey(null);
    setDiscovered([]);
    setSelected([]);
    setConnected([]);
    setLoading(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const startOAuth = async () => {
    setLoading(true);
    try {
      const res = await metaApi.getOAuthUrl(clientId);
      const { url } = res.data;

      // Open popup
      const popup = window.open(url, 'meta-oauth', 'width=600,height=700,scrollbars=yes');

      setStep('discovering');
      setLoading(false);

      // Listen for postMessage from the popup
      const handler = async (e) => {
        if (e.data?.type !== 'META_OAUTH') return;
        window.removeEventListener('message', handler);

        if (e.data.error) {
          toast.error(`Connection failed: ${e.data.error}`);
          setStep('auth');
          return;
        }

        const sk = e.data.sessionKey;
        setSessionKey(sk);

        try {
          const r = await metaApi.getDiscovered(sk);
          setDiscovered(r.data.discovered);
          setSelected(r.data.discovered.map(d => d.pageId));
          setStep('select');
        } catch (err) {
          toast.error('Failed to fetch page list');
          setStep('auth');
        }
      };

      window.addEventListener('message', handler);

      // Cleanup if popup closed manually
      const poll = setInterval(() => {
        if (popup?.closed) {
          clearInterval(poll);
          window.removeEventListener('message', handler);
          if (step === 'discovering') setStep('auth');
        }
      }, 1000);
    } catch (err) {
      toast.error('Failed to start OAuth flow');
      setStep('auth');
      setLoading(false);
    }
  };

  const confirmSelection = async () => {
    if (!selected.length) { toast.error('Select at least one account'); return; }
    setLoading(true);
    try {
      const res = await metaApi.connectAccounts({ sessionKey, selectedPageIds: selected, clientId });
      setConnected(res.data.connected);
      setStep('success');
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to connect accounts');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (pageId) => {
    setSelected(prev =>
      prev.includes(pageId) ? prev.filter(id => id !== pageId) : [...prev, pageId]
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" title="Connect Social Accounts">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-6">
        {['Authorize', 'Discover', 'Select', 'Done'].map((label, i) => {
          const stepIndex = STEPS.indexOf(step);
          const isDone = i < stepIndex;
          const isActive = i === stepIndex;
          return (
            <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
              <div className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0',
                isDone ? 'bg-brand-green text-white' :
                isActive ? 'bg-brand-green-50 border-2 border-brand-green text-brand-green' :
                'bg-surface-tertiary text-muted-color'
              )}>
                {isDone ? (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : i + 1}
              </div>
              <span className={clsx('text-xs hidden sm:block', isActive ? 'text-brand-green font-medium' : 'text-muted-color')}>{label}</span>
              {i < 3 && <div className="flex-1 h-px bg-border-color" />}
            </div>
          );
        })}
      </div>

      {/* Step: auth */}
      {step === 'auth' && (
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </div>
          <h3 className="font-semibold text-primary-color mb-2">Connect via Facebook Login</h3>
          <p className="text-sm text-muted-color mb-6 max-w-sm mx-auto">
            We'll open a Facebook login popup. Sign in as the account that manages your client's pages. We'll automatically detect all linked Instagram Business accounts.
          </p>
          <div className="flex flex-col gap-2 text-xs text-muted-color text-left bg-surface-secondary rounded-lg p-3 mb-6">
            <p className="font-medium text-secondary-color">Permissions requested:</p>
            {['Manage your Pages', 'Read Page engagement', 'Publish to Instagram', 'Basic Instagram access'].map(p => (
              <div key={p} className="flex items-center gap-2">
                <svg className="w-3 h-3 text-brand-green flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" d="M5 13l4 4L19 7" /></svg>
                {p}
              </div>
            ))}
          </div>
          <Button variant="primary" size="lg" loading={loading} onClick={startOAuth} className="w-full">
            Continue with Facebook
          </Button>
        </div>
      )}

      {/* Step: discovering */}
      {step === 'discovering' && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full border-4 border-brand-green border-t-transparent animate-spin mx-auto mb-4" />
          <h3 className="font-semibold text-primary-color mb-2">Discovering your pages…</h3>
          <p className="text-sm text-muted-color">Complete the login in the popup window. We're fetching all Pages you manage and checking for linked Instagram accounts.</p>
        </div>
      )}

      {/* Step: select */}
      {step === 'select' && (
        <div>
          <p className="text-sm text-muted-color mb-4">
            Found <strong className="text-primary-color">{discovered.length}</strong> page{discovered.length !== 1 ? 's' : ''}. Select which accounts to connect to this client.
          </p>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {discovered.map(page => (
              <label
                key={page.pageId}
                className={clsx(
                  'flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                  selected.includes(page.pageId)
                    ? 'border-brand-green bg-brand-green-50'
                    : 'border-color hover:border-brand-green-100'
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(page.pageId)}
                  onChange={() => toggleSelect(page.pageId)}
                  className="mt-0.5 accent-brand-green"
                />
                <Avatar src={page.pagePicture} name={page.pageName} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-primary-color">{page.pageName}</p>
                    <Badge variant="blue" className="text-xs">Facebook Page</Badge>
                  </div>
                  {page.igAccount && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <svg className="w-3 h-3 text-purple-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                      </svg>
                      <span className="text-xs text-purple-600 font-medium">@{page.igAccount.username}</span>
                      <Badge variant="purple" className="text-xs">Instagram linked</Badge>
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
          <div className="flex gap-3 mt-5">
            <Button variant="secondary" onClick={() => setStep('auth')}>Back</Button>
            <Button variant="primary" loading={loading} onClick={confirmSelection} className="flex-1">
              Connect {selected.length} account{selected.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}

      {/* Step: success */}
      {step === 'success' && (
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-brand-green-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="font-semibold text-primary-color mb-2">Accounts connected!</h3>
          <p className="text-sm text-muted-color mb-5">The following accounts are now ready to receive posts:</p>
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {connected.map(acc => (
              <div key={acc.id} className="flex items-center gap-2 bg-surface-secondary rounded-full px-3 py-1.5">
                <div className={clsx('w-4 h-4', acc.platform === 'instagram' ? 'text-purple-500' : 'text-blue-600')}>
                  {acc.platform === 'instagram' ? (
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                  )}
                </div>
                <span className="text-xs font-medium text-primary-color">{acc.name}</span>
              </div>
            ))}
          </div>
          <Button variant="primary" onClick={handleClose} className="w-full">Done</Button>
        </div>
      )}
    </Modal>
  );
}
