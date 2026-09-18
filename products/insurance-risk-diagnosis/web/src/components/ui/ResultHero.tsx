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
    <header className="rounded-3xl bg-navy text-white p-8 sm:p-12">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-8 sm:mb-10">
        <p className="text-xs font-semibold tracking-[0.2em] text-gold-ring">LIGHT ONE</p>
        <p className="text-xs text-white/50">{date}</p>
      </div>

      <p className="text-[11px] font-medium tracking-[0.25em] uppercase text-white/50 mb-2">Financial Risk Profile</p>
      <p className="text-sm text-white/70 mb-3">現在のポジション</p>
      <p className="font-display-num text-7xl sm:text-8xl font-bold text-white leading-none">
        {overallScore}
        <span className="text-2xl sm:text-3xl font-medium text-white/40 ml-2">/ 100</span>
      </p>
      <p className="mt-4 text-sm text-white/70 max-w-md">{message}</p>

      {topDomains.length > 0 && (
        <div className="mt-8 sm:mt-10 pt-6 border-t border-gold/30">
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
