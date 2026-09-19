import { describe, test, expect } from 'vitest';
import { search, retrieveForCategory } from './retrieval';
import { KNOWLEDGE_BASE } from './knowledgeBase';
import type { RiskCategoryResult } from '../types/diagnosis';

describe('search', () => {
  test('keywordで期待する制度資料が取得できる(遺族年金)', () => {
    const results = search({ text: '遺族年金 死亡' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.sourceId === 'public-survivor-pension')).toBe(true);
  });

  test('keywordで期待する制度資料が取得できる(高額療養費)', () => {
    const results = search({ text: '高額療養費制度の自己負担上限' });
    expect(results.some((r) => r.sourceId === 'public-high-cost-medical')).toBe(true);
  });

  test('keywordで期待する制度資料が取得できる(傷病手当金)', () => {
    const results = search({ text: '傷病手当金' });
    expect(results.some((r) => r.sourceId === 'public-sick-leave-benefit')).toBe(true);
  });

  test('category filterが機能する(careで検索するとdeath領域の資料は返らない)', () => {
    const results = search({ text: '公的保障 制度', category: 'care' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.category === 'care' || r.category === 'general')).toBe(true);
    expect(results.some((r) => r.sourceId === 'public-survivor-pension')).toBe(false);
  });

  test('category filterが機能する(inheritanceで検索すると相続税の資料が返る)', () => {
    const results = search({ text: '相続税 基礎控除', category: 'inheritance' });
    expect(results.some((r) => r.sourceId === 'public-inheritance-tax-deduction')).toBe(true);
  });

  test('source metadataが保持される(sourceId/title/organization/url/effectiveDate/version)', () => {
    const [result] = search({ text: '介護保険制度' });
    expect(result).toBeDefined();
    expect(result.sourceId).toBeTruthy();
    expect(result.title).toBeTruthy();
    expect(result.organization).toBeTruthy();
    expect(result.url).toMatch(/^https:\/\//);
    expect(result.effectiveDate).toBeTruthy();
    expect(result.retrievedDate).toBeTruthy();
    expect(result.version).toBeTruthy();
  });

  test('nonexistent queryで安全にempty resultになる', () => {
    const results = search({ text: 'xyzzy-nonexistent-term-quux-12345' });
    expect(results).toEqual([]);
  });

  test('空文字queryで安全にempty resultになる', () => {
    const results = search({ text: '' });
    expect(results).toEqual([]);
  });

  test('limitを尊重する', () => {
    const results = search({ text: '年金 保障 制度 万円 対象', limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  test('knowledge base内の全エントリがcategory/organization/urlを持つ(データ健全性)', () => {
    for (const source of KNOWLEDGE_BASE) {
      expect(source.sourceId).toBeTruthy();
      expect(source.category).toBeTruthy();
      expect(source.organization).toBeTruthy();
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.content.length).toBeGreaterThan(10);
    }
  });
});

describe('retrieveForCategory', () => {
  function category(overrides: Partial<RiskCategoryResult> = {}): RiskCategoryResult {
    return {
      key: 'death',
      label: '死亡',
      score: 80,
      level: 'critical',
      reasons: ['遺族年金の見込み額を踏まえた必要保障額の試算'],
      ...overrides,
    };
  }

  test('カテゴリのlabel/reasonsから関連資料を検索し、そのカテゴリに関する資料を返す', () => {
    const results = retrieveForCategory(category());
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.category === 'death' || r.category === 'general')).toBe(true);
  });

  test('診断結果(score/level/gap)を一切変更しない', () => {
    const input = category({ score: 42, level: 'medium', gap: { requiredAmount: 100, publicCoverage: 20, ownAssets: 10, existingInsurance: 5, shortfall: 65 } });
    const snapshotBefore = JSON.stringify(input);
    retrieveForCategory(input);
    expect(JSON.stringify(input)).toBe(snapshotBefore);
  });
});
