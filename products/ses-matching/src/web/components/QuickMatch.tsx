import { useState } from 'react';
import { toEngineerInput } from '../../intake/engineer';
import { toProjectInput } from '../../intake/project';
import type { EngineerRecord, ProjectRecord } from '../../intake/types';
import { matchEngineerToProjects } from '../../matching/matchEngineerToProjects';
import { matchProjectToEngineers } from '../../matching/matchProjectToEngineers';
import { calcTotalScore } from '../../scoring/totalScore';
import type { ScoreBreakdown } from '../../scoring/types';
import { formatDateValue } from '../formatDateValue';
import { analyzeQuickMatchText, type QuickMatchAnalysis, type QuickMatchOverride } from '../quickMatch/analyzeQuickMatch';
import { getSkillFulfillment, scoreToIndicator, type SkillFulfillmentItem } from '../quickMatch/skillFulfillment';
import { scoreColorClass } from '../scoreColor';
import { useMatchingPools } from '../useMatchingPools';

type UiStatus = 'idle' | 'analyzing' | 'done';

interface CandidateDisplay {
  id: string;
  label: string;
  score: number;
  breakdown: ScoreBreakdown;
  skillFulfillment: SkillFulfillmentItem[];
}

const MAX_CANDIDATES_SHOWN = 10;

/** 案件に対する候補要員一覧を、既存matchProjectToEngineers()の結果順そのまま
 * (スコアの意味・並び順は一切変更しない)で表示用データへ組み立てる。
 * breakdown/skillFulfillmentは表示専用の追加情報で、既存のcalcTotalScore()を
 * 呼び出すだけ(同じproject/engineerの組に対するtotalScoreは、
 * matchProjectToEngineers()が返す値と必ず一致する)。 */
function buildProjectCandidates(project: ProjectRecord, engineers: EngineerRecord[]): CandidateDisplay[] {
  const ranking = matchProjectToEngineers(project, engineers);
  const byId = new Map(engineers.map((e) => [e.id, e]));
  return ranking.slice(0, MAX_CANDIDATES_SHOWN).map((r) => {
    const engineer = byId.get(r.engineerId);
    const breakdown = engineer
      ? calcTotalScore(toProjectInput(project), toEngineerInput(engineer)).breakdown
      : { skillScore: 0, rateScore: 0, locationScore: 0, timingScore: 0, weightsUsed: { skillWeight: 0, rateWeight: 0, locationWeight: 0, timingWeight: 0 } };
    return {
      id: r.engineerId,
      label: engineer?.engineerName ?? `人材ID: ${r.engineerId}`,
      score: r.score,
      breakdown,
      skillFulfillment: engineer ? getSkillFulfillment(project.requiredSkills, engineer.skills) : [],
    };
  });
}

/** buildProjectCandidates()の逆方向。既存matchEngineerToProjects()の結果順を
 * そのまま使う。 */
function buildEngineerCandidates(engineer: EngineerRecord, projects: ProjectRecord[]): CandidateDisplay[] {
  const ranking = matchEngineerToProjects(engineer, projects);
  const byId = new Map(projects.map((p) => [p.id, p]));
  return ranking.slice(0, MAX_CANDIDATES_SHOWN).map((r) => {
    const project = byId.get(r.projectId);
    const breakdown = project
      ? calcTotalScore(toProjectInput(project), toEngineerInput(engineer)).breakdown
      : { skillScore: 0, rateScore: 0, locationScore: 0, timingScore: 0, weightsUsed: { skillWeight: 0, rateWeight: 0, locationWeight: 0, timingWeight: 0 } };
    return {
      id: r.projectId,
      label: project?.projectName ?? `案件ID: ${r.projectId}`,
      score: r.score,
      breakdown,
      skillFulfillment: project ? getSkillFulfillment(project.requiredSkills, engineer.skills) : [],
    };
  });
}

