/**
 * 案件の送信元会社(ProjectRecord.sourceCompany)と要員の送信元会社
 * (EngineerRecord.companyName)が同一かどうかを判定する。同一会社から
 * 届いた案件×要員は「自社内」の組み合わせであり、マッチング候補として
 * 出す意味がないため除外対象とする。
 *
 * Parserが抽出した値をそのまま単純な文字列比較するだけで、正規化・
 * 別名判定・大文字小文字や全角/半角の揺れ吸収等は一切行わない。
 * どちらか一方でも会社名が取得できていない場合は「同一ではない」
 * (=除外しない、従来どおりマッチング対象)として扱う。
 */
export function isSameSourceCompany(sourceCompany: string | undefined, companyName: string | undefined): boolean {
  if (!sourceCompany || !companyName) return false;
  return sourceCompany === companyName;
}
