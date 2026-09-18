import { Route, Routes } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { UpdateBanner } from './components/UpdateBanner';
import { WorkspaceStatusBanner } from './components/WorkspaceStatusBanner';
import { DashboardPage } from './pages/DashboardPage';
import { EngineerDetailPage } from './pages/EngineerDetailPage';
import { EngineersPage } from './pages/EngineersPage';
import { MatchingPage } from './pages/MatchingPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { WorkspaceProvider } from './workspaceContext';

export function App() {
  return (
    <WorkspaceProvider>
      <UpdateBanner />
      <main>
        <WorkspaceStatusBanner />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/engineers" element={<EngineersPage />} />
          <Route path="/matching" element={<MatchingPage />} />
          <Route path="/matching/:projectId" element={<MatchingPage />} />
          <Route path="/matching/:projectId/engineer/:engineerId" element={<EngineerDetailPage />} />
        </Routes>
      </main>
      <NavBar />
    </WorkspaceProvider>
  );
}
