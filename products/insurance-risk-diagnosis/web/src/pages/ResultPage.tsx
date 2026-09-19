import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { DiagnosisInput, DiagnosisResult } from '../types/diagnosis';
import { getDiagnosisDetail, deleteDiagnosisHistory } from '../lib/diagnosisStore';
import { Button, ResultHero, LoadingState, Card, Eyebrow } from '../components/ui';
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
import { EvidenceSourcesPanel } from '../components/dashboard/EvidenceSourcesPanel';
import { exportElementToPdf } from '../lib/pdf';

function overallMessage(score: number): string {
  if (score >= 75) return '優先的に見直したいリスクが複数あります。';
  if (score >= 50) return '確認しておきたいリスクがあります。';
  if (score >= 25) return '大きな不足はありませんが、一部の領域は確認しておくと安心です。';
  return '公的保障・資産・保険のバランスは概ね取れています。';
}

function positionLabel(score: number): string {
  if (score >= 75) return '要対応';
  if (score >= 50) return '要確認';
  if (score >= 25) return '概ね良好';
  return '良好';
}

/*
  レポートの章立て。番号 + 章題 + 端に向かって消える罫線で紙面のリズムを作る。
  これがあることで、下に続くパネル群が「並べられたカード」ではなく
  「章の中身」として読まれる。
*/
function ReportSection({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-4 mb-4 sm:mb-5">
        <span className="font-display-num text-xs font-bold tabular-nums text-platinum shrink-0">{index}</span>
        <h2 className="text-[13px] sm:text-sm font-semibold tracking-[0.04em] text-ink shrink-0">{title}</h2>
        <hr className="rule-fade flex-1 min-w-0" />
      </div>
      {children}
    </section>
  );
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

  if (error) return <p className="text-center text-risk-critical py-16" role="alert">{error}</p>;
  if (!data) return <LoadingState message="診断結果を読み込んでいます..." />;

  const { result } = data;
  const topDomains = result.categories.slice().sort((a, b) => b.score - a.score).slice(0, 3).map((c) => c.label);
  const diagnosisDate = new Date(data.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  const hasGap = result.categories.some((c) => c.gap);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-10">
      <div className="flex items-center justify-between gap-3 flex-wrap pb-5 mb-7 border-b border-line print:hidden">
        <Link to="/history" className="inline-flex items-center gap-2 text-[13px] text-ink-muted hover:text-navy transition-colors py-2">
          <span aria-hidden="true">←</span> 履歴一覧
        </Link>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={handlePrint}>印刷する</Button>
          <Button variant="primary" size="sm" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? '出力中...' : 'PDFレポート出力'}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? '削除中...' : '削除'}
          </Button>
        </div>
      </div>

      <article id="pdf-report" className="space-y-10 sm:space-y-14">
        <ResultHero
          overallScore={result.overallScore}
          message={overallMessage(result.overallScore)}
          date={diagnosisDate}
          topDomains={topDomains}
          positionLabel={positionLabel(result.overallScore)}
        />

        {/* 01: 結論のすぐ次に「どこが問題で、いくら足りないのか」を横並びで置く */}
        <ReportSection index="01" title="優先して確認する領域">
          <div className={`report-grid grid gap-5 items-start ${hasGap ? 'lg:grid-cols-[1.15fr_1fr]' : ''}`}>
            <TopRiskAreasPanel categories={result.categories} />
            <FinancialGapPanel categories={result.categories} />
          </div>
        </ReportSection>

        {/* 02: 読み終えた人が次に取る行動。単独で幅いっぱいに置き、章として独立させる */}
        <ReportSection index="02" title="次にとるべき一歩">
          <SuggestedActionsPanel categories={result.categories} productTypes={result.suggestedProductTypes} />
        </ReportSection>

        {/* 03: 全体像。表(比較)とチャート(形)を対にして見せる */}
        <ReportSection index="03" title="7領域のリスクプロファイル">
          <div className="report-grid grid gap-5 items-start lg:grid-cols-[1.3fr_1fr]">
            <RiskMapPanel categories={result.categories} />
            <RadarChartPanel categories={result.categories} />
          </div>
        </ReportSection>

        {/* 04: 民間の備えと公的な備えを左右に並べ、「保険の前に制度がある」ことを構造で示す */}
        <ReportSection index="04" title="現在の備え">
          <div className="report-grid grid gap-5 items-start lg:grid-cols-2">
            <CurrentProtectionPanel existingInsurance={data.input.existingInsurance} />
            <PublicProtectionPanel basic={data.input.basic} />
          </div>
        </ReportSection>

        {/* 05: 根拠。既定で開くのは最上位1件のみ(WhyPanel内)、計算式はさらに折りたたむ */}
        <ReportSection index="05" title="判定の根拠">
          <div className="space-y-5">
            <WhyPanel categories={result.categories} />
            <EvidenceSourcesPanel result={result} />
            <details>
              <summary className="cursor-pointer list-none">
                <Card variant="quiet" className="flex items-center justify-between gap-3 hover:border-line-strong transition-colors">
                  <span className="text-[13px] font-medium text-ink-muted">死亡リスクの計算根拠を詳しく見る</span>
                  <span className="text-ink-faint text-[10px]" aria-hidden="true">▼</span>
                </Card>
              </summary>
              <div className="mt-4">
                <CoverageBreakdown deathCoverage={result.deathCoverage} />
              </div>
            </details>
          </div>
        </ReportSection>

        <footer className="pt-2">
          <AssumptionsPanel assumptions={result.assumptions} />
          <div className="flex items-baseline justify-between gap-4 flex-wrap mt-6 pt-5 border-t border-line">
            <Eyebrow>LIGHT ONE — Financial Risk Intelligence</Eyebrow>
            <p className="text-[11px] text-ink-faint">
              本レポートは入力内容に基づく目安であり、特定の金融商品の推奨ではありません。
            </p>
          </div>
        </footer>
      </article>
    </div>
  );
}
