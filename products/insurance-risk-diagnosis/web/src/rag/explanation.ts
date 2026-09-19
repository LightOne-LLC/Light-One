import type { DiagnosisResult, RiskCategoryKey, RiskCategoryResult, RiskLevelLabel } from '../types/diagnosis';
import { NEXT_STEPS } from '../lib/nextSteps';
import { buildEvidenceForCategory, findEvidenceForAssumption } from './evidenceMapping';
import { buildActionEvidence } from './actionEvidence';
import type { ActionEvidence, Evidence, RetrievedSource } from './types';

/*
  Explanation Layer(構造化版)。

  DiagnosisResult(決定論的診断エンジンの出力)+ Evidence(このRAGが検索した出典)だけを
  入力として、LLMを使わずに構造化された説明データを組み立てる。

  設計上の一方向依存:
    DiagnosisResult (read-only) → buildDiagnosisExplanation() → StructuredExplanation

  「LLMなしでも説明が成立する」ことがこのファイルの主眼であり、summary/why等の文字列は
  すべて既存のreasons[]・evidence・NEXT_STEPSの組み合わせでしかない(新しい主張の生成はしない)。

  将来LLMを接続する場合の接続点:
    buildDiagnosisExplanation() が返す StructuredExplanation を唯一の入力として渡す
    LLM関数(例: narrateWithLlm(explanation: StructuredExplanation): Promise<string>)を
    別ファイルとして追加する。LLMは
      - explanation.categories[].why (既存の決定論的reasons。改変禁止)
      - explanation.categories[].evidence / actions[].sources (このRAGが検索した出典。
        これ以外の情報源から制度情報を補完させない)
      - explanation.assumptions (診断エンジン自身の前提開示)
    以外を参照できない。evidenceが空のカテゴリでは、LLMに「出典が無い」ことをそのまま
    伝え、context外の制度知識で埋めさせない(citation-required / source-only)。
*/

export interface ActionExplanation {
  action: string;
  evidence: ActionEvidence['sources'];
}

export interface CategoryExplanation {
  key: RiskCategoryKey;
  label: string;
  score: number;
  level: RiskLevelLabel;
  /** 既存の決定論的診断エンジンが生成したreasons。改変しない */
  why: string[];
  /** このカテゴリの根拠資料のうち、公的制度(Tier1)由来のものだけを抜き出した短い要約行。無ければundefined */
  publicProtectionNote?: string;
  evidence: Evidence[];
  suggestedActions: ActionExplanation[];
}

/** DiagnosisResult.assumptions[]の1行と、それを裏付けるdirect evidence(あれば)。 */
export interface AssumptionExplanation {
  /** 診断エンジンが実際に生成した前提開示文。改変しない */
  text: string;
  evidence: RetrievedSource[];
}

export interface StructuredExplanation {
  categories: CategoryExplanation[];
  /**
   * 診断エンジン自身が開示している前提条件。テキストは
   * DiagnosisResult.assumptions[]をそのまま保持し、evidenceは
   * findEvidenceForAssumption()によるdirect matchのみ(無ければ空配列)。
   */
  assumptions: AssumptionExplanation[];
}

function publicProtectionNoteFor(evidence: Evidence[]): string | undefined {
  const publicSources = evidence.filter((e) => e.source.sourceId.startsWith('public-'));
  if (publicSources.length === 0) return undefined;
  const titles = Array.from(new Set(publicSources.map((e) => e.source.title)));
  return `関連する公的制度: ${titles.join('、')}`;
}

function explainCategoryStructured(category: RiskCategoryResult): CategoryExplanation {
  const evidence = buildEvidenceForCategory(category);
  const actions = NEXT_STEPS[category.key] ?? [];
  const actionEvidence = buildActionEvidence(category.key, actions);

  return {
    key: category.key,
    label: category.label,
    score: category.score,
    level: category.level,
    why: category.reasons,
    publicProtectionNote: publicProtectionNoteFor(evidence),
    evidence,
    suggestedActions: actionEvidence.map((a) => ({ action: a.action, evidence: a.sources })),
  };
}

/**
 * 診断結果全体(DiagnosisResult)から、LLMを使わずに構造化された説明データを組み立てる。
 * DiagnosisResultは読み取り専用として扱い、score/level/reasons/assumptions等を一切変更しない。
 * 将来LLMを接続する場合、このStructuredExplanation 1つが唯一の入力境界となる
 * (カテゴリのwhy/evidenceだけでなく、assumptionsのevidenceもここに集約される)。
 */
export function buildDiagnosisExplanation(result: DiagnosisResult): StructuredExplanation {
  return {
    categories: result.categories.map(explainCategoryStructured),
    assumptions: result.assumptions.map((text) => ({ text, evidence: findEvidenceForAssumption(text) })),
  };
}
