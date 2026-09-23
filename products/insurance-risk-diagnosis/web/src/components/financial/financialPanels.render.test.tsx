// resultPanels.render.test.tsx と同じ方針: jsdomを使わず、Reactのサーバーレンダリングで
// 実際の診断結果を渡し、レンダリング時に例外が発生しないことを検証する。
import { describe, test, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { runDiagnosis, emptyDiagnosisInput } from '../../calc';
import type { DiagnosisInput } from '../../types/diagnosis';
import { buildDiagnosisExplanation } from '../../rag';
import {
  buildFinancialProfile, buildFinancialSnapshot, buildFinancialIntelligence, compareSnapshots,
} from '../../financial';
import { FinancialProfileReport } from './FinancialProfileReport';
import { ChangeOverTimeSection } from './ChangeOverTimeSection';

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

describe('FinancialProfileReport - 実データでのレンダリング検証', () => {
  test('履歴1件(比較対象なし)でもクラッシュせず、主要セクションを表示する', () => {
    const input = richInput();
    const result = runDiagnosis(input);
    const profile = buildFinancialProfile(input, result);
    const snapshot = buildFinancialSnapshot({ id: 'a', createdAt: '2026-09-24T00:00:00.000Z', input, result });
    const evidence = buildDiagnosisExplanation(result);
    const intelligence = buildFinancialIntelligence(profile, result, [snapshot], evidence);

    const html = renderToStaticMarkup(
      <MemoryRouter><FinancialProfileReport intelligence={intelligence} resultId="a" /></MemoryRouter>,
    );
    expect(html).toContain('Financial Profile');
    expect(html).toContain('Balance Sheet');
    expect(html).toContain('Cash Flow');
    expect(html).toContain('Protection Gap');
  });

  test('履歴が2件以上ある場合、「前回からの変化」セクションを表示する', () => {
    const previousInput = richInput();
    previousInput.asset.savings = 100;
    const previousResult = runDiagnosis(previousInput);
    const previous = buildFinancialSnapshot({ id: 'a', createdAt: '2026-08-01T00:00:00.000Z', input: previousInput, result: previousResult });

    const currentInput = richInput();
    currentInput.asset.savings = 500;
    const currentResult = runDiagnosis(currentInput);
    const current = buildFinancialSnapshot({ id: 'b', createdAt: '2026-09-24T00:00:00.000Z', input: currentInput, result: currentResult });

    const profile = buildFinancialProfile(currentInput, currentResult);
    const evidence = buildDiagnosisExplanation(currentResult);
    const intelligence = buildFinancialIntelligence(profile, currentResult, [current, previous], evidence);

    const html = renderToStaticMarkup(
      <MemoryRouter><FinancialProfileReport intelligence={intelligence} resultId="b" /></MemoryRouter>,
    );
    expect(html).toContain('前回からの変化');
  });

  test('未入力項目がある場合、Missing Informationを表示する', () => {
    const input = richInput();
    input.basic.monthlyLivingExpense = undefined;
    const result = runDiagnosis(input);
    const profile = buildFinancialProfile(input, result);
    const snapshot = buildFinancialSnapshot({ id: 'a', createdAt: 'now', input, result });
    const evidence = buildDiagnosisExplanation(result);
    const intelligence = buildFinancialIntelligence(profile, result, [snapshot], evidence);

    const html = renderToStaticMarkup(
      <MemoryRouter><FinancialProfileReport intelligence={intelligence} resultId="a" /></MemoryRouter>,
    );
    expect(html).toContain('月間生活費');
  });

  test('空データ(emptyDiagnosisInput)でもクラッシュしない', () => {
    const input = emptyDiagnosisInput();
    const result = runDiagnosis(input);
    const profile = buildFinancialProfile(input, result);
    const snapshot = buildFinancialSnapshot({ id: 'a', createdAt: 'now', input, result });
    const evidence = buildDiagnosisExplanation(result);
    const intelligence = buildFinancialIntelligence(profile, result, [snapshot], evidence);

    expect(() => renderToStaticMarkup(
      <MemoryRouter><FinancialProfileReport intelligence={intelligence} resultId="a" /></MemoryRouter>,
    )).not.toThrow();
  });
});

describe('ChangeOverTimeSection - 実データでのレンダリング検証', () => {
  test('総合スコア・カテゴリ変化を表示する', () => {
    const previousInput = richInput();
    previousInput.asset.savings = 100;
    const previous = buildFinancialSnapshot({ id: 'a', createdAt: '2026-08-01T00:00:00.000Z', input: previousInput, result: runDiagnosis(previousInput) });

    const currentInput = richInput();
    currentInput.asset.savings = 500;
    const current = buildFinancialSnapshot({ id: 'b', createdAt: '2026-09-24T00:00:00.000Z', input: currentInput, result: runDiagnosis(currentInput) });

    const changes = compareSnapshots(previous, current);
    const html = renderToStaticMarkup(<ChangeOverTimeSection changes={changes} />);
    expect(html).toContain('Change Over Time');
    expect(html).toContain('総合スコア');
  });

  test('空のchanges配列でもクラッシュしない', () => {
    expect(() => renderToStaticMarkup(<ChangeOverTimeSection changes={[]} />)).not.toThrow();
  });
});
