// Result画面の最上部。深いネイビー地にアイボリーの数字を大胆に見せる、プロダクトの「顔」となるHero。
// 視線誘導: ブランド → ラベル → 総合スコア(主役) → 短い説明 → 重点確認領域(gold区切り線の下)
export function ResultHero({
  overallScore, message, date, topDomains,
}: {
  overallScore: number;
  message: string;
  date: string;
  topDomains: string[];
}) {
  return (
    <header className="relative overflow-hidden rounded-3xl material-navy text-white p-8 sm:p-12">
      <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-ice/10 blur-3xl pointer-events-none" aria-hidden="true" />

      <div className="relative flex items-center justify-between flex-wrap gap-2 mb-8 sm:mb-10">
        <p className="text-xs font-semibold tracking-[0.2em] text-gold-ring">LIGHT ONE</p>
        <p className="text-xs text-white/50">{date}</p>
      </div>

      <p className="relative text-[11px] font-medium tracking-[0.25em] uppercase text-white/50 mb-2">Financial Risk Profile</p>
      <p className="relative text-sm text-white/70 mb-3">現在のポジション</p>
      <p className="relative font-display-num text-7xl sm:text-8xl font-bold text-white leading-none">
        {overallScore}
        <span className="text-2xl sm:text-3xl font-medium text-white/40 ml-2">/ 100</span>
      </p>
      <p className="relative mt-4 text-sm text-white/70 max-w-md">{message}</p>

      {topDomains.length > 0 && (
        <div className="relative mt-8 sm:mt-10 pt-6 hairline-light">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-gold-ring mb-3">重点確認領域</p>
          <ol className="flex flex-wrap gap-x-6 gap-y-2">
            {topDomains.map((label, i) => (
              <li key={label} className="text-sm text-white/90 flex items-baseline gap-2">
                <span className="text-xs text-gold-ring font-medium tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                {label}
              </li>
            ))}
          </ol>
        </div>
      )}
    </header>
  );
}
