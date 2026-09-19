import { describe, test, expect } from 'vitest';
import {
  buildEvidenceForCategory,
  buildEvidenceForCategories,
  findDirectSourcesForReason,
  findEvidenceForAssumption,
} from './evidenceMapping';
import { KNOWLEDGE_BASE } from './knowledgeBase';
import { runDiagnosis } from '../calc';
import type { DiagnosisInput, RiskCategoryResult } from '../types/diagnosis';

function category(overrides: Partial<RiskCategoryResult> = {}): RiskCategoryResult {
  return {
    key: 'medical',
    label: '医療',
    score: 60,
    level: 'high',
    reasons: ['高額療養費制度により、自己負担は月額上限(目安5.76万円)までに抑えられる'],
    ...overrides,
  };
}

describe('buildEvidenceForCategory: direct match', () => {
  test('relatedReasonKeysが実際のreasons文字列に含まれる場合、direct evidenceとして返す', () => {
    const evidence = buildEvidenceForCategory(category());
    const direct = evidence.filter((e) => e.relevance === 'direct');
    expect(direct.length).toBeGreaterThan(0);
    expect(direct.some((e) => e.source.sourceId === 'public-high-cost-medical')).toBe(true);
  });

  test('matchedReasonは診断エンジンが実際に生成したreasons文字列そのものである', () => {
    const reason = '高額療養費制度により、自己負担は月額上限(目安5.76万円)までに抑えられる';
    const evidence = buildEvidenceForCategory(category({ reasons: [reason] }));
    const direct = evidence.find((e) => e.relevance === 'direct');
    expect(direct?.matchedReason).toBe(reason);
  });

  test('遺族基礎年金の簡易概算reasonは、実制度の説明と本モデルの簡略化説明の両方にdirect一致する', () => {
    const reason = '遺族基礎年金(簡易概算): (基本額78万円 + 子加算22.4万円) × 10年 = 1004万円';
    const evidence = buildEvidenceForCategory(category({ key: 'death', label: '死亡', reasons: [reason] }));
    const directIds = evidence.filter((e) => e.relevance === 'direct').map((e) => e.source.sourceId);
    expect(directIds).toContain('public-survivor-pension');
    expect(directIds).toContain('diagnosis-survivor-pension-simplification');
  });

  test('生活防衛資金という語を含むreasonはdisabilityの計算方法説明にdirect一致する', () => {
    const reason = '生活防衛資金 約2.5ヶ月分(貯蓄100万円 ÷ 月間生活費40.0万円)';
    const evidence = buildEvidenceForCategory(category({ key: 'disability', label: '就業不能', reasons: [reason] }));
    expect(evidence.some((e) => e.relevance === 'direct' && e.source.sourceId === 'diagnosis-disability-risk-methodology')).toBe(true);
  });
});

