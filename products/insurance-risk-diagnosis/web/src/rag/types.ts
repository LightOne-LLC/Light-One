import type { RiskCategoryKey } from '../types/diagnosis';

/*
  RAG(根拠検索)基盤の型定義。

  この基盤は「診断結果を決めるAI」ではなく、「診断結果・制度・計算根拠を
  出典付きで説明するための検索基盤」であることを型レベルでも明確にする。
  - KnowledgeSource: knowledge baseに登録する1件の資料
  - RetrievedSource: 検索によって取得された資料(スコア付き)
  - 生成(LLM)は今回のMVPには含まれない。将来追加する場合も、
    ExplanationProviderが受け取れるのは RetrievedSource[] のみとし、
    それ以外の情報源から回答を補完できない設計にする。
*/

/** 公的制度・診断根拠を分類するカテゴリ。既存の7領域(RiskCategoryKey)に 'general' を加えたもの。 */
export type KnowledgeCategory = RiskCategoryKey | 'general';

/**
 * knowledge baseに登録する1件の資料。
 * 金融・社会保障領域のため、適用条件・金額・上限・期間などを本文(content)に明記し、
 * 版数・取得日・制度の効力発生時点を分けて管理できるようにしている。
 */
export interface KnowledgeSource {
  /** 一意なID。例: 'public-survivor-pension' */
  sourceId: string;
  title: string;
  /** 発行機関(厚生労働省・日本年金機構・全国健康保険協会・国税庁 等) */
  organization: string;
  /** 一次情報(公的機関)のURL。存在しない場合は organization の公式サイトルート */
  url: string;
  category: KnowledgeCategory;
  /** 出典本文。適用条件・対象者・給付条件・金額・上限・期間を含む説明文 */
  content: string;
  /** この資料が対象としている制度の効力発生時点(例: '2024年度(令和6年度)') */
  effectiveDate: string;
  /** この資料をknowledge baseに取り込んだ日付(ISO 8601) */
  retrievedDate: string;
  /** knowledge base内でのこの資料のバージョン。制度改定時にインクリメントする */
  version: string;
  /** 検索用のキーワード。カテゴリラベルや制度名の別名などを含む */
  tags: string[];
  /**
   * この資料が実際に関係する診断カテゴリ(複数可)。'general'資料(前提条件など)は
   * 該当しうる全カテゴリを列挙する。単純なcategoryフィルタより明示的に管理するための項目。
   */
  applicableRiskCategories: RiskCategoryKey[];
  /**
   * 決定論的診断エンジン(web/src/calc)のreasons[]文字列に実際に出現する固定フレーズ。
   * ここに列挙した文字列がRiskCategoryResult.reasonsのいずれかに部分一致した場合、
   * 「キーワード類似」ではなく「この判定の計算過程で直接使われた根拠」として
   * 高い確度で紐付けられる(Evidence Mappingのdirect match)。
   * 診断エンジンのreasons文言が変わった場合はここも追従させる。
   * 該当する固定フレーズが無い資料は空配列とし、無理に一致させない。
   */
  relatedReasonKeys: string[];
  /** その他の補助情報(公開日・更新日が分かる場合のみ設定) */
  metadata?: {
    publishedDate?: string;
    updatedDate?: string;
    [key: string]: string | undefined;
  };
}

/** 検索によって取得された資料。出典情報を必ず伴う。 */
export interface RetrievedSource {
  sourceId: string;
  title: string;
  organization: string;
  url: string;
  category: KnowledgeCategory;
  /** マッチした本文の抜粋(全文ではなく引用に足る範囲) */
  snippet: string;
  /** 検索スコア(大きいほど関連度が高い)。UIでの表示順にのみ使用する */
  score: number;
  effectiveDate: string;
  retrievedDate: string;
  version: string;
}

export interface RagQuery {
  text: string;
  category?: KnowledgeCategory;
  limit?: number;
}

/*
  Evidence Mapping。

  単純なkeyword検索(RagQuery → RetrievedSource[])の上位に位置する概念で、
  「診断結果の特定のreasonが、どの資料によって裏付けられるか」を明示する。
  - relevance 'direct'  : relatedReasonKeysが実際のreasons文字列に一致した高確度の対応
  - relevance 'related' : 直接一致は無いが、カテゴリ・キーワードから関連すると判断した資料
  matchedReasonは常に「診断エンジンが実際に生成した文字列」であり、Evidence Mapping側が
  新しい主張を作ることはない。
*/
export interface Evidence {
  source: RetrievedSource;
  /** この根拠が紐づいた、診断エンジンの実際のreasons[]文字列(またはカテゴリラベル) */
  matchedReason: string;
  relevance: 'direct' | 'related';
  score: number;
}

/** 1つの推奨アクション(NEXT_STEPS)に、どの資料が関連するかを保持する。 */
export interface ActionEvidence {
  action: string;
  sources: RetrievedSource[];
}
