import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { DiagnosisInput, DiagnosisResult } from '../types/diagnosis';
import { getDiagnosisDetail, deleteDiagnosisHistory } from '../lib/diagnosisStore';
import { riskLevelStyle } from '../lib/riskLevelStyle';
import { RadarChartPanel } from '../components/dashboard/RadarChartPanel';
import { RiskMapPanel } from '../components/dashboard/RiskMapPanel';
import { FinancialGapPanel } from '../components/dashboard/FinancialGapPanel';
import { TopRiskAreasPanel } from '../components/dashboard/TopRiskAreasPanel';
import { WhyPanel } from '../components/dashboard/WhyPanel';
import { CurrentProtectionPanel } from '../components/dashboard/CurrentProtectionPanel';
import { PublicProtectionPanel } from '../components/dashboard/PublicProtectionPanel';
import { SuggestedActionsPanel } from '../components/dashboard/SuggestedActionsPanel';
import { AssumptionsPanel } from '../components/dashboard/AssumptionsPanel';
import { CoverageBreakdown } from '../components/dashboard/CoverageBreakdown';
import { exportElementToPdf } from '../lib/pdf';

function overallMessage(score: number): string {
  if (score >= 75) return '優先的に見直したいリスクが複数あります。';
  if (score >= 50) return '確認しておきたいリスクがあります。';
  if (score >= 25) return '大きな不足はありませんが、一部の領域は確認しておくと安心です。';
  return '公的保障・資産・保険のバランスは概ね取れています。';
}

export function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<{ input: DiagnosisInput; result: DiagnosisResult; createdAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDiagnosisDetail(id)
      .then(setData)
      .catch((e) => setError(e?.message ?? '診断結果の取得に失敗しました。'));
  }, [id]);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await exportElementToPdf('pdf-report', `診断レポート_${id}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => window.print();

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm('この診断結果を削除しますか?')) return;
    setDeleting(true);
    try {
      await deleteDiagnosisHistory(id);
      navigate('/history', { replace: true });
    } catch (e: any) {
      setError(e?.message ?? '削除に失敗しました。');
      setDeleting(false);
    }
  };

  if (error) return <p className="text-center text-rose-600 py-16">{error}</p>;
  if (!data) return <p className="text-center text-slate-400 py-16">読み込み中...</p>;

  const { result } = data;
  const topCategory = result.categories.slice().sort((a, b) => b.score - a.score)[0];
  const style = riskLevelStyle(topCategory?.level ?? 'low');

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-12 px-4 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
        <Link to="/history" className="text-sm text-slate-500 hover:text-slate-700 transition-colors py-2">
          ← 履歴一覧
        </Link>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handlePrint}
            className="min-h-[40px] px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            印刷する
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="min-h-[40px] px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors disabled:opacity-40"
          >
            {exporting ? '出力中...' : 'PDFレポート出力'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="min-h-[40px] px-4 py-2 text-sm rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40"
          >
            {deleting ? '削除中...' : '削除'}
          </button>
        </div>
      </div>

      <div id="pdf-report" className="space-y-5 sm:space-y-6">
        <header className={`rounded-2xl border p-6 sm:p-10 ${style.badgeClass}`}>
          <p className="text-xs font-semibold tracking-widest uppercase text-slate-500 mb-2">Your Financial Risk Profile</p>
          <p className="text-5xl sm:text-6xl font-bold tracking-tight tabular-nums text-slate-900">
            {result.overallScore}
            <span className="text-xl sm:text-2xl font-medium text-slate-400"> / 100</span>
          </p>
          <p className="mt-3 text-sm text-slate-600 max-w-md">{overallMessage(result.overallScore)}</p>
          {topCategory && (
            <p className="mt-3 text-sm text-slate-700">
              最も注意すべき領域: <span className="font-semibold">{topCategory.label}</span>({topCategory.score}点)
            </p>
          )}
        </header>

        <RiskMapPanel categories={result.categories} />
        <RadarChartPanel categories={result.categories} />
        <FinancialGapPanel categories={result.categories} />

        <details className="group print:hidden">
          <summary className="cursor-pointer text-sm text-indigo-600 hover:underline select-none py-1">死亡リスクの計算根拠を詳しく見る</summary>
          <div className="mt-4">
            <CoverageBreakdown deathCoverage={result.deathCoverage} />
          </div>
        </details>

        <TopRiskAreasPanel categories={result.categories} />
        <WhyPanel categories={result.categories} />
        <CurrentProtectionPanel existingInsurance={data.input.existingInsurance} />
        <PublicProtectionPanel basic={data.input.basic} />
        <SuggestedActionsPanel categories={result.categories} productTypes={result.suggestedProductTypes} />
        <AssumptionsPanel assumptions={result.assumptions} />
      </div>
    </div>
  );
}
