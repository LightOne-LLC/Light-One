import { describe, test, expect } from 'vitest';
import { runDiagnosis } from './index';
import type { DiagnosisInput } from '../types/diagnosis';

function baseInput(overrides: Partial<DiagnosisInput> = {}): DiagnosisInput {
  return {
    basic: {
      age: 35,
      gender: 'male',
      occupationType: 'employee',
      occupationRisk: 'low',
      annualIncome: 600,
      hasSpouse: false,
      children: [],
      educationCourse: 'all_public',
      ...overrides.basic,
    },
    asset: {
      savings: 200,
      otherAssets: 0,
      realEstateValue: 0,
      hasMortgageLifeInsurance: true,
      mortgageBalance: 0,
      otherLoanBalance: 0,
      ...overrides.asset,
    },
    existingInsurance: {
      deathCoverage: 0,
      hasMedicalCoverage: false,
      hasDisabilityCoverage: false,
      hasSavingsTypeCoverage: false,
      hasCancerCoverage: false,
      hasCareCoverage: false,
      hasPersonalPension: false,
      monthlyPremiumTotal: 0,
      ...overrides.existingInsurance,
    },
    health: {
      hasMedicalHistory: false,
      ...overrides.health,
    },
    retirement: {
      desiredRetirementAge: 65,
      expectedSeverancePay: 0,
      ...overrides.retirement,
    },
  };
}

describe('runDiagnosis - 家族構成パターン(死亡リスク)', () => {
  test('独身・子供なし: 遺族生活費と教育費が発生しない', () => {
    const result = runDiagnosis(baseInput());
    expect(result.deathCoverage.breakdown.phaseALivingCost).toBe(0);
    expect(result.deathCoverage.breakdown.phaseBLivingCost).toBe(0);
    expect(result.deathCoverage.breakdown.educationTotal).toBe(0);
    // 葬儀費用のみ、貯蓄200万円で相殺され0円になる想定
    expect(result.deathCoverage.requiredAmount).toBe(0);
  });

  test('夫婦のみ(子供なし): Phase Bのみ発生しPhase Aは0', () => {
    const result = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33 } as any,
    }));
    expect(result.deathCoverage.breakdown.phaseAYears).toBe(0);
    expect(result.deathCoverage.breakdown.phaseBLivingCost).toBeGreaterThan(0);
    expect(result.deathCoverage.breakdown.educationTotal).toBe(0);
  });

  test('夫婦+子供1人(幼児): Phase A・教育費ともに発生', () => {
    const result = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33, children: [{ currentAge: 2 }] } as any,
    }));
    expect(result.deathCoverage.breakdown.phaseAYears).toBe(20); // 22 - 2
    expect(result.deathCoverage.breakdown.educationTotal).toBeGreaterThan(0);
    expect(result.deathCoverage.requiredAmount).toBeGreaterThan(0);
  });

  test('夫婦+子供2人(小学生・高校生): 教育費は残り年数のみ按分計上', () => {
    const result = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 40, children: [{ currentAge: 8 }, { currentAge: 16 }] } as any,
    }));
    const breakdown = result.deathCoverage.breakdown.educationBreakdown;
    // 高校生(16歳)は幼稚園・小学校・中学校のステージが計上されない
    expect(breakdown.some((b) => b.childIndex === 1 && b.stage === '幼稚園')).toBe(false);
    expect(breakdown.some((b) => b.childIndex === 1 && b.stage === '高校')).toBe(true);
    expect(breakdown.some((b) => b.childIndex === 0 && b.stage === '小学校')).toBe(true);
  });

  test('ひとり親+子供1人: 配偶者なしでもPhase Aと教育費・遺族基礎年金は発生', () => {
    const result = runDiagnosis(baseInput({
      basic: { hasSpouse: false, children: [{ currentAge: 5 }] } as any,
    }));
    expect(result.deathCoverage.breakdown.phaseALivingCost).toBeGreaterThan(0);
    expect(result.deathCoverage.breakdown.phaseBLivingCost).toBe(0); // 配偶者がいないためPhase Bはなし
    expect(result.deathCoverage.breakdown.survivorPensionTotal).toBeGreaterThan(0);
  });

  test('資産が十分なケース: 必要保障額は0円未満にならず0になる', () => {
    const result = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 60, children: [] } as any,
      asset: { savings: 10000, otherAssets: 10000, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 },
    }));
    expect(result.deathCoverage.requiredAmount).toBe(0);
    expect(result.deathCoverage.riskScore).toBe(0);
  });

  test('団信未加入の住宅ローンは必要保障額に上乗せされる', () => {
    const withMortgage = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33, children: [{ currentAge: 5 }] } as any,
      asset: { savings: 200, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: false, mortgageBalance: 2000, otherLoanBalance: 0 },
    }));
    const withoutMortgage = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33, children: [{ currentAge: 5 }] } as any,
      asset: { savings: 200, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 2000, otherLoanBalance: 0 },
    }));
    expect(withMortgage.deathCoverage.requiredAmount).toBeGreaterThan(withoutMortgage.deathCoverage.requiredAmount);
  });

  test('その他借入残高も必要保障額に上乗せされる', () => {
    const withLoan = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33, children: [{ currentAge: 5 }] } as any,
      asset: { savings: 200, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 500 },
    }));
    const withoutLoan = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33, children: [{ currentAge: 5 }] } as any,
    }));
    expect(withLoan.deathCoverage.requiredAmount).toBeGreaterThan(withoutLoan.deathCoverage.requiredAmount);
  });

  test('配偶者自身の収入があると必要保障額が減る', () => {
    const withSpouseIncome = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33, spouseAnnualIncome: 400, children: [{ currentAge: 5 }] } as any,
    }));
    const withoutSpouseIncome = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33, children: [{ currentAge: 5 }] } as any,
    }));
    expect(withSpouseIncome.deathCoverage.requiredAmount).toBeLessThan(withoutSpouseIncome.deathCoverage.requiredAmount);
  });

  test('自営業は遺族厚生年金が発生しない分、会社員より必要保障額が大きい', () => {
    const employee = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33, occupationType: 'employee', children: [{ currentAge: 5 }] } as any,
    }));
    const selfEmployed = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33, occupationType: 'self_employed', children: [{ currentAge: 5 }] } as any,
    }));
    expect(selfEmployed.deathCoverage.requiredAmount).toBeGreaterThan(employee.deathCoverage.requiredAmount);
  });
});

