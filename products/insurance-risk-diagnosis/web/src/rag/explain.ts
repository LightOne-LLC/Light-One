import type { RiskCategoryResult } from '../types/diagnosis';
import { buildEvidenceForCategory } from './evidenceMapping';
import type { RetrievedSource } from './types';

/*
  Explanation Layer。

  責務は「制度・保障・診断根拠に関する情報を検索し、出典付きで説明すること」のみ。
  ここには以下を絶対に行わせない:
    - スコア・必要保障額・判定レベルの計算や書き換え(引数のcategoryは読み取り専用として扱う)
    - retrieved sourcesの本文にない主張の追加(citation-required / source-only)
  本MVPではLLMを一切使用しない。説明は「既存の決定論的reasons」+「検索でヒットしたsourceの
  snippet」をそのまま組み合わせるだけの決定論的な処理であり、常に再現可能。

  将来LLMを追加する場合の接続点:
    このファイルの explainCategory() が返す Explanation { diagnosisReasons, sources } を
    唯一の入力として渡すLLM呼び出し(例: explainCategoryWithLlm(explanation): Promise<string>)を
    別ファイル(例: llmExplainer.ts)として追加する。LLMには
      - diagnosisReasons(既存の決定論的根拠。改変してはならない)
      - sources(このRAGが検索した出典。これ以外の情報源を使わせない)
    以外を渡さず、「この結果を説明してください」という用途に限定する。
    sources が空の場合はLLMを呼ばずに「出典が見つからなかった」ことをそのまま示す
    (context外の制度情報をLLMに補完させない)。
*/

export interface Explanation {
  categoryKey: RiskCategoryResult['key'];
  categoryLabel: string;
  /** 既存の決定論的診断エンジンが生成したreasons。ここでは一切改変しない */
  diagnosisReasons: string[];
  /** 出典付きの根拠資料。空配列の場合は「根拠資料が見つからなかった」ことを示す */
  sources: RetrievedSource[];
  /** sourcesが1件も見つからなかったか */
  hasSupportingSource: boolean;
}

/**
 * 診断結果の1カテゴリについて、根拠付きの説明を生成する。
 * LLMを使わず、Evidence Mapping(evidenceMapping.ts)の結果をそのまま添付するだけの決定論的な処理。
 * sourcesが空でも diagnosisReasons(既存の決定論的根拠)は必ず返す — 「出典が無ければ何も説明しない」
 * のではなく、「出典が無い場合はそれを明示した上で、診断ロジック自身の根拠のみを示す」。
 */
export function explainCategory(category: RiskCategoryResult): Explanation {
  const sources = buildEvidenceForCategory(category).map((e) => e.source);
  return {
    categoryKey: category.key,
    categoryLabel: category.label,
    diagnosisReasons: category.reasons,
    sources,
    hasSupportingSource: sources.length > 0,
  };
}

export function explainCategories(categories: RiskCategoryResult[]): Explanation[] {
  return categories.map(explainCategory);
}
