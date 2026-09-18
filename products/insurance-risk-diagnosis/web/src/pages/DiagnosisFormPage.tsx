import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { emptyDiagnosisInput, mergeWithDefaults } from '../types/diagnosis';
import type { DiagnosisInput } from '../types/diagnosis';
import { BasicInfoStep } from '../components/steps/BasicInfoStep';
import { AssetStep } from '../components/steps/AssetStep';
import { InsuranceStep } from '../components/steps/InsuranceStep';
import { HealthStep } from '../components/steps/HealthStep';
import { RetirementStep } from '../components/steps/RetirementStep';
import { ConfirmStep } from '../components/steps/ConfirmStep';
import { StepIntro } from '../components/steps/StepLayout';
import { runDiagnosis, saveDraft, loadDraft, clearDraft } from '../lib/diagnosisStore';
import { Button, Card } from '../components/ui';

/*
  各stepに「短い名前(ナビ用)」と「章としての見出し・導入文」を持たせる。
  入力欄の上に必ず『いま何を整理しているのか』が置かれることで、
  体験がフォーム記入から自分の状況の棚卸しに変わる。
*/
const STEPS = [
  {
    nav: '基本情報',
    eyebrow: 'Step 01 — Profile',
    heading: 'あなたについて',
    lead: '年齢・働き方・収入は、これから計算するすべてのリスクの土台になります。',
  },
  {
    nav: '資産・負債',
    eyebrow: 'Step 02 — Balance',
    heading: 'いまの資産と負債',
    lead: '手元にある資産と、返済中の負債を整理します。おおよその金額で構いません。',
  },
  {
    nav: '既存保険',
    eyebrow: 'Step 03 — Cover',
    heading: 'すでに備えているもの',
    lead: 'いま加入している保障は、必要保障額からそのまま差し引かれます。',
  },
  {
    nav: '健康状態',
    eyebrow: 'Step 04 — Health',
    heading: '健康状態',
    lead: '既往歴は医療リスクの評価にのみ使用します。詳細な病名の入力は不要です。',
  },
  {
    nav: '老後の希望',
    eyebrow: 'Step 05 — Future',
    heading: '老後の希望',
    lead: '退職の時期と希望する生活水準から、老後に必要な資金を推計します。',
  },
  {
    nav: '確認',
    eyebrow: 'Review',
    heading: 'Financial Profile',
    lead: 'この内容で診断します。各カテゴリの「編集」から、該当のステップに戻れます。',
  },
];

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
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-28 lg:pb-12">
      <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12 xl:gap-16">
        {/*
          進捗は「バーが伸びる」だけの表示にしない。デスクトップでは章立てそのものを
          常時見せ、完了した章に戻れる目次として機能させる。
          モバイルでは同じ要素が細い進捗インジケータに畳まれる。
        */}
        <aside className="lg:sticky lg:top-8 lg:self-start mb-7 lg:mb-0">
          <h1 className="text-base lg:text-lg font-semibold tracking-[-0.01em] text-ink">保険リスク診断</h1>
          <p className="hidden lg:block eyebrow text-ink-faint mt-2">Financial profile</p>

          <div className="lg:hidden mt-3">
            <div className="flex items-baseline justify-between mb-2">
              <span className="eyebrow text-ink-faint">Step {step + 1} / {STEPS.length}</span>
              <span className="text-[13px] font-medium text-ink">{current.nav}</span>
            </div>
            <div
              className="h-[3px] rounded-full bg-surface-sunken overflow-hidden"
              role="progressbar"
              aria-valuenow={step + 1}
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
            >
              <div className="h-full rounded-full bg-navy transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <nav aria-label="診断ステップ" className="hidden lg:block mt-7">
            <ol className="border-l border-line">
              {STEPS.map((s, i) => {
                const done = i < step;
                const isCurrent = i === step;
                return (
                  <li key={s.nav}>
                    <button
                      type="button"
                      onClick={() => goToStep(i)}
                      disabled={i > step}
                      aria-current={isCurrent ? 'step' : undefined}
                      className={`w-full text-left -ml-px pl-5 py-3 border-l-2 transition-colors disabled:cursor-default ${
                        isCurrent ? 'border-navy' : done ? 'border-platinum-ring hover:border-navy/50' : 'border-transparent'
                      }`}
                    >
                      <span className={`block eyebrow mb-1 ${isCurrent ? 'text-platinum' : 'text-ink-faint/70'}`}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className={`block text-[13px] ${isCurrent ? 'font-semibold text-ink' : done ? 'text-ink-muted' : 'text-ink-faint'}`}>
                        {s.nav}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </aside>

        <div>
          <Card variant="feature" as="section">
            <StepIntro eyebrow={current.eyebrow} title={current.heading} lead={current.lead} />

            {step === 0 && <BasicInfoStep input={input} onChange={update} />}
            {step === 1 && <AssetStep input={input} onChange={update} />}
            {step === 2 && <InsuranceStep input={input} onChange={update} />}
            {step === 3 && <HealthStep input={input} onChange={update} />}
            {step === 4 && <RetirementStep input={input} onChange={update} />}
            {step === 5 && <ConfirmStep input={input} onEditStep={goToStep} />}

            {error && <p className="text-sm text-risk-critical mt-4" role="alert">{error}</p>}

            {/*
              同じナビゲーションを、モバイルでは親指の届く画面下部に固定し、
              デスクトップでは章の末尾に置く。DOMは1つのまま配置だけを切り替える。
            */}
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/92 backdrop-blur px-4 py-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:z-auto lg:mt-10 lg:px-0 lg:pt-6 lg:pb-0 lg:bg-transparent lg:backdrop-blur-none lg:border-line-soft">
              <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 lg:max-w-none">
                <Button variant="secondary" disabled={step === 0} onClick={goBack}>戻る</Button>
                {isLast ? (
                  <Button variant="primary" className="flex-1 sm:flex-none" disabled={submitting} onClick={handleSubmit}>
                    {submitting ? '診断中...' : '診断する'}
                  </Button>
                ) : (
                  <Button variant="primary" className="flex-1 sm:flex-none" disabled={!canGoNext()} onClick={goNext}>
                    次へ
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
