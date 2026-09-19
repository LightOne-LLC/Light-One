import { describe, test, expect } from 'vitest';
import { explainCategory, explainCategories } from './explain';
import type { RiskCategoryResult } from '../types/diagnosis';

function category(overrides: Partial<RiskCategoryResult> = {}): RiskCategoryResult {
  return {
    key: 'medical',
    label: '医療',
    score: 60,
    level: 'high',
    reasons: ['高額療養費制度により自己負担は月額上限までに抑えられる'],
    ...overrides,
  };
}

describe('explainCategory', () => {
  test('retrieved sourceにURL/source metadataが必ず紐づく', () => {
    const explanation = explainCategory(category());
    expect(explanation.sources.length).toBeGreaterThan(0);
    for (const source of explanation.sources) {
      expect(source.sourceId).toBeTruthy();
      expect(source.title).toBeTruthy();
      expect(source.organization).toBeTruthy();
      expect(source.url).toMatch(/^https:\/\//);
    }
  });

  test('hasSupportingSourceがsources件数と整合する', () => {
    const withSources = explainCategory(category());
    expect(withSources.hasSupportingSource).toBe(withSources.sources.length > 0);
  });

  test('資料が見つからない場合はsourcesが空配列になり、存在しない出典を捏造しない', () => {
    // knowledge baseに存在しないカテゴリ相当の、ヒットしうるキーワードを持たない入力
    const explanation = explainCategory(
      category({ key: 'asset', label: '資産形成', reasons: ['xyzzy-nonexistent-term-quux-12345'] }),
    );
    expect(explanation.sources).toEqual([]);
    expect(explanation.hasSupportingSource).toBe(false);
    // 出典が無い場合でも、既存の決定論的reasonsはそのまま保持される(捏造せず、無いものは無いと示す)
    expect(explanation.diagnosisReasons).toEqual(['xyzzy-nonexistent-term-quux-12345']);
  });

  test('diagnosisReasonsは既存の決定論的reasonsをそのまま複製し、改変・追加しない', () => {
    const reasons = ['理由A', '理由B'];
    const explanation = explainCategory(category({ reasons }));
    expect(explanation.diagnosisReasons).toEqual(reasons);
  });

  test('入力のcategoryオブジェクトを変更しない(score/level/gapが不変)', () => {
    const input = category({ score: 33, level: 'medium' });
    const before = JSON.stringify(input);
    explainCategory(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('explainCategories', () => {
  test('複数カテゴリをまとめて処理し、件数が一致する', () => {
    const categories = [
      category({ key: 'death', label: '死亡' }),
      category({ key: 'care', label: '介護', reasons: ['介護保険の自己負担割合'] }),
    ];
    const explanations = explainCategories(categories);
    expect(explanations).toHaveLength(2);
    expect(explanations.map((e) => e.categoryKey)).toEqual(['death', 'care']);
  });
});
