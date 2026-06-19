import { useState, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { authApi } from '../api/auth';
import { Avatar } from '../components/ui/Avatar';
import api from '../api/client';

const API_KEY_FIELDS = [
  { section: 'Meta / Facebook', keys: [
    { key: 'META_APP_ID', label: 'App ID' },
    { key: 'META_APP_SECRET', label: 'App Secret', secret: true },
    { key: 'META_REDIRECT_URI', label: 'Redirect URI' },
  ]},
  { section: 'Cloudflare R2', keys: [
    { key: 'R2_ACCOUNT_ID', label: 'Account ID' },
    { key: 'R2_ACCESS_KEY_ID', label: 'Access Key ID' },
    { key: 'R2_SECRET_ACCESS_KEY', label: 'Secret Access Key', secret: true },
    { key: 'R2_BUCKET_NAME', label: 'Bucket Name' },
    { key: 'R2_PUBLIC_URL', label: 'Public URL' },
  ]},
  { section: 'OpenAI', keys: [
    { key: 'OPENAI_API_KEY', label: 'API Key', secret: true },
  ]},
];

export default function Settings() {
  const { user, clearAuth } = useAuthStore();
  const { theme, set: setTheme } = useThemeStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKeys, setApiKeys] = useState({});
  const [apiLoading, setApiLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});

  useEffect(() => {
    api.get('/settings').then(r => setApiKeys(r.data.settings || {})).catch(() => {});
  }, []);

  const changePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('Password updated. Please log in again.');
      clearAuth();
      window.location.href = '/login';
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally { setLoading(false); }
  };

  const saveApiKeys = async () => {
    setApiLoading(true);
    try {
      await api.put('/settings', { settings: apiKeys });
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally { setApiLoading(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Settings" />

      <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-2xl">
        {/* Profile */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-primary-color mb-4">Profile</h2>
          <div className="flex items-center gap-4 mb-4">
            <Avatar name={user?.name} src={user?.avatar_url} size="xl" />
            <div>
              <p className="text-base font-semibold text-primary-color">{user?.name}</p>
              <p className="text-sm text-muted-color">{user?.email}</p>
              <span className="inline-block mt-1 text-xs bg-brand-green-50 text-brand-green px-2 py-0.5 rounded-full capitalize font-medium">{user?.role}</span>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-primary-color mb-1">API Keys & Integrations</h2>
          <p className="text-xs text-muted-color mb-5">Stored encrypted in DB. Loaded into backend on startup.</p>
          <div className="space-y-6">
            {API_KEY_FIELDS.map(({ section, keys }) => (
              <div key={section}>
                <p className="text-xs font-semibold text-muted-color uppercase tracking-wide mb-3">{section}</p>
                <div className="space-y-3">
                  {keys.map(({ key, label, secret }) => (
                    <div key={key} className="relative">
                      <Input
                        label={label}
                        type={secret && !showSecrets[key] ? 'password' : 'text'}
                        value={apiKeys[key] || ''}
                        onChange={e => setApiKeys(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={secret ? '••••••••' : ''}
                        iconRight={secret ? (
                          <button type="button" onClick={() => setShowSecrets(p => ({ ...p, [key]: !p[key] }))} className="w-full h-full flex items-center justify-center">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              {showSecrets[key]
                                ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
                                : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                              }
                            </svg>
                          </button>
                        ) : undefined}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Button variant="primary" loading={apiLoading} onClick={saveApiKeys} className="mt-5">
            Save API Keys
          </Button>
        </div>

        {/* Appearance */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-primary-color mb-4">Appearance</h2>
          <div className="flex gap-3">
            {['light', 'dark'].map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  theme === t ? 'border-brand-green bg-brand-green-50 text-brand-green' : 'border-color text-secondary-color hover:border-brand-green-100'
                }`}
              >
                {t === 'light' ? '☀️ Light' : '🌙 Dark'}
              </button>
            ))}
          </div>
        </div>

        {/* Change Password */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-primary-color mb-4">Change Password</h2>
          <form onSubmit={changePassword} className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              hint="Minimum 8 characters"
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" loading={loading}>Update Password</Button>
          </form>
        </div>

        {/* About */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-primary-color mb-2">About</h2>
          <p className="text-sm text-muted-color">ODM Scheduler v1.0 — Official Digital Marketing</p>
          <p className="text-xs text-muted-color mt-1">Internal agency tool. Not for client access.</p>
        </div>
      </div>
    </div>
  );
}