describe('runDiagnosis - 医療リスク(高額療養費制度考慮)', () => {
  test('年収が高いほど高額療養費の自己負担上限は上がる(=不足しやすい)', () => {
    const lowIncome = runDiagnosis(baseInput({ basic: { annualIncome: 300 } as any, asset: { savings: 0, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 } }));
    const highIncome = runDiagnosis(baseInput({ basic: { annualIncome: 1500 } as any, asset: { savings: 0, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 } }));
    const lowGap = lowIncome.categories.find((c) => c.key === 'medical')!.gap!;
    const highGap = highIncome.categories.find((c) => c.key === 'medical')!.gap!;
    expect(highGap.requiredAmount).toBeGreaterThan(lowGap.requiredAmount);
  });

  test('既存の医療保険に加入していると不足額が減る', () => {
    const withCoverage = runDiagnosis(baseInput({ existingInsurance: { deathCoverage: 0, hasMedicalCoverage: true, hasDisabilityCoverage: false, hasSavingsTypeCoverage: false, hasCancerCoverage: false, hasCareCoverage: false, hasPersonalPension: false, monthlyPremiumTotal: 0 }, asset: { savings: 0, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 } }));
    const withoutCoverage = runDiagnosis(baseInput({ asset: { savings: 0, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 } }));
    const withGap = withCoverage.categories.find((c) => c.key === 'medical')!.gap!;
    const withoutGap = withoutCoverage.categories.find((c) => c.key === 'medical')!.gap!;
    expect(withGap.shortfall).toBeLessThan(withoutGap.shortfall);
  });
});

