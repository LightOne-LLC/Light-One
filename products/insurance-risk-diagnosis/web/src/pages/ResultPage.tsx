import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { DiagnosisInput, DiagnosisResult } from '../types/diagnosis';
import { getDiagnosisDetail, deleteDiagnosisHistory } from '../lib/diagnosisStore';
import { RadarChartPanel } from '../components/dashboard/RadarChartPanel';
import { CoverageBreakdown } from '../components/dashboard/CoverageBreakdown';
import { ScoreReasons } from '../components/dashboard/ScoreReasons';
import { ProductSuggestions } from '../components/dashboard/ProductSuggestions';
import { exportElementToPdf } from '../lib/pdf';

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

  if (error) return <p className="text-center text-red-600 py-8">{error}</p>;
  if (!data) return <p className="text-center text-slate-500 py-8">読み込み中...</p>;

  const { result } = data;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">診断結果</h1>
        <div className="flex gap-2">
          <Link to="/history" className="px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-600">
            履歴一覧
          </Link>
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white disabled:opacity-40"
          >
            {exporting ? '出力中...' : 'PDFレポート出力'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-sm rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            {deleting ? '削除中...' : 'この診断結果を削除'}
          </button>
        </div>
      </div>

      <div id="pdf-report" className="space-y-4 bg-slate-50 p-2">
        <RadarChartPanel result={result} />
        <CoverageBreakdown deathCoverage={result.deathCoverage} />
        <ScoreReasons title="医療リスクスコア" score={result.medicalRisk} />
        <ScoreReasons title="就業不能リスクスコア" score={result.disabilityRisk} />
        <ScoreReasons title="資産形成ニーズスコア" score={result.assetFormation} />
        <ProductSuggestions types={result.suggestedProductTypes} />
      </div>
    </div>
  );
}