function CandidateCard({
  rank,
  candidate,
  expanded,
  onToggle,
}: {
  rank: number;
  candidate: CandidateDisplay;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="candidate-card">
      <div className="candidate-card-header" onClick={onToggle}>
        <span className="ranking-rank">{rank}</span>
        <span className="ranking-id">{candidate.label}</span>
        <span className={`ranking-score ${scoreColorClass(candidate.score)}`}>{candidate.score}</span>
      </div>
      {candidate.skillFulfillment.length > 0 && (
        <div>
          {candidate.skillFulfillment.map((skill) => (
            <span
              key={skill.name}
              className={`skill-tag ${skill.fulfilled ? 'fulfilled' : 'missing'}`}
            >
              {skill.fulfilled ? '◎' : '△'} {skill.name}
              {!skill.required && '(尚可)'}
            </span>
          ))}
        </div>
      )}
      {expanded && (
        <>
          <div className="card-row">
            <span>{scoreToIndicator(candidate.breakdown.skillScore)} スキル</span>
            <span>{Math.round(candidate.breakdown.skillScore * 100)}</span>
          </div>
          <div className="card-row">
            <span>{scoreToIndicator(candidate.breakdown.rateScore)} 単価</span>
            <span>{Math.round(candidate.breakdown.rateScore * 100)}</span>
          </div>
          <div className="card-row">
            <span>{scoreToIndicator(candidate.breakdown.locationScore)} 勤務地</span>
            <span>{Math.round(candidate.breakdown.locationScore * 100)}</span>
          </div>
          <div className="card-row">
            <span>{scoreToIndicator(candidate.breakdown.timingScore)} タイミング</span>
            <span>{Math.round(candidate.breakdown.timingScore * 100)}</span>
          </div>
        </>
      )}
      <div className="card-row">
        <button type="button" onClick={onToggle} style={{ width: 'auto', padding: '4px 10px', fontSize: '0.75rem', margin: 0 }}>
          {expanded ? '閉じる' : '詳細'}
        </button>
      </div>
    </div>
  );
}

function ProjectSummary({ project }: { project: ProjectRecord }) {
  return (
    <div className="card">
      <div className="card-title">案件として解析しました</div>
      {project.projectName && (
        <div className="card-row">
          <span>案件名</span>
          <span>{project.projectName}</span>
        </div>
      )}
      {project.startDate && (
        <div className="card-row">
          <span>期間</span>
          <span>{formatDateValue(project.startDate)}</span>
        </div>
      )}
      {project.requiredSkills.length > 0 && (
        <div>
          {project.requiredSkills.map((skill, i) => (
            <span key={`${skill.name}-${i}`} className={`skill-tag ${skill.required ? 'required' : ''}`}>
              {skill.name} {skill.required ? '(必須)' : '(尚可)'}
            </span>
          ))}
        </div>
      )}
      <div className="card-row">
        <span>単価</span>
        <span>
          {project.rateMin}〜{project.rateMax}万円/月
        </span>
      </div>
      <div className="card-row">
        <span>勤務地</span>
        <span>
          {project.location}
          {project.remoteAllowed !== undefined ? ` / ${project.remoteAllowed ? 'リモート可' : '出社'}` : ''}
        </span>
      </div>
      {project.sourceCompany && (
        <div className="card-row">
          <span>案件出し会社</span>
          <span>{project.sourceCompany}</span>
        </div>
      )}
      {project.commercialFlow && (
        <div className="card-row">
          <span>商流</span>
          <span>{project.commercialFlow}</span>
        </div>
      )}
    </div>
  );
}

function EngineerSummary({ engineer }: { engineer: EngineerRecord }) {
  return (
    <div className="card">
      <div className="card-title">要員として解析しました</div>
      {engineer.engineerName && (
        <div className="card-row">
          <span>氏名</span>
          <span>{engineer.engineerName}</span>
        </div>
      )}
      {engineer.companyName && (
        <div className="card-row">
          <span>会社名</span>
          <span>{engineer.companyName}</span>
        </div>
      )}
      {engineer.skills.length > 0 && (
        <div>
          {engineer.skills.map((skill, i) => (
            <span key={`${skill.name}-${i}`} className="skill-tag">
              {skill.name} {skill.years}年
            </span>
          ))}
        </div>
      )}
      <div className="card-row">
        <span>希望単価</span>
        <span>
          {engineer.desiredRateMin}〜{engineer.desiredRateMax}万円/月
        </span>
      </div>
      <div className="card-row">
        <span>稼働開始</span>
        <span>{formatDateValue(engineer.availableFrom)}</span>
      </div>
      {engineer.desiredLocations.length > 0 && (
        <div className="card-row">
          <span>勤務地</span>
          <span>
            {engineer.desiredLocations.join(' / ')}
            {engineer.remoteDesired !== undefined ? ` / ${engineer.remoteDesired ? 'リモート希望' : '出社可'}` : ''}
          </span>
        </div>
      )}
      {engineer.japaneseLevel && (
        <div className="card-row">
          <span>日本語レベル</span>
          <span>{engineer.japaneseLevel}</span>
        </div>
      )}
      {engineer.commercialFlow && (
        <div className="card-row">
          <span>商流</span>
          <span>{engineer.commercialFlow}</span>
        </div>
      )}
    </div>
  );
}

