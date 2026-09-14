import { Route, Routes } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { UpdateBanner } from './components/UpdateBanner';
import { DashboardPage } from './pages/DashboardPage';
import { EngineersPage } from './pages/EngineersPage';
import { MatchingPage } from './pages/MatchingPage';
import { ProjectsPage } from './pages/ProjectsPage';

export function App() {
  return (
    <>
      <UpdateBanner />
      <main>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/engineers" element={<EngineersPage />} />
          <Route path="/matching" element={<MatchingPage />} />
          <Route path="/matching/:projectId" element={<MatchingPage />} />
        </Routes>
      </main>
      <NavBar />
    </>
  );
}
