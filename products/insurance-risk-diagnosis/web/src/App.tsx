import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { RequireAuth } from './components/auth/RequireAuth';

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DiagnosisFormPage = lazy(() => import('./pages/DiagnosisFormPage').then((m) => ({ default: m.DiagnosisFormPage })));
const ResultPage = lazy(() => import('./pages/ResultPage').then((m) => ({ default: m.ResultPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));

function Header() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return (
    <header className="print:hidden border-b border-slate-200 bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/60">
      <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/diagnosis" className="font-semibold tracking-tight text-slate-900">
          Financial Risk Diagnosis
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400 hidden sm:inline">{user.email}</span>
          <button onClick={() => signOut()} className="text-slate-500 hover:text-slate-800 transition-colors">
            ログアウト
          </button>
        </div>
      </div>
    </header>
  );
}

function PageFallback() {
  return <p className="text-center text-slate-500 py-8">読み込み中...</p>;
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
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
