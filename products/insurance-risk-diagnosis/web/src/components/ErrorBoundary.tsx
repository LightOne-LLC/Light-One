import { Component } from 'react';
import type { ReactNode } from 'react';
import { Card, Button } from './ui';

/*
  各ページはReact.lazy()で分割配信される。Firebase Hostingへ新しいビルドが
  デプロイされた後、古いタブを開いたままのユーザーが未訪問のページへ遷移すると、
  そのページのチャンクはもう存在せず import() が失敗する
  ("Failed to fetch dynamically imported module" 等)。
  ErrorBoundaryが無いとReactツリー全体がアンマウントされ、白画面のまま
  何も表示されなくなる。ここでは最小限の復旧導線(再読み込みを促す)だけを示す。
  診断ロジック・データには一切関与しない、純粋な表示層のフォールバック。
*/
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint的な意図: ユーザーには何も送信しない。ローカルのconsoleに残すのみ。
    console.error('ページの読み込みに失敗しました:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto px-4 py-16">
          <Card variant="panel" className="text-center">
            <p className="text-[15px] font-medium text-ink mb-2">画面の読み込みに失敗しました</p>
            <p className="text-[13px] leading-relaxed text-ink-muted mb-6">
              アプリが更新された可能性があります。ページを再読み込みしてください。
              入力内容・診断履歴はこの端末に保存されているため失われません。
            </p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              再読み込みする
            </Button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
