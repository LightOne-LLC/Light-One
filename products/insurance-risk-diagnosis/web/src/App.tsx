import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { RequireAuth } from './components/auth/RequireAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingState } from './components/ui';

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DiagnosisFormPage = lazy(() => import('./pages/DiagnosisFormPage').then((m) => ({ default: m.DiagnosisFormPage })));
const ResultPage = lazy(() => import('./pages/ResultPage').then((m) => ({ default: m.ResultPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));

const PAGE_LABEL: Record<string, string> = {
  '/diagnosis': '診断',
  '/history': '履歴',
};

/*
  ヘッダーは機能を増やさず、ブランドの署名として振る舞わせる。
  ワードマーク・製品名・現在地を細い罫線で区切って一列に置き、
  ユーザー情報は右端に最小限の重みで添える。
*/
function Header() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  if (!user) return null;
  const pageLabel = PAGE_LABEL[location.pathname] ?? (location.pathname.startsWith('/result') ? '診断結果' : undefined);

  return (
    <header className="print:hidden sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link to="/history" className="text-[13px] font-semibold tracking-[0.26em] text-navy whitespace-nowrap">
            LIGHT ONE
          </Link>
          <span className="hidden sm:block w-px h-3.5 bg-line-strong shrink-0" aria-hidden="true" />
          <span className="hidden sm:block eyebrow text-ink-faint whitespace-nowrap">Financial Risk Intelligence</span>
          {pageLabel && (
            <>
              <span className="block sm:hidden w-px h-3.5 bg-line-strong shrink-0" aria-hidden="true" />
              <span className="text-[11px] text-ink-muted whitespace-nowrap sm:hidden">{pageLabel}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 sm:gap-5 min-w-0">
          {pageLabel && <span className="hidden sm:block text-[11px] text-ink-muted whitespace-nowrap">{pageLabel}</span>}
          <span className="hidden md:block text-[11px] text-ink-faint truncate max-w-[14rem]">{user.email}</span>
          <button
            onClick={() => signOut()}
            className="text-[11px] text-ink-muted hover:text-navy transition-colors whitespace-nowrap min-h-[44px] px-1"
          >
            ログアウト
          </button>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen page-ground">
      <Header />
      <ErrorBoundary>
        <Suspense fallback={<LoadingState message="読み込み中" />}>
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
      </ErrorBoundary>
    </div>
  );
}
