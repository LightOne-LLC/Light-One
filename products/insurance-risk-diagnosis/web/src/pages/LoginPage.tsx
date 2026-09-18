import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, Button } from '../components/ui';

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
    <div className="max-w-sm mx-auto py-12 sm:py-20 px-4">
      <div className="text-center mb-10">
        <p className="text-xs font-semibold tracking-[0.3em] text-navy mb-1.5">LIGHT ONE</p>
        <p className="text-[10px] font-medium tracking-[0.25em] uppercase text-gold mb-8">Financial Risk Intelligence</p>
        <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-navy leading-snug mb-4">
          あなたの人生に、
          <br />
          どんな金融リスクがあるか。
        </h1>
        <p className="text-sm text-ink-muted leading-relaxed">
          保険・資産・老後・介護・保障を、
          <br />
          ひとつの視点から整理します。
        </p>
      </div>

      <Card as="section" className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-navy mb-1.5">メールアドレス</span>
            <input
              type="email"
              required
              autoComplete="email"
              className="w-full min-h-[44px] rounded-lg border border-line px-3.5 py-2.5 text-base sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-navy mb-1.5">パスワード</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className="w-full min-h-[44px] rounded-lg border border-line px-3.5 py-2.5 text-base sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <Button type="submit" variant="primary" disabled={loading} className="w-full">
            {loading ? '処理中...' : mode === 'signin' ? '診断をはじめる' : 'アカウント作成'}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="w-full min-h-[40px] text-xs text-navy hover:underline"
          >
            {mode === 'signin' ? 'アカウントをお持ちでない方はこちら' : 'ログイン画面に戻る'}
          </button>
        </form>
      </Card>

      <p className="mt-8 text-center text-[11px] tracking-[0.2em] text-ink-muted uppercase">
        Private · Secure · Personal
      </p>
      <p className="mt-2 text-center text-xs text-ink-muted">
        入力内容はこの端末のブラウザにのみ保存され、サーバーには送信されません。
      </p>
    </div>
  );
}
