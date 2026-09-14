import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  `font-jp rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
    isActive ? 'bg-accent text-accent-foreground' : 'text-foreground/70 hover:bg-surface-secondary'
  }`;

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  `font-jp flex flex-1 flex-col items-center justify-center gap-1.5 py-3.5 text-[12.5px] font-medium transition-colors ${
    isActive ? 'text-accent' : 'text-muted-foreground'
  }`;

function BrandMark({ size = 8 }: { size?: 7 | 8 }) {
  return (
    <span
      aria-hidden="true"
      className={`flex ${size === 7 ? 'size-7' : 'size-8'} shrink-0 items-center justify-center rounded-lg border border-border bg-accent`}
    >
      <span className="font-mincho text-[12px] font-bold leading-none text-accent-foreground">縁</span>
    </span>
  );
}

export function Nav() {
  const { user, role, signOut } = useAuth();
  if (!user) return null;

  // Mobile keeps the bottom tab bar to 4 destinations: this tab is the
  // user's own profile page (TalentsPage/CompaniesPage only render the
  // editable form when role matches), so it must route by the user's own
  // role, not the opposite — the desktop bar below still shows both links.
  const profileRoute = role === 'talent' ? '/talents' : '/companies';
  const profileLabel = role === 'talent' ? '人材' : '企業';

  return (
    <>
      {/* Mobile: slim top strip — brand + logout only, primary nav lives in the bottom bar */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2 md:hidden">
        <NavLink to="/home" aria-label="ホームへ">
          <BrandMark size={7} />
        </NavLink>
        <button
          onClick={() => signOut()}
          className="font-jp rounded-full border border-border px-3 py-1.5 text-[11px] font-medium text-foreground/70 transition-colors hover:bg-surface-secondary"
        >
          ログアウト
        </button>
      </div>

      {/* Desktop / PC: full top bar */}
      <nav className="hidden border-b border-border bg-surface md:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-1">
            <NavLink to="/home" className="mr-3 flex items-center gap-2">
              <BrandMark />
              <span className="font-mincho text-[14px] font-semibold text-foreground">承継マッチング</span>
            </NavLink>
            <NavLink to="/home" className={desktopLinkClass}>
              ホーム
            </NavLink>
            <NavLink to="/search" className={desktopLinkClass}>
              さがす
            </NavLink>
            <NavLink to="/talents" className={desktopLinkClass}>
              人材
            </NavLink>
            <NavLink to="/companies" className={desktopLinkClass}>
              企業
            </NavLink>
            <NavLink to="/matches" className={desktopLinkClass}>
              マッチング
            </NavLink>
          </div>
          <div className="font-jp flex items-center gap-3 text-[12.5px] text-muted-foreground">
            <span>
              {user.email} ({role === 'talent' ? '人材' : role === 'company' ? '企業' : '未設定'})
            </span>
            <button
              onClick={() => signOut()}
              className="rounded-full border border-border px-3 py-1.5 text-foreground/80 transition-colors hover:bg-surface-secondary"
            >
              ログアウト
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile: fixed bottom tab bar (PWA-friendly primary navigation) */}
      <nav
        aria-label="メインナビゲーション"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-sm md:hidden"
      >
        <div className="flex items-stretch pb-[env(safe-area-inset-bottom)]">
          <NavLink to="/home" className={mobileLinkClass}>
            ホーム
          </NavLink>
          <NavLink to="/search" className={mobileLinkClass}>
            さがす
          </NavLink>
          <NavLink to="/matches" className={mobileLinkClass}>
            マッチング
          </NavLink>
          <NavLink to={profileRoute} className={mobileLinkClass}>
            {profileLabel}
          </NavLink>
        </div>
      </nav>
    </>
  );
}
