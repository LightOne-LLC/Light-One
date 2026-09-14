import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Nav } from './components/Nav';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { TalentsPage } from './pages/TalentsPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { MatchesPage } from './pages/MatchesPage';
import { ChatPage } from './pages/ChatPage';
import { PhaseManagePage } from './pages/PhaseManagePage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6 text-sm text-slate-500">読み込み中...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { loading } = useAuth();
  if (loading) return <p className="p-6 text-sm text-slate-500">読み込み中...</p>;

  return (
    <>
      <Nav />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/home"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/search"
          element={
            <RequireAuth>
              <SearchPage />
            </RequireAuth>
          }
        />
        <Route
          path="/talents"
          element={
            <RequireAuth>
              <TalentsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/companies"
          element={
            <RequireAuth>
              <CompaniesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/matches"
          element={
            <RequireAuth>
              <MatchesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/matches/:matchId/chat"
          element={
            <RequireAuth>
              <ChatPage />
            </RequireAuth>
          }
        />
        <Route
          path="/matches/:matchId/phase"
          element={
            <RequireAuth>
              <PhaseManagePage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </>
  );
}
