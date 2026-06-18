import { useState } from 'react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { authApi } from '../api/auth';
import { Avatar } from '../components/ui/Avatar';

export default function Settings() {
  const { user, setAuth, clearAuth } = useAuthStore();
  const { theme, set: setTheme } = useThemeStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
