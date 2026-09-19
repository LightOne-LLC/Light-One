/**
 * 実Gmail取り込みデータの案件名/人材名を解決する共通ヘルパー。
 * 名前(projectName/engineerName)が取得できていればそれを、無ければ
 * 内部ID(Gmail message id由来の不透明な識別子)を安全な文言で補う
 * フォールバックを行う。内部IDはリンク・API・デバッグ用としてそのまま
 * 保持し、削除・変更はしない — ここは表示専用の判断のみを行う。
 *
 * dummy data(project-1のような既に可読なid)はuseReal=falseとして渡す
 * ことで、このフォールバックを適用せずidをそのまま返す(既存のdummy
 * regressionの見た目を一切変えないため)。
 */
export function resolveDisplayName(
  kind: 'project' | 'engineer',
  id: string,
  name: string | undefined,
  useReal: boolean,
): string {
  if (!useReal) return id;
  if (name) return name;
  return kind === 'project' ? `案件ID: ${id}` : `人材ID: ${id}`;
}
