import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Layout } from './components/layout/Layout';
import { AppToaster } from './components/ui/Toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Compose from './pages/Compose';
import Calendar from './pages/Calendar';
import Posts from './pages/Posts';
import PostDetail from './pages/PostDetail';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Team from './pages/Team';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import Automation from './pages/Automation';

function ProtectedRoute({ children, adminOnly = false }) {
  const { accessToken, user } = useAuthStore();
  if (!accessToken) return <Navigate to="/login" replace />;
  if (adminOnly && user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { accessToken } = useAuthStore();

  return (
    <>
      <Routes>
        <Route path="/login" element={
          accessToken ? <Navigate to="/" replace /> : <Login />
        } />

        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="/compose" element={<Compose />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/posts/:id" element={<PostDetail />} />
          <Route path="/clients" element={
            <ProtectedRoute adminOnly><Clients /></ProtectedRoute>
          } />
          <Route path="/clients/:clientId" element={<ClientDetail />} />
          <Route path="/team" element={
            <ProtectedRoute adminOnly><Team /></ProtectedRoute>
          } />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/automation" element={<Automation />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AppToaster />
    </>
  );
}
