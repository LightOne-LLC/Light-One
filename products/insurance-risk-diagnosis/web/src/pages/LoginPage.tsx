import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
    <div className="max-w-sm mx-auto py-12 sm:py-16 px-4">
      <p className="text-xs font-semibold tracking-widest uppercase text-slate-400 text-center mb-2">Financial Risk Diagnosis</p>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-6 text-center">保険リスク診断ツール</h1>
      <form onSubmit={handleSubmit} className="bg-surface rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
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
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40"
        >
          {loading ? '処理中...' : mode === 'signin' ? 'ログイン' : 'アカウント作成'}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="w-full min-h-[40px] text-xs text-indigo-600 hover:underline"
        >
          {mode === 'signin' ? 'アカウントをお持ちでない方はこちら' : 'ログイン画面に戻る'}
        </button>
      </form>
    </div>
  );
}
