import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { dummyEngineers, dummyProjects } from '../../demo/dummyData';
import { matchProjectToEngineers } from '../../matching/matchProjectToEngineers';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('SES Matching PWA', () => {
  it('appが起動しDashboardが表示される', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'SES Matching' })).toBeTruthy();
  });

  it('Projects一覧が表示される', () => {
    renderAt('/projects');
    for (const project of dummyProjects) {
      expect(screen.getByText(project.id)).toBeTruthy();
    }
  });

  it('Engineers一覧が表示される', () => {
    renderAt('/engineers');
    for (const engineer of dummyEngineers) {
      expect(screen.getByText(engineer.id)).toBeTruthy();
    }
  });

  it('Matching結果が既存Matching Engineの計算結果通りスコア順で表示される', () => {
    const project = dummyProjects[0];
    renderAt(`/matching/${project.id}`);

    const expected = matchProjectToEngineers(project, dummyEngineers);
    const renderedIds = screen.getAllByText(/^engineer-/).map((el) => el.textContent);
    const renderedScores = document.querySelectorAll('.ranking-score');

    expect(renderedIds).toEqual(expected.map((r) => r.engineerId));
    expect(Array.from(renderedScores).map((el) => Number(el.textContent))).toEqual(expected.map((r) => r.score));
  });
});
