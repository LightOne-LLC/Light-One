import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { listDiagnosisRecords } from '../lib/diagnosisStore';
import {
  buildFinancialProfile, buildFinancialSnapshot, buildFinancialIntelligence, orderRecordsFromCurrent,
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
        // listDiagnosisRecords()は作成日時降順(新しい順)で返る。buildFinancialIntelligenceは
        // 「history[0]=表示中の診断・history[1]=その直前の診断」を前提とするため、
        // orderRecordsFromCurrent()で表示対象のidを基準に並べ直す(最新以外の記録を
        // 開いた場合でも「直前」が実際にその診断の直前に行われたものになるようにする)。
        const records = await listDiagnosisRecords();
        const orderedRecords = orderRecordsFromCurrent(records, id);
        if (!orderedRecords) throw new Error('診断結果が見つかりません。');
        const current = orderedRecords[0];
        const snapshots = orderedRecords.map(buildFinancialSnapshot);

        const profile = buildFinancialProfile(current.input, current.result);
        const evidence = buildDiagnosisExplanation(current.result);
        setIntelligence(buildFinancialIntelligence(profile, current.result, snapshots, evidence));
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