describe('buildEvidenceForCategory: related fallback / no hallucination', () => {
  test('「老後生活費の目安」を含むreasonは老後資金の計算方法説明にdirect一致する', () => {
    const evidence = buildEvidenceForCategory(category({ key: 'retirement', label: '老後', reasons: ['老後生活費の目安: 月20.0万円'] }));
    expect(evidence.some((e) => e.relevance === 'direct' && e.source.sourceId === 'diagnosis-retirement-risk-methodology')).toBe(true);
  });

  test('direct一致フレーズを含まないreasonは、related(keyword)としてのみ補われる', () => {
    // 「現有資産...」という行はどのrelatedReasonKeysとも一致しない一般的な集計行
    const evidence = buildEvidenceForCategory(
      category({ key: 'retirement', label: '老後', reasons: ['現有資産(貯蓄+投資性資産+退職金見込み額): 500.0万円'] }),
    );
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.every((e) => e.relevance === 'related')).toBe(true);
  });

  test('資料が一切無いカテゴリ・reasonでは空配列を返し、存在しない出典を作らない', () => {
    const evidence = buildEvidenceForCategory(
      category({ key: 'asset', label: '資産', reasons: ['xyzzy-nonexistent-term-quux-12345'] }),
    );
    expect(evidence).toEqual([]);
  });

  test('limitを尊重する', () => {
    const evidence = buildEvidenceForCategory(category({ key: 'death', label: '死亡', reasons: ['遺族年金 生活費 教育費 相続'] }), 2);
    expect(evidence.length).toBeLessThanOrEqual(2);
  });

  test('入力のcategoryオブジェクトを変更しない', () => {
    const input = category({ score: 77, level: 'critical', gap: { requiredAmount: 1, publicCoverage: 1, ownAssets: 1, existingInsurance: 1, shortfall: 1 } });
    const before = JSON.stringify(input);
    buildEvidenceForCategory(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('buildEvidenceForCategories', () => {
  test('カテゴリキーごとにEvidence[]を保持するMapを返す', () => {
    const map = buildEvidenceForCategories([category({ key: 'medical' }), category({ key: 'care', label: '介護', reasons: ['介護保険制度により自己負担は原則1割'] })]);
    expect(map.size).toBe(2);
    expect(map.get('care')?.some((e) => e.source.sourceId === 'public-long-term-care-insurance')).toBe(true);
  });
});

describe('findDirectSourcesForReason', () => {
  test('1行のreason文字列から、そのカテゴリに関するdirect一致資料だけを返す', () => {
    const sources = findDirectSourcesForReason('葬儀費用等の一時費用: 200万円', 'death');
    expect(sources.some((s) => s.sourceId === 'diagnosis-death-coverage-methodology')).toBe(true);
  });

  test('一致しないカテゴリ(medical等)を巻き込まない', () => {
    const sources = findDirectSourcesForReason('葬儀費用等の一時費用: 200万円', 'death');
    expect(sources.every((s) => s.category === 'death' || s.category === 'general')).toBe(true);
  });

  test('一致するフレーズが無い場合は空配列(捏造しない)', () => {
    const sources = findDirectSourcesForReason('xyzzy-nonexistent-term-quux-12345', 'death');
    expect(sources).toEqual([]);
  });
});

describe('findEvidenceForAssumption', () => {
  function baseInput(): DiagnosisInput {
    return {
      basic: {
        age: 35, gender: 'male', occupationType: 'employee', occupationRisk: 'low', annualIncome: 600,
        hasSpouse: false, children: [], educationCourse: 'all_public',
      },
      asset: { savings: 200, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 },
      existingInsurance: {
        deathCoverage: 0, hasMedicalCoverage: false, hasDisabilityCoverage: false, hasSavingsTypeCoverage: false,
        hasCancerCoverage: false, hasCareCoverage: false, hasPersonalPension: false, monthlyPremiumTotal: 0,
      },
      health: { hasMedicalHistory: false },
      retirement: { desiredRetirementAge: 65, expectedSeverancePay: 0 },
    };
  }

  test('実際のDiagnosisResult.assumptions[]の全行について出典が見つかる(文言変更の回帰検知)', () => {
    const result = runDiagnosis(baseInput());
    expect(result.assumptions.length).toBeGreaterThan(0);
    for (const assumption of result.assumptions) {
      const sources = findEvidenceForAssumption(assumption);
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every((s) => s.sourceId === 'diagnosis-assumptions-general')).toBe(true);
    }
  });

  test('一致しない前提文には出典を作らない', () => {
    expect(findEvidenceForAssumption('xyzzy-nonexistent-term-quux-12345')).toEqual([]);
  });

  test('関係ないカテゴリの固定フレーズを含む文字列であっても、そのフレーズ自体が実在すれば正しく一致する', () => {
    // findEvidenceForAssumptionはcategory制限を持たないため、
    // assumption以外の文字列を渡しても「そのフレーズを持つ資料」を正しく返す
    // (=文字列の出所ではなくフレーズの有無で判定する、という仕様通りの挙動)
    const sources = findEvidenceForAssumption('高額療養費制度により自己負担は月額上限までに抑えられる');
    expect(sources.some((s) => s.sourceId === 'public-high-cost-medical')).toBe(true);
  });
});

describe('knowledge baseのrelatedReasonKeys健全性', () => {
  test('全エントリがapplicableRiskCategoriesを持つ', () => {
    for (const source of KNOWLEDGE_BASE) {
      expect(Array.isArray(source.applicableRiskCategories)).toBe(true);
      expect(source.applicableRiskCategories.length).toBeGreaterThan(0);
    }
  });

  test('relatedReasonKeysは短すぎる汎用語を含まない(誤検出防止)', () => {
    for (const source of KNOWLEDGE_BASE) {
      for (const key of source.relatedReasonKeys) {
        // 3文字未満(1〜2文字)は他の文脈にも紛れ込みやすいため許可しない。
        // 3文字の'年分:'のようなキーは、当該カテゴリ内で他に一致しうる箇所が
        // 無いことをknowledgeBase.tsのコメントで個別に確認した上で許容している。
        expect(key.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test('assumptions-generalのtagsには汎用語"概算"を含まない(偶発的なrelated一致の防止)', () => {
    const source = KNOWLEDGE_BASE.find((s) => s.sourceId === 'diagnosis-assumptions-general');
    expect(source?.tags).not.toContain('概算');
  });
});
