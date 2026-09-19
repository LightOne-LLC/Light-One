import type { DiagnosisResult } from '../../types/diagnosis';
import { buildDiagnosisExplanation } from '../../rag';
import type { CategoryExplanation, Evidence } from '../../rag';
import { Card, SectionHeader, Eyebrow } from '../ui';

/*
  RAG専用の小さなcomponent。
  既存のWhyPanel/PublicProtectionPanel/CoverageBreakdown/AssumptionsPanelは変更せず、
  「制度・根拠資料の出典」だけを独立した面として追加する。
  診断結果(score/level/gap/reasons/assumptions)は一切変更せず、
  buildDiagnosisExplanation()(Structured Explanation Layer)で読み取って表示するだけ。

  設計方針:
  - 単なるURL一覧にしない。各出典について「何の制度か・どの判定領域の話か・
    なぜここに表示されているか(この判定の計算に直接使われたのか、関連する
    制度・前提なのか)・一次情報はどこか」を1件ごとに示す。
  - direct evidenceには、それを裏付ける実際の計算根拠(reason)の一節を短く引用する。
    これにより「自分のどの判定に関係するか」を具体的な数字・文言のレベルで追跡できる。
  - 7領域すべてを表示し、出典が無い領域も「特定の公的制度を根拠にしていない」旨を
    明示する。単に非表示にすると、バグなのか本当に該当が無いのか区別できず
    誤解を招くため。
  - direct/relatedというEvidence Mapping内部の用語はそのままUIに出さず、
    「この判定の根拠」「関連する制度情報」というユーザー視点の日本語に変換する
    (Evidence architecture自体・relevanceの値そのものは変更しない)。
  - CoverageBreakdown/SuggestedActionsPanel内の出典表示は組織名だけの小さな
    indicatorとし、実際のリンク付き詳細はここに集約する(重複した長い引用の
    繰り返しを避ける階層構造)。
*/

function truncate(text: string, max = 70): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// direct/relatedというEvidence Mapping内部の用語をそのままUIに出さず、
// ユーザーが読んで意味の分かる日本語に変換する。
function relevanceLabel(evidence: Evidence): string {
  return evidence.relevance === 'direct' ? 'この判定の根拠' : '関連する制度情報';
}

function EvidenceItem({ evidence }: { evidence: Evidence }) {
  const { source } = evidence;
  return (
    <li className="text-xs leading-relaxed">
      <div className="flex items-start justify-between gap-3">
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-navy hover:underline underline-offset-2 min-w-0"
        >
          {source.title}
        </a>
        <span
          className={`shrink-0 text-[10px] font-medium tracking-[0.02em] whitespace-nowrap ${
            evidence.relevance === 'direct' ? 'text-risk-low' : 'text-ink-faint'
          }`}
        >
          {relevanceLabel(evidence)}
        </span>
      </div>
      <p className="text-ink-faint mt-0.5">
        {source.organization} · {source.effectiveDate}
      </p>
      {evidence.relevance === 'direct' && (
        <p className="text-ink-faint/80 mt-1 italic">"{truncate(evidence.matchedReason)}"</p>
      )}
    </li>
  );
}

function CategoryEvidenceGroup({ category }: { category: CategoryExplanation }) {
  return (
    <li>
      <Eyebrow className="mb-1.5">{category.label}リスク</Eyebrow>
      {category.evidence.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-ink-faint">
          この判定は特定の公的制度を根拠にしておらず、入力いただいた情報をもとに算出しています。
        </p>
      ) : (
        <>
          {category.publicProtectionNote && (
            <p className="text-[11px] leading-relaxed text-ink-muted mb-2">{category.publicProtectionNote}</p>
          )}
          <ul className="space-y-2.5">
            {category.evidence.map((e) => (
              <EvidenceItem key={e.source.sourceId} evidence={e} />
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

export function EvidenceSourcesPanel({ result }: { result: DiagnosisResult }) {
  const explanation = buildDiagnosisExplanation(result);
  const withEvidence = explanation.categories.filter((c) => c.evidence.length > 0).length;

  return (
    <Card as="section" variant="quiet">
      <SectionHeader
        variant="compact"
        title="Sources(制度・根拠資料の出典)"
        aside={
          <span className="text-[11px] text-ink-faint tabular-nums">
            {withEvidence} / {explanation.categories.length}領域
          </span>
        }
      />
      <ul className="grid gap-y-5 sm:grid-cols-2 sm:gap-x-8">
        {explanation.categories.map((category) => (
          <CategoryEvidenceGroup key={category.key} category={category} />
        ))}
      </ul>
    </Card>
  );
}
