/**
 * 作成日時降順(新しい順)に並んだレコード配列から、指定したidのレコードを先頭に、
 * それより古いレコードだけを時系列順(新しい→古い)に並べ直す。
 *
 * buildFinancialIntelligence()は「history[0]=表示中の診断・history[1]=その直前の診断」を
 * 前提とするため、ユーザーが最新以外の過去の診断(Financial Profile)を開いた場合でも、
 * 「直前」が実際にその診断の直前に行われたものになるようにする。
 * (表示中の診断を単に配列の先頭に差し替えるだけだと、history[1]が常に「全体で最新の記録」に
 *  なってしまい、最新以外の記録を見ているときは時系列が逆転した比較になってしまう)
 *
 * 該当idが見つからない場合はnullを返す(存在しない記録を捏造しない)。
 */
export function orderRecordsFromCurrent<T extends { id: string }>(
  recordsNewestFirst: T[],
  currentId: string,
): T[] | null {
  const currentIndex = recordsNewestFirst.findIndex((r) => r.id === currentId);
  if (currentIndex === -1) return null;
  return recordsNewestFirst.slice(currentIndex);
}
