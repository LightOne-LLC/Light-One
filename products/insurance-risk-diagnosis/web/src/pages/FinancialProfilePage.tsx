import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDiagnosisDetail, listDiagnosisRecords } from '../lib/diagnosisStore';
import {
  buildFinancialProfile, buildFinancialSnapshot, buildFinancialIntelligence,
} from '../financial';
import type { FinancialIntelligence } from '../financial';
import { buildDiagnosisExplanation } from '../rag';
import { FinancialProfileReport } from '../components/financial/FinancialProfileReport';
import { LoadingState } from '../components/ui';

/*
  Personal Financial Intelligence(Phase 4)のデータ取得層。
  表示自体はFinancialProfileReport(純粋なpresentational component)に委譲し、
  ここでは既存のdiagnosisStore(localStorage)から必要なデータを読み込み、
  financial/モジュールの純粋関数で組み立てるだけ。診断ロジック・RAGの
  再計算は一切行わない。
*/
export function FinancialProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [intelligence, setIntelligence] = useState<FinancialIntelligence | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const detail = await getDiagnosisDetail(id);
        const records = await listDiagnosisRecords();
        // 現在表示している診断を先頭に、それ以外を作成日時降順で並べる(compareSnapshotsが
        // 「先頭=現在・2番目=直前」を前提としているため)。
        const others = records.filter((r) => r.id !== id);
        const orderedRecords = [
          { id: detail.id, input: detail.input, result: detail.result, createdAt: detail.createdAt },
          ...others,
        ];
        const snapshots = orderedRecords.map(buildFinancialSnapshot);

        const profile = buildFinancialProfile(detail.input, detail.result);
        const evidence = buildDiagnosisExplanation(detail.result);
        setIntelligence(buildFinancialIntelligence(profile, detail.result, snapshots, evidence));
      } catch (e: any) {
        setError(e?.message ?? 'Financial Profileの取得に失敗しました。');
      }
    })();
  }, [id]);

  if (error) return <p className="text-center text-risk-critical py-16" role="alert">{error}</p>;
  if (!intelligence || !id) return <LoadingState message="Financial Profileを読み込んでいます..." />;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-10">
      <h1 className="sr-only">Financial Profile</h1>
      <div className="flex items-center justify-between gap-3 flex-wrap pb-5 mb-7 border-b border-line">
        <Link to={`/result/${id}`} className="inline-flex items-center gap-2 text-[13px] text-ink-muted hover:text-navy transition-colors py-2">
          <span aria-hidden="true">←</span> 診断結果に戻る
        </Link>
      </div>

      <FinancialProfileReport intelligence={intelligence} resultId={id} />
    </div>
  );
}