describe('runDiagnosis - 就業不能リスク(傷病手当金考慮)', () => {
  test('自営業は傷病手当金の対象外のため、会社員より不足額が大きい', () => {
    const employee = runDiagnosis(baseInput({ basic: { occupationType: 'employee' } as any, asset: { savings: 0, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 } }));
    const selfEmployed = runDiagnosis(baseInput({ basic: { occupationType: 'self_employed' } as any, asset: { savings: 0, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 } }));
    const employeeGap = employee.categories.find((c) => c.key === 'disability')!.gap!;
    const selfEmployedGap = selfEmployed.categories.find((c) => c.key === 'disability')!.gap!;
    expect(selfEmployedGap.shortfall).toBeGreaterThan(employeeGap.shortfall);
  });

  test('就業不能リスクスコアは貯蓄が少ないほど高くなる', () => {
    const lowSavings = runDiagnosis(baseInput({ asset: { savings: 10, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 } }));
    const highSavings = runDiagnosis(baseInput({ asset: { savings: 2000, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 } }));
    expect(lowSavings.disabilityRisk.score).toBeGreaterThan(highSavings.disabilityRisk.score);
  });
});

describe('runDiagnosis - 老後リスク', () => {
  test('自営業は厚生年金がない分、老後の必要額(不足)が会社員より大きくなりやすい', () => {
    const employee = runDiagnosis(baseInput({ basic: { occupationType: 'employee' } as any, asset: { savings: 0, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 } }));
    const selfEmployed = runDiagnosis(baseInput({ basic: { occupationType: 'self_employed' } as any, asset: { savings: 0, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 } }));
    const employeeGap = employee.categories.find((c) => c.key === 'retirement')!.gap!;
    const selfEmployedGap = selfEmployed.categories.find((c) => c.key === 'retirement')!.gap!;
    expect(selfEmployedGap.shortfall).toBeGreaterThan(employeeGap.shortfall);
  });

  test('退職金見込み額が大きいほど老後リスクスコアは下がる', () => {
    const noSeverance = runDiagnosis(baseInput({ retirement: { desiredRetirementAge: 65, expectedSeverancePay: 0 } }));
    const withSeverance = runDiagnosis(baseInput({ retirement: { desiredRetirementAge: 65, expectedSeverancePay: 3000 } }));
    const noSeveranceScore = noSeverance.categories.find((c) => c.key === 'retirement')!.score;
    const withSeveranceScore = withSeverance.categories.find((c) => c.key === 'retirement')!.score;
    expect(withSeveranceScore).toBeLessThanOrEqual(noSeveranceScore);
  });
});

describe('runDiagnosis - 介護リスク', () => {
  test('民間の介護保険に加入していると不足額が減る', () => {
    const withCoverage = runDiagnosis(baseInput({ existingInsurance: { deathCoverage: 0, hasMedicalCoverage: false, hasDisabilityCoverage: false, hasSavingsTypeCoverage: false, hasCancerCoverage: false, hasCareCoverage: true, hasPersonalPension: false, monthlyPremiumTotal: 0 }, asset: { savings: 100, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 } }));
    const withoutCoverage = runDiagnosis(baseInput({ asset: { savings: 100, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 } }));
    const withGap = withCoverage.categories.find((c) => c.key === 'care')!.gap!;
    const withoutGap = withoutCoverage.categories.find((c) => c.key === 'care')!.gap!;
    expect(withGap.shortfall).toBeLessThan(withoutGap.shortfall);
  });
});