function AnalysisResult({
  analysis,
  projectList,
  engineerPool,
}: {
  analysis: QuickMatchAnalysis;
  projectList: ProjectRecord[];
  engineerPool: EngineerRecord[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggle = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  if (analysis.status === 'empty') {
    return <p className="empty-note">テキストを入力してください。</p>;
  }

  if (analysis.status === 'parse-failed') {
    return (
      <p className="empty-note">
        案件・要員のどちらか判定できませんでした。判定方法を「案件」または「要員」に切り替えて、もう一度お試しください。
      </p>
    );
  }

  if (analysis.status === 'validation-failed') {
    return (
      <div className="card">
        <div className="card-title">
          {analysis.recordType === 'project' ? '案件として解析しましたが、情報が不足しています' : '要員として解析しましたが、情報が不足しています'}
        </div>
        <ul className="empty-note">
          {analysis.errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (analysis.recordType === 'project') {
    const candidates = buildProjectCandidates(analysis.record, engineerPool);
    return (
      <>
        <ProjectSummary project={analysis.record} />
        <h2>手持ち要員とのマッチング</h2>
        {candidates.length === 0 ? (
          <p className="empty-note">候補要員がいません。</p>
        ) : (
          <div>
            <p className="empty-note">候補</p>
            {candidates.map((c, i) => (
              <CandidateCard key={c.id} rank={i + 1} candidate={c} expanded={expandedId === c.id} onToggle={() => toggle(c.id)} />
            ))}
          </div>
        )}
      </>
    );
  }

  const candidates = buildEngineerCandidates(analysis.record, projectList);
  return (
    <>
      <EngineerSummary engineer={analysis.record} />
      <h2>現在の案件とのマッチング</h2>
      {candidates.length === 0 ? (
        <p className="empty-note">候補案件がありません。</p>
      ) : (
        <div>
          <p className="empty-note">候補案件</p>
          {candidates.map((c, i) => (
            <CandidateCard key={c.id} rank={i + 1} candidate={c} expanded={expandedId === c.id} onToggle={() => toggle(c.id)} />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * ⚡ Quick Match — SES営業がLINE等でもらった案件文・要員スキルシートを
 * そのまま貼り付けて、即座に既存の案件/要員データと照合するためのUI。
 *
 * 貼り付け → 判定(自動 or 手動切替) → 既存parserで構造化 → 既存validation →
 * 既存matching/scoring → 結果表示、という一気通貫のフローを、既存の
 * Gmail取り込み・Matching Engineをそのまま呼び出すだけで実現する
 * (新しい抽出・スコアリングロジックはここでは実装しない)。
 *
 * 解析はAPI呼び出しを伴わない同期処理(すべて既存のクライアントサイド
 * parser/scoring)だが、貼り付け直後に反応していることが分かるよう、
 * ボタン押下から1マイクロタスク分だけ'analyzing'状態を経由させる。
 */
export function QuickMatch() {
  const { projectList, engineerPool, useReal } = useMatchingPools();
  const [text, setText] = useState('');
  const [override, setOverride] = useState<QuickMatchOverride>('auto');
  const [status, setStatus] = useState<UiStatus>('idle');
  const [analysis, setAnalysis] = useState<QuickMatchAnalysis | null>(null);

  const handleAnalyze = () => {
    setStatus('analyzing');
    Promise.resolve().then(() => {
      try {
        setAnalysis(analyzeQuickMatchText(text, override));
      } catch {
        // 内部エラーの詳細はUIへ露出しない(既存WorkspaceProviderと同じ方針)。
        setAnalysis({ status: 'parse-failed' });
      } finally {
        setStatus('done');
      }
    });
  };

  return (
    <div className="card">
      <div className="card-title">⚡ Quick Match</div>
      <p className="empty-note">
        案件・要員情報をそのまま貼り付けてください
        {!useReal && '(現在はダミーデータとマッチングします)'}
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="ここに案件文やスキルシートをそのまま貼り付け"
        aria-label="案件・要員テキスト"
        rows={8}
      />

      <div className="quick-match-toolbar">
        <label htmlFor="quick-match-override" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          判定方法
        </label>
        <select
          id="quick-match-override"
          value={override}
          onChange={(e) => setOverride(e.target.value as QuickMatchOverride)}
          aria-label="判定方法"
        >
          <option value="auto">自動判定</option>
          <option value="project">案件</option>
          <option value="engineer">要員</option>
        </select>
      </div>

      <button type="button" onClick={handleAnalyze} disabled={status === 'analyzing'}>
        {status === 'analyzing' ? '解析中…' : analysis ? 'もう一度解析' : '解析してマッチング'}
      </button>

      {status === 'done' && analysis && (
        <AnalysisResult analysis={analysis} projectList={projectList} engineerPool={engineerPool} />
      )}
    </div>
  );
}
