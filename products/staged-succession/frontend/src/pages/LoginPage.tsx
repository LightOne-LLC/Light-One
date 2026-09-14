import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('talent');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password, role);
      } else {
        await signIn(email, password);
      }
      navigate('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="noren-stripes flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        {/* brand mark */}
        <div className="animate-noren-rise mb-8 flex flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-xl border border-border bg-accent shadow-card"
          >
            <span className="font-mincho text-[19px] font-bold leading-none text-accent-foreground">縁</span>
          </span>
          <h1 className="font-mincho mt-4 text-[22px] font-semibold leading-tight text-foreground">
            副業から始める事業承継マッチング
          </h1>
          <p className="font-jp mt-2 text-[13px] text-muted-foreground">
            {mode === 'signup' ? 'アカウントを作成してください' : 'ログインしてください'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="animate-noren-scale-in space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-card"
        >
          {mode === 'signup' && (
            <div>
              <label className="font-jp mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                ロール
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRole('talent')}
                  className={`font-jp flex-1 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-colors ${
                    role === 'talent'
                      ? 'border-transparent bg-accent text-accent-foreground shadow-card'
                      : 'border-border bg-surface text-foreground/80 hover:bg-surface-secondary'
                  }`}
                >
                  人材として登録
                </button>
                <button
                  type="button"
                  onClick={() => setRole('company')}
                  className={`font-jp flex-1 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-colors ${
                    role === 'company'
                      ? 'border-transparent bg-accent text-accent-foreground shadow-card'
                      : 'border-border bg-surface text-foreground/80 hover:bg-surface-secondary'
                  }`}
                >
                  企業として登録
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="font-jp mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              メールアドレス
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="font-jp w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition-colors focus:border-accent"
            />
          </div>
          <div>
            <label className="font-jp mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              パスワード
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-jp w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-foreground outline-none transition-colors focus:border-accent"
            />
          </div>

          {error && <p className="font-jp text-[12.5px] text-danger">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="font-jp w-full rounded-full bg-accent px-3 py-3 text-[14px] font-semibold text-accent-foreground shadow-card transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mode === 'signup' ? '登録する' : 'ログイン'}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
            className="font-jp w-full text-center text-[12px] text-muted-foreground underline-offset-4 hover:text-accent hover:underline"
          >
            {mode === 'signup' ? 'すでにアカウントをお持ちの方はこちら' : '新規登録はこちら'}
          </button>
        </form>
      </div>
    </div>
  );
}