describe('runDiagnosis - 資産(流動性)リスク', () => {
  test('緊急予備資金が少ないほど資産リスクスコアが高い', () => {
    const lowFund = runDiagnosis(baseInput({ asset: { savings: 0, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 } }));
    const highFund = runDiagnosis(baseInput({ asset: { savings: 500, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 } }));
    const lowScore = lowFund.categories.find((c) => c.key === 'asset')!.score;
    const highScore = highFund.categories.find((c) => c.key === 'asset')!.score;
    expect(lowScore).toBeGreaterThan(highScore);
  });

  test('負債が資産に対して大きいほど資産リスクスコアが高い', () => {
    const heavyDebt = runDiagnosis(baseInput({ asset: { savings: 200, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 3000, otherLoanBalance: 0 } }));
    const noDebt = runDiagnosis(baseInput({ asset: { savings: 200, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 } }));
    const heavyScore = heavyDebt.categories.find((c) => c.key === 'asset')!.score;
    const noDebtScore = noDebt.categories.find((c) => c.key === 'asset')!.score;
    expect(heavyScore).toBeGreaterThan(noDebtScore);
  });
});

describe('runDiagnosis - 相続リスク', () => {
  test('配偶者・子がいない場合は法定相続人数を推定できない旨を返す', () => {
    const result = runDiagnosis(baseInput());
    const inheritance = result.categories.find((c) => c.key === 'inheritance')!;
    expect(inheritance.score).toBe(0);
    expect(inheritance.reasons[0]).toMatch(/推定できません/);
  });

  test('相続財産が基礎控除を超えるとスコアが上がる', () => {
    const smallEstate = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33, children: [{ currentAge: 5 }] } as any,
      asset: { savings: 100, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 },
    }));
    const largeEstate = runDiagnosis(baseInput({
      basic: { hasSpouse: true, spouseAge: 33, children: [{ currentAge: 5 }] } as any,
      asset: { savings: 10000, otherAssets: 10000, realEstateValue: 10000, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 },
    }));
    const smallScore = smallEstate.categories.find((c) => c.key === 'inheritance')!.score;
    const largeScore = largeEstate.categories.find((c) => c.key === 'inheritance')!.score;
    expect(largeScore).toBeGreaterThan(smallScore);
  });
});

describe('runDiagnosis - 総合スコア・優先度(Risk Profile)', () => {
  test('7つのリスク領域すべてが結果に含まれる', () => {
    const result = runDiagnosis(baseInput());
    const keys = result.categories.map((c) => c.key).sort();
    expect(keys).toEqual(['asset', 'care', 'death', 'disability', 'inheritance', 'medical', 'retirement'].sort());
  });

  test('すべてのスコアが0-100の範囲に収まる', () => {
    const result = runDiagnosis(baseInput({
      basic: { age: 55, occupationRisk: 'high', hasSpouse: true, spouseAge: 50, children: [{ currentAge: 10 }, { currentAge: 15 }] } as any,
      health: { hasMedicalHistory: true },
    }));
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    for (const c of result.categories) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
      expect(['critical', 'high', 'medium', 'low']).toContain(c.level);
    }
  });

  test('総合スコアは各カテゴリスコアの平均である', () => {
    const result = runDiagnosis(baseInput());
    const expected = Math.round(result.categories.reduce((s, c) => s + c.score, 0) / result.categories.length);
    expect(result.overallScore).toBe(expected);
  });

  test('前提条件(assumptions)が開示される', () => {
    const result = runDiagnosis(baseInput());
    expect(result.assumptions.length).toBeGreaterThan(0);
    expect(result.assumptions.some((a) => a.includes('制度'))).toBe(true);
  });

  test('提案される保険種類はスコア閾値(50点)以上のもののみで、商品名・会社名を含まない', () => {
    const result = runDiagnosis(baseInput({
      basic: { age: 45, occupationRisk: 'high', hasSpouse: true, spouseAge: 43, children: [{ currentAge: 3 }] } as any,
      health: { hasMedicalHistory: true },
      asset: { savings: 10, otherAssets: 0, realEstateValue: 0, hasMortgageLifeInsurance: true, mortgageBalance: 0, otherLoanBalance: 0 },
    }));
    expect(result.suggestedProductTypes).toContain('死亡保障');
    for (const p of result.suggestedProductTypes) {
      expect(p).not.toMatch(/生命|損保|会社/);
    }
  });
});
