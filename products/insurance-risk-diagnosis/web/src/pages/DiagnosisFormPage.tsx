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
import { Button } from '../components/ui';

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
    if (window.confirm('以前の入力内容があります。続きから再開しますか?')) {
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

  const goToStep = (target: number) => {
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goNext = () => goToStep(Math.min(STEPS.length - 1, step + 1));
  const goBack = () => goToStep(Math.max(0, step - 1));

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
    <div className="max-w-2xl mx-auto py-6 sm:py-12 px-4 pb-28 sm:pb-12">
      <h1 className="text-2xl font-bold tracking-tight text-navy mb-6">保険リスク診断</h1>

      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs font-semibold tracking-wide text-ink-muted">
            STEP {step + 1} / {STEPS.length}
          </span>
          <span className="text-sm font-medium text-navy">{STEPS[step]}</span>
        </div>
        <div className="h-1.5 rounded-full bg-line overflow-hidden" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
          <div className="h-full rounded-full bg-navy transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="flex justify-between mt-2" aria-hidden="true">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i < step ? 'bg-gold' : i === step ? 'bg-navy' : 'bg-line'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="bg-surface rounded-2xl shadow-sm border border-line p-6 sm:p-8">
        {step === 0 && <BasicInfoStep input={input} onChange={update} />}
        {step === 1 && <AssetStep input={input} onChange={update} />}
        {step === 2 && <InsuranceStep input={input} onChange={update} />}
        {step === 3 && <HealthStep input={input} onChange={update} />}
        {step === 4 && <RetirementStep input={input} onChange={update} />}
        {step === 5 && <ConfirmStep input={input} onEditStep={goToStep} />}

        {error && <p className="text-sm text-rose-600 mt-4" role="alert">{error}</p>}

        {/* モバイルでは画面下部に固定し、長いフォームでもスクロールせず操作できるようにする */}
        <div className="mt-8 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 px-6 sm:px-8 py-4 border-t border-line flex justify-between gap-3 sticky bottom-0 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] bg-surface/95 backdrop-blur rounded-b-2xl">
          <Button variant="secondary" disabled={step === 0} onClick={goBack}>
            戻る
          </Button>

          {step < STEPS.length - 1 ? (
            <Button variant="primary" className="flex-1 sm:flex-none" disabled={!canGoNext()} onClick={goNext}>
              次へ
            </Button>
          ) : (
            <Button variant="primary" className="flex-1 sm:flex-none" disabled={submitting} onClick={handleSubmit}>
              {submitting ? '診断中...' : '診断する'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmStep({ input, onEditStep }: { input: DiagnosisInput; onEditStep: (step: number) => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-navy mb-1">入力内容の確認</h2>
      <p className="text-sm text-ink-muted mb-5">この内容で診断します。各項目の「編集」から該当ステップへ移動できます。</p>

      <ConfirmSection title="基本情報" onEdit={() => onEditStep(0)}>
        <Row label="年齢" value={`${input.basic.age}歳`} />
        <Row label="雇用形態" value={occupationLabel(input.basic.occupationType)} />
        <Row label="年収" value={`${input.basic.annualIncome}万円`} />
        <Row label="配偶者" value={input.basic.hasSpouse ? `いる(${input.basic.spouseAge}歳、年収${input.basic.spouseAnnualIncome ?? 0}万円)` : 'いない'} />
        <Row label="子供" value={input.basic.children.length ? input.basic.children.map((c) => `${c.currentAge}歳`).join(', ') : 'いない'} />
      </ConfirmSection>

      <ConfirmSection title="資産・負債" onEdit={() => onEditStep(1)}>
        <Row label="貯蓄額" value={`${input.asset.savings}万円`} />
        <Row label="投資性資産" value={`${input.asset.otherAssets}万円`} />
        <Row label="不動産評価額" value={`${input.asset.realEstateValue}万円`} />
        <Row label="住宅ローン残高" value={`${input.asset.mortgageBalance}万円`} />
        <Row label="その他借入残高" value={`${input.asset.otherLoanBalance}万円`} />
      </ConfirmSection>

      <ConfirmSection title="既存保険" onEdit={() => onEditStep(2)}>
        <Row label="既存死亡保障" value={`${input.existingInsurance.deathCoverage}万円`} />
        <Row label="月額保険料合計" value={`${input.existingInsurance.monthlyPremiumTotal}万円`} />
      </ConfirmSection>

      <ConfirmSection title="健康状態" onEdit={() => onEditStep(3)}>
        <Row label="既往歴" value={input.health.hasMedicalHistory ? 'あり' : 'なし'} />
      </ConfirmSection>

      <ConfirmSection title="老後の希望" onEdit={() => onEditStep(4)} last>
        <Row label="希望退職年齢" value={`${input.retirement.desiredRetirementAge}歳`} />
        <Row label="退職金見込み額" value={`${input.retirement.expectedSeverancePay}万円`} />
      </ConfirmSection>
    </div>
  );
}

function occupationLabel(t: string): string {
  if (t === 'employee') return '会社員';
  if (t === 'public_servant') return '公務員';
  return '自営業・フリーランス';
}

function ConfirmSection({ title, children, last, onEdit }: { title: string; children: React.ReactNode; last?: boolean; onEdit: () => void }) {
  return (
    <div className={last ? 'mb-0' : 'mb-5'}>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-xs font-semibold tracking-wide text-ink-muted">{title}</h3>
        <button type="button" onClick={onEdit} className="text-xs text-navy hover:underline py-1 px-1 min-h-[32px]">
          編集
        </button>
      </div>
      <dl className="text-sm text-navy">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2">
      <dt className="text-ink-muted shrink-0">{label}</dt>
      <dd className="font-medium text-navy text-right">{value}</dd>
    </div>
  );
}
