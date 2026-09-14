import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-200'}`;

export function Nav() {
  const { user, role, signOut } = useAuth();
  if (!user) return null;

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2">
        <div className="flex items-center gap-1">
          <span className="mr-3 font-bold text-slate-900">副業→承継マッチング</span>
          <NavLink to="/home" className={linkClass}>
            ホーム
          </NavLink>
          <NavLink to="/search" className={linkClass}>
            さがす
          </NavLink>
          <NavLink to="/talents" className={linkClass}>
            人材
          </NavLink>
          <NavLink to="/companies" className={linkClass}>
            企業
          </NavLink>
          <NavLink to="/matches" className={linkClass}>
            マッチング
          </NavLink>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>
            {user.email} ({role === 'talent' ? '人材' : role === 'company' ? '企業' : '未設定'})
          </span>
          <button onClick={() => signOut()} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100">
            ログアウト
          </button>
        </div>
      </div>
    </nav>
  );
}
