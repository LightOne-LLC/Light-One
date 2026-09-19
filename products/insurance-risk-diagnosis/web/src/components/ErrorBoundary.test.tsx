import { describe, test, expect } from 'vitest';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErrorBoundary } from './ErrorBoundary';

/*
  react-dom/serverのrenderToStaticMarkup(同期・レガシーSSR API)はerror boundaryの
  捕捉をサポートしておらず、子が投げた例外はそのまま伝播してテストが落ちてしまう
  (実際のブラウザでのクライアントレンダリングでは正しく捕捉される)。
  このプロジェクトにjsdom/testing-libraryは無いため、getDerivedStateFromError()と
  render()を直接呼び出し、React自身のcatch経路を経由せずにロジックを検証する。
*/
describe('ErrorBoundary', () => {
  test('子コンポーネントが正常な場合はそのまま描画する', () => {
    const html = renderToStaticMarkup(
      <ErrorBoundary>
        <p>正常なコンテンツ</p>
      </ErrorBoundary>,
    );
    expect(html).toContain('正常なコンテンツ');
  });

  test('getDerivedStateFromErrorはhasError:trueを返す(componentDidCatchと合わせてReactの標準的なcatch経路)', () => {
    const state = ErrorBoundary.getDerivedStateFromError();
    expect(state).toEqual({ hasError: true });
  });

  test('hasError状態では、白画面ではなく復旧導線(再読み込み)を描画する', () => {
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { hasError: true };
    const html = renderToStaticMarkup(boundary.render() as ReactElement);
    expect(html).toContain('読み込みに失敗しました');
    expect(html).toContain('再読み込みする');
    // 診断データが失われないことを明示している
    expect(html).toContain('診断履歴はこの端末に保存されているため失われません');
  });
});
