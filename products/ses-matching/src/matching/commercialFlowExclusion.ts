/**
 * 案件の商流(ProjectRecord.commercialFlow)が「貴社」止まり(これ以上
 * 下流へ流せない=要員とのマッチング対象にできない)ことを示しているか
 * どうかを判定する。
 *
 * commercialFlowは本文全体ではなく、Parser(parseEmail.ts)が「商流：」
 * 「☆商流：」ラベルの直後から抽出した値のみが入るフィールド
 * (例: "貴社まで" "貴社社員まで" "現場→弊社")。そのため、ここで単純に
 * "貴社"を含むかだけを見ても、本文中のよくある挨拶文("貴社様いつも
 * お世話に…")を誤って拾うことはない — 本文全体への文字列検索は行わず、
 * 既存Parserが既に構造化した商流フィールドの意味だけに沿って判定する。
 *
 * 判定前に空白(半角/全角/改行)だけを取り除く — 実データでは
 * "貴社　まで" のような表記揺れが起こり得るため、"貴社"という2文字が
 * 連続している限りは検出できるようにする(文言自体の意味の解釈や、
 * →/＞/⇒等の矢印記号の正規化までは行わない — 単純な部分一致の対象文字列
 * を安定させるだけ)。
 *
 * commercialFlowが未設定の場合は「貴社止まり」と判定しない
 * (除外対象にしない)。
 */
export function isClientOnlyCommercialFlow(commercialFlow: string | undefined): boolean {
  if (!commercialFlow) return false;
  const normalized = commercialFlow.replace(/[\s　]+/g, '');
  return normalized.includes('貴社');
}
