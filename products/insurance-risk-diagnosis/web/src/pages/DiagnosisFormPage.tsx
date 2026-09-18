import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { emptyDiagnosisInput, mergeWithDefaults } from '../types/diagnosis';
import type { DiagnosisInput } from '../types/diagnosis';
import { BasicInfoStep } from '../components/steps/BasicInfoStep';
import { AssetStep } from '../components/steps/AssetStep';
import { InsuranceStep } from '../components/steps/InsuranceStep';
import { HealthStep } from '../components/steps/HealthStep';
import { RetirementStep } from '../components/steps/RetirementStep';
import { runDiagnosis, saveDraft, loadDraft, clearDraft } from '../lib/diagnosisStore';

const STEPS = ['基本情報', '資産・負債', '既存保険', '健康状態', '老後の希望', '確認'];

export function DiagnosisFormPage() {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState<DiagnosisInput>(emptyDiagnosisInput());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const draft = loadDraft();
    if (!draft) return;
    if (window.confirm('以前の入力内容があります。復元しますか?')) {
      setInput(mergeWithDefaults(draft));
    } else {
      clearDraft();
    }
  }, []);

  const update = (updater: (draft: DiagnosisInput) => DiagnosisInput) => {
    setInput((prev) => {
      const next = updater(prev);
      saveDraft(next);
      return next;
    });
  };

  const canGoNext = () => {
    if (step === 0 && input.basic.hasSpouse && input.basic.spouseAge === undefined) return false;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { id } = await runDiagnosis(input);
      clearDraft();
      navigate(`/result/${id}`);
    } catch (e: any) {
      setError(e?.message ?? '診断の実行に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const progressPercent = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-12 px-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-6">保険リスク診断</h1>

      <div className="mb-8">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs font-semibold tracking-wide text-slate-500">
            STEP {step + 1} / {STEPS.length}
          </span>
          <span className="text-sm font-medium text-slate-700">{STEPS[step]}</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-600 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="bg-surface rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        {step === 0 && <BasicInfoStep input={input} onChange={update} />}
        {step === 1 && <AssetStep input={input} onChange={update} />}
        {step === 2 && <InsuranceStep input={input} onChange={update} />}
        {step === 3 && <HealthStep input={input} onChange={update} />}
        {step === 4 && <RetirementStep input={input} onChange={update} />}
        {step === 5 && <ConfirmStep input={input} />}

        {error && <p className="text-sm text-rose-600 mt-4">{error}</p>}

        <div className="flex justify-between mt-8">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
          >
            戻る
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={!canGoNext()}
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="px-5 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40"
            >
              次へ
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="px-5 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40"
            >
              {submitting ? '診断中...' : '診断する'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmStep({ input }: { input: DiagnosisInput }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-slate-900 mb-5">入力内容の確認</h2>
      <dl className="text-sm text-slate-700 space-y-0.5">
        <Row label="年齢" value={`${input.basic.age}歳`} />
        <Row label="雇用形態" value={input.basic.occupationType} />
        <Row label="年収" value={`${input.basic.annualIncome}万円`} />
        <Row label="配偶者" value={input.basic.hasSpouse ? `いる(${input.basic.spouseAge}歳、年収${input.basic.spouseAnnualIncome ?? 0}万円)` : 'いない'} />
        <Row label="子供" value={input.basic.children.length ? input.basic.children.map((c) => `${c.currentAge}歳`).join(', ') : 'いない'} />
        <Row label="貯蓄額" value={`${input.asset.savings}万円`} />
        <Row label="投資性資産" value={`${input.asset.otherAssets}万円`} />
        <Row label="不動産評価額" value={`${input.asset.realEstateValue}万円`} />
        <Row label="住宅ローン残高" value={`${input.asset.mortgageBalance}万円`} />
        <Row label="その他借入残高" value={`${input.asset.otherLoanBalance}万円`} />
        <Row label="既存死亡保障" value={`${input.existingInsurance.deathCoverage}万円`} />
        <Row label="月額保険料合計" value={`${input.existingInsurance.monthlyPremiumTotal}万円`} />
        <Row label="既往歴" value={input.health.hasMedicalHistory ? 'あり' : 'なし'} />
        <Row label="希望退職年齢" value={`${input.retirement.desiredRetirementAge}歳`} />
        <Row label="退職金見込み額" value={`${input.retirement.expectedSeverancePay}万円`} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
