import { describe, test, expect } from 'vitest';
import { runDiagnosis } from '../calc';
import type { DiagnosisInput, RiskCategoryKey } from '../types/diagnosis';
import { buildEvidenceForCategories } from './evidenceMapping';

/*
  7領域それぞれについて、Evidenceが
    - direct(公的制度・モデル前提が実際にこの判定の計算に使われている)
    - related(直接一致は無いが、カテゴリ的に関連する資料がある)
    - 皆無
  のどれになっているかを固定する監査テスト。

  「根拠が無い」ことと「このカテゴリは公的制度ソースを参照していない」ことは異なる。
  assetカテゴリは公的制度を持たない前提で設計されているため、direct evidenceは
  常に0件であることが正しい状態であり、それ自体をここで検証する
  (突然direct一致が出てきた場合は、意図しない誤検出が発生している可能性がある)。
*/

function richInput(): DiagnosisInput {
  return {
    basic: {
      age: 42, gender: 'male', occupationType: 'employee', occupationRisk: 'mid', annualIncome: 650,
      hasSpouse: true, spouseAge: 40, spouseAnnualIncome: 200,
      children: [{ currentAge: 8 }, { currentAge: 3 }], educationCourse: 'public_then_private_univ',
      monthlyLivingExpense: 28,
    },
    asset: { savings: 300, otherAssets: 500, realEstateValue: 3000, hasMortgageLifeInsurance: false, mortgageBalance: 2500, otherLoanBalance: 50 },
    existingInsurance: {
      deathCoverage: 1000, hasMedicalCoverage: true, hasDisabilityCoverage: false, hasSavingsTypeCoverage: false,
      hasCancerCoverage: false, hasCareCoverage: false, hasPersonalPension: true, monthlyPremiumTotal: 2.5,
    },
    health: { hasMedicalHistory: true },
    retirement: { desiredRetirementAge: 65, expectedSeverancePay: 800, desiredMonthlyLivingCost: 22 },
  };
}

// 公的制度(Tier1)のdirect evidenceを実際に持つべき6領域。assetのみ意図的に対象外。
const CATEGORIES_WITH_PUBLIC_DIRECT_EVIDENCE: RiskCategoryKey[] = [
  'death', 'medical', 'disability', 'retirement', 'care', 'inheritance',
];

describe('7領域のEvidence coverage監査', () => {
  const result = runDiagnosis(richInput());
  const evidenceByCategory = buildEvidenceForCategories(result.categories);

  test('7領域すべてについてEvidenceが少なくとも1件は存在する(realisticな入力では"根拠皆無"は発生しない)', () => {
    for (const category of result.categories) {
      const evidence = evidenceByCategory.get(category.key) ?? [];
      expect(evidence.length, `category=${category.key}`).toBeGreaterThan(0);
    }
  });

  test.each(CATEGORIES_WITH_PUBLIC_DIRECT_EVIDENCE)('%sカテゴリはdirect evidence(公的制度またはモデル前提)を持つ', (key) => {
    const category = result.categories.find((c) => c.key === key)!;
    const evidence = evidenceByCategory.get(key) ?? [];
    const direct = evidence.filter((e) => e.relevance === 'direct');
    expect(direct.length, `category=${key} reasons=${JSON.stringify(category.reasons)}`).toBeGreaterThan(0);
  });

  test('assetカテゴリはdirect evidenceを持たない(公的制度ソースを参照しない設計を維持)', () => {
    const evidence = evidenceByCategory.get('asset') ?? [];
    const direct = evidence.filter((e) => e.relevance === 'direct');
    expect(direct).toEqual([]);
  });

  test('assetカテゴリでも、資産形成のモデル前提についてはrelated evidenceを持つ', () => {
    const evidence = evidenceByCategory.get('asset') ?? [];
    expect(evidence.some((e) => e.relevance === 'related')).toBe(true);
  });

  test('少なくとも1領域について、6つの公的制度(Tier1)すべてが一度は登場する', () => {
    const seenPublicSourceIds = new Set<string>();
    for (const [, evidence] of evidenceByCategory) {
      for (const e of evidence) {
        if (e.source.sourceId.startsWith('public-')) seenPublicSourceIds.add(e.source.sourceId);
      }
    }
    const expected = [
      'public-survivor-pension',
      'public-high-cost-medical',
      'public-sick-leave-benefit',
      'public-old-age-pension',
      'public-long-term-care-insurance',
      'public-inheritance-tax-deduction',
    ];
    for (const id of expected) {
      expect(seenPublicSourceIds.has(id), `missing ${id}`).toBe(true);
    }
  });
});
