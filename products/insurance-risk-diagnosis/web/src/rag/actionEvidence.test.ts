import { describe, test, expect } from 'vitest';
import { buildActionEvidence } from './actionEvidence';
import { NEXT_STEPS } from '../lib/nextSteps';

describe('buildActionEvidence', () => {
  test('NEXT_STEPSの内容・件数・順序を一切変更しない', () => {
    const actions = NEXT_STEPS.medical;
    const before = JSON.stringify(actions);
    buildActionEvidence('medical', actions);
    expect(JSON.stringify(actions)).toBe(before);
    expect(JSON.stringify(NEXT_STEPS.medical)).toBe(before);
  });

  test('各アクションについてActionEvidenceを1件ずつ返す(件数が一致)', () => {
    const actions = NEXT_STEPS.death;
    const result = buildActionEvidence('death', actions);
    expect(result).toHaveLength(actions.length);
    expect(result.map((r) => r.action)).toEqual(actions);
  });

  test('高額療養費の確認アクションには高額療養費制度の出典が付く', () => {
    const result = buildActionEvidence('medical', NEXT_STEPS.medical);
    const target = result.find((r) => r.action.includes('高額療養費'));
    expect(target).toBeDefined();
    expect(target?.sources.some((s) => s.sourceId === 'public-high-cost-medical')).toBe(true);
  });

  test('資料が見つからないアクションはsourcesが空配列になる(捏造しない)', () => {
    const result = buildActionEvidence('inheritance', ['xyzzy-nonexistent-term-quux-12345']);
    expect(result).toHaveLength(1);
    expect(result[0].sources).toEqual([]);
  });
});
