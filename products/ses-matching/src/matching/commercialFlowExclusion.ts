/**
 * 案件の商流(ProjectRecord.commercialFlow)が「貴社」止まり(これ以上
 * 下流へ流せない=要員とのマッチング対象にできない)ことを示しているか
 * どうかを判定する。
 *
 * commercialFlowは本文全体ではなく、Parser(parseEmail.ts)が「商流：」
 * 「☆商流：」ラベルの直後から抽出した値のみが入るフィールド
 * (例: "貴社まで" "現場→弊社")。そのため、ここで単純に"貴社"を含むか
 * だけを見ても、本文中のよくある挨拶文("貴社様いつもお世話に…")を
 * 誤って拾うことはない — 本文全体への文字列検索は行わず、既存Parserが
 * 既に構造化した商流フィールドの意味だけに沿って判定する。
 *
 * commercialFlowが未設定の場合は「貴社止まり」と判定しない
 * (除外対象にしない)。
 */
export function isClientOnlyCommercialFlow(commercialFlow: string | undefined): boolean {
  if (!commercialFlow) return false;
  return commercialFlow.includes('貴社');
}
