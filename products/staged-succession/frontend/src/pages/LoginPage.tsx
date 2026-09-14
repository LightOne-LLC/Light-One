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
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-center text-xl font-bold text-slate-900">副業から始める事業承継マッチング</h1>
      <p className="mb-6 text-center text-sm text-slate-500">
        {mode === 'signup' ? 'アカウントを作成してください' : 'ログインしてください'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {mode === 'signup' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">ロール</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRole('talent')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${role === 'talent' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'}`}
              >
                人材として登録
              </button>
              <button
                type="button"
                onClick={() => setRole('company')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${role === 'company' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'}`}
              >
                企業として登録
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">メールアドレス</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">パスワード</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {mode === 'signup' ? '登録する' : 'ログイン'}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
          className="w-full text-center text-xs text-slate-500 underline"
        >
          {mode === 'signup' ? 'すでにアカウントをお持ちの方はこちら' : '新規登録はこちら'}
        </button>
      </form>
    </div>
  );
}
