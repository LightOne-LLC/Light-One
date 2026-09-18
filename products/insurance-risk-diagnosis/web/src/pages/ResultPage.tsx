import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { DiagnosisInput, DiagnosisResult } from '../types/diagnosis';
import { getDiagnosisDetail, deleteDiagnosisHistory } from '../lib/diagnosisStore';
import { Button, ResultHero, LoadingState } from '../components/ui';
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

  if (error) return <p className="text-center text-rose-600 py-16" role="alert">{error}</p>;
  if (!data) return <LoadingState message="診断結果を読み込んでいます..." />;

  const { result } = data;
  const topCategory = result.categories.slice().sort((a, b) => b.score - a.score)[0];
  const diagnosisDate = new Date(data.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-12 px-4 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
        <Link to="/history" className="text-sm text-slate-500 hover:text-slate-700 transition-colors py-2">
          ← 履歴一覧
        </Link>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={handlePrint}>印刷する</Button>
          <Button variant="dark" size="sm" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? '出力中...' : 'PDFレポート出力'}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? '削除中...' : '削除'}
          </Button>
        </div>
      </div>

      <div id="pdf-report" className="space-y-5 sm:space-y-6">
        {/* Level 1: 一目で分かる情報 — 総合評価・最重要リスク・理由・次の一歩。HeroとTop Riskは間隔を詰めて一続きに読ませる */}
        <div className="space-y-2">
          <ResultHero
            overallScore={result.overallScore}
            topLevel={topCategory?.level ?? 'low'}
            topLabel={topCategory?.label}
            topScore={topCategory?.score}
            message={overallMessage(result.overallScore)}
            date={diagnosisDate}
          />
          <TopRiskAreasPanel categories={result.categories} />
        </div>

        <WhyPanel categories={result.categories} />
        <SuggestedActionsPanel categories={result.categories} productTypes={result.suggestedProductTypes} />

        {/* Level 2-3: 詳細データ・計算根拠。既定では折りたたみ、印刷時は既存のprint CSSにより自動展開される */}
        <details className="group">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-surface px-6 py-4 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <span>詳細データを見る(7領域のスコア内訳・不足額の計算・公的保障の詳細など)</span>
              <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
            </div>
          </summary>
          <div className="space-y-5 sm:space-y-6 mt-5">
            <RiskMapPanel categories={result.categories} />
            <RadarChartPanel categories={result.categories} />
            <FinancialGapPanel categories={result.categories} />

            <details>
              <summary className="cursor-pointer text-sm text-indigo-600 hover:underline select-none py-1">死亡リスクの計算根拠を詳しく見る</summary>
              <div className="mt-4">
                <CoverageBreakdown deathCoverage={result.deathCoverage} />
              </div>
            </details>

            <CurrentProtectionPanel existingInsurance={data.input.existingInsurance} />
            <PublicProtectionPanel basic={data.input.basic} />
            <AssumptionsPanel assumptions={result.assumptions} />
          </div>
        </details>
      </div>
    </div>
  );
}
