import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { RequireAuth } from './components/auth/RequireAuth';

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DiagnosisFormPage = lazy(() => import('./pages/DiagnosisFormPage').then((m) => ({ default: m.DiagnosisFormPage })));
const ResultPage = lazy(() => import('./pages/ResultPage').then((m) => ({ default: m.ResultPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));

const PAGE_LABEL: Record<string, string> = {
  '/diagnosis': '診断',
  '/history': '履歴',
};

function Header() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  if (!user) return null;
  const pageLabel = PAGE_LABEL[location.pathname] ?? (location.pathname.startsWith('/result') ? '診断結果' : undefined);
  return (
    <header className="print:hidden border-b border-line bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/diagnosis" className="flex items-baseline gap-2.5">
          <span className="font-semibold tracking-[0.15em] text-sm text-navy">LIGHT ONE</span>
          {pageLabel && <span className="text-xs text-ink-muted hidden sm:inline">/ {pageLabel}</span>}
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-ink-muted hidden sm:inline">{user.email}</span>
          <button onClick={() => signOut()} className="text-ink-muted hover:text-navy transition-colors">
            ログアウト
          </button>
        </div>
      </div>
    </header>
  );
}

function PageFallback() {
  return <p className="text-center text-ink-muted py-8">読み込み中...</p>;
}

export default function App() {
  return (
    <div className="min-h-screen bg-canvas">
      <Header />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/diagnosis"
            element={
              <RequireAuth>
                <DiagnosisFormPage />
              </RequireAuth>
            }
          />
          <Route
            path="/result/:id"
            element={
              <RequireAuth>
                <ResultPage />
              </RequireAuth>
            }
          />
          <Route
            path="/history"
            element={
              <RequireAuth>
                <HistoryPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/diagnosis" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
