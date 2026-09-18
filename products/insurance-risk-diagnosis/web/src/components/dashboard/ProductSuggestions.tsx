export function ProductSuggestions({ types }: { types: string[] }) {
  return (
    <section className="bg-surface rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 mb-1">Suggested Actions</h2>
      <p className="text-sm text-slate-500 mb-6">スコアが高い領域を中心に、検討をおすすめする保障の「種類」です。</p>
      {types.length === 0 ? (
        <p className="text-sm text-slate-500">現時点で緊急に検討すべき保障の種類はありません。</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <span key={t} className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium ring-1 ring-inset ring-indigo-200">
              {t}
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400 mt-4">
        ※特定の保険商品・保険会社を推奨するものではありません。保障の「種類」の目安としてご活用ください。
      </p>
    </section>
  );
}
