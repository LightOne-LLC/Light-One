import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, Button } from '../components/ui';

const VALUE_PROPS = [
  '死亡・医療・就業不能・老後・介護・資産・相続の7つの領域を診断',
  '公的保障を踏まえた「本当の不足額」を可視化',
  '次に何を確認すべきかまで分かる',
];

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      navigate('/diagnosis');
    } catch (err: any) {
      setError(err?.message ?? '認証に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto py-10 sm:py-16 px-4">
      <div className="text-center mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-2">Financial Risk Diagnosis</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-3">保険リスク診断ツール</h1>
        <p className="text-sm text-slate-500">入力に答えるだけで、あなたの家計・保障・将来リスクを整理します。</p>
      </div>

      <ul className="mb-6 space-y-2">
        {VALUE_PROPS.map((v) => (
          <li key={v} className="flex items-start gap-2.5 text-sm text-slate-600">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" aria-hidden="true" />
            <span>{v}</span>
          </li>
        ))}
      </ul>

      <Card as="section" className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1.5">メールアドレス</span>
            <input
              type="email"
              required
              autoComplete="email"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2.5 text-base sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1.5">パスワード</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className="w-full min-h-[44px] rounded-lg border border-slate-300 px-3.5 py-2.5 text-base sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <Button type="submit" variant="primary" disabled={loading} className="w-full">
            {loading ? '処理中...' : mode === 'signin' ? 'ログイン' : 'アカウント作成'}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="w-full min-h-[40px] text-xs text-indigo-600 hover:underline"
          >
            {mode === 'signin' ? 'アカウントをお持ちでない方はこちら' : 'ログイン画面に戻る'}
          </button>
        </form>
      </Card>

      <p className="mt-6 text-center text-xs text-slate-400">
        入力内容はこの端末のブラウザにのみ保存され、サーバーには送信されません。
      </p>
    </div>
  );
}
