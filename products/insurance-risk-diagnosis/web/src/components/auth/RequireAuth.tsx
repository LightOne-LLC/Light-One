import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-center text-ink-muted py-8">読み込み中...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
