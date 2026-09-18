import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Eyebrow } from '../components/ui';

const CREDENTIALS = [
  { value: '7', unit: '領域', label: '死亡・医療・就業不能・老後・介護・資産・相続' },
  { value: '公的', unit: '制度', label: '遺族年金・傷病手当金・高額療養費を前提に計算' },
  { value: '端末', unit: '内', label: '入力内容はサーバーへ送信されません' },
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

  const inputClass =
    'w-full min-h-[48px] rounded-control border border-line bg-surface px-4 py-3 text-base sm:text-[15px] text-ink transition-all duration-200 focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/15';

  return (
    <div className="relative overflow-hidden material-navy min-h-screen flex items-center">
      <div
        className="absolute -top-40 left-1/4 w-[40rem] h-[40rem] rounded-full bg-ice/10 blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-48 -right-32 w-[34rem] h-[34rem] rounded-full bg-white/[0.04] blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative w-full max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
        {/*
          ブランドの主張とサインインを左右に分ける。
          中央1カラムの「ロゴ+フォーム」構成は、どの製品でも同じ顔になるため使わない。
        */}
        <div className="grid gap-14 lg:grid-cols-[1.1fr_minmax(0,25rem)] lg:gap-20 lg:items-center">
          <div>
            <div className="flex items-center gap-3 mb-10">
              <p className="text-xs font-semibold tracking-[0.34em] text-white">LIGHT ONE</p>
              <span className="w-px h-3 bg-white/25" aria-hidden="true" />
              <Eyebrow tone="light">Financial Risk Intelligence</Eyebrow>
            </div>

            <h1 className="text-[32px] sm:text-5xl lg:text-[54px] font-bold tracking-[-0.03em] text-white leading-[1.12]">
              あなたの人生に、
              <br />
              どんな金融リスクがあるか。
            </h1>

            <p className="mt-6 text-[15px] sm:text-lg leading-relaxed text-white/60 max-w-lg">
              保険・資産・老後・介護・保障を、ひとつの視点から整理します。
              商品を売るためではなく、いまの状態を正確に知るための診断です。
            </p>

            <hr className="rule-fade-light mt-10 mb-8" />

            <dl className="grid gap-6 sm:grid-cols-3">
              {CREDENTIALS.map((c) => (
                <div key={c.value}>
                  <dt className="font-display-num text-2xl font-bold text-white">
                    {c.value}
                    <span className="ml-1 text-sm font-medium text-white/40">{c.unit}</span>
                  </dt>
                  <dd className="mt-1.5 text-[11px] leading-relaxed text-white/45">{c.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="w-full">
            <Card variant="feature" as="section" className="shadow-hero">
              <Eyebrow className="mb-5">{mode === 'signin' ? 'Sign in' : 'Create account'}</Eyebrow>

              <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block">
                  <span className="block text-[13px] font-medium text-ink mb-2">メールアドレス</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="block text-[13px] font-medium text-ink mb-2">パスワード</span>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    className={inputClass}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>

                {error && <p className="text-[13px] text-risk-critical" role="alert">{error}</p>}

                <Button type="submit" variant="primary" size="lg" disabled={loading} className="w-full">
                  {loading ? '処理中...' : mode === 'signin' ? '診断をはじめる' : 'アカウント作成'}
                </Button>

                <button
                  type="button"
                  onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                  className="w-full min-h-[40px] text-[11px] text-ink-muted hover:text-navy transition-colors"
                >
                  {mode === 'signin' ? 'アカウントをお持ちでない方はこちら' : 'ログイン画面に戻る'}
                </button>
              </form>
            </Card>

            <p className="mt-7 text-center text-[10px] font-semibold tracking-[0.28em] uppercase text-white/45">
              Private · Secure · Personal
            </p>
            <p className="mt-2.5 text-center text-[11px] leading-relaxed text-white/35">
              入力内容はこの端末のブラウザにのみ保存され、サーバーには送信されません。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
