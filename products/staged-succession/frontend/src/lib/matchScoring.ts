import { scorePhase1 } from '../calc/scoring';
import { Company, Role, Talent } from '../types';

/**
 * AI candidate-scoring contract. The AI's job is ranking only: given a
 * profile and a list of opposite-role candidates, it returns a score +
 * human-readable reasoning per candidate. It never writes to the DB and
 * never decides Like/Match — the swipe UI and api.likeOrSkip own that.
 */
export interface AiCandidateScore {
  candidate_id: string;
  score: number; // 0-100
  strengths: string[];
  concerns: string[];
  reason: string;
}

export type ScoreSource = 'ai' | 'rule-based';

export interface ScoreCandidatesResult {
  scores: Map<string, AiCandidateScore>;
  source: ScoreSource;
}

function isAiCandidateScore(x: unknown): x is AiCandidateScore {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.candidate_id === 'string' &&
    typeof o.score === 'number' &&
    Number.isFinite(o.score) &&
    o.score >= 0 &&
    o.score <= 100 &&
    Array.isArray(o.strengths) &&
    o.strengths.every((s) => typeof s === 'string') &&
    Array.isArray(o.concerns) &&
    o.concerns.every((s) => typeof s === 'string') &&
    typeof o.reason === 'string'
  );
}

/** Returns the validated array, or null if the shape doesn't match the contract at all. */
export function validateAiResponse(json: unknown): AiCandidateScore[] | null {
  if (!Array.isArray(json)) return null;
  if (!json.every(isAiCandidateScore)) return null;
  return json;
}

function talentOf(myRole: Role, myProfile: Talent | Company, candidate: Talent | Company): Talent {
  return (myRole === 'company' ? candidate : myProfile) as Talent;
}

function companyOf(myRole: Role, myProfile: Talent | Company, candidate: Talent | Company): Company {
  return (myRole === 'company' ? myProfile : candidate) as Company;
}

/**
 * Rule-based fallback: wraps the existing, already-tested phase1 scoring
 * engine (src/calc/scoring/phase1.ts) instead of reimplementing matching
 * logic, and derives strengths/concerns/reason from its sub-scores.
 */
export function ruleBasedScore(myRole: Role, myProfile: Talent | Company, candidate: Talent | Company): AiCandidateScore {
  const talent = talentOf(myRole, myProfile, candidate);
  const company = companyOf(myRole, myProfile, candidate);

  const breakdown = scorePhase1({
    talentSkills: talent.skills,
    wantedPersonaTags: company.wantedPersonaTags,
    wantedPersonaTagWeights: company.wantedPersonaTagWeights,
    talentWeeklyAvailableHours: talent.weeklyAvailableHours,
    companyRequiredWeeklyHours: company.requiredWeeklyHours,
    sideJobAcceptable: company.sideJobAcceptable,
    interestedIndustries: talent.interestedIndustries,
    companyIndustry: company.industry,
    talentPrefecture: talent.prefecture,
    companyPrefecture: company.prefecture,
    relocatable: talent.relocatable,
    workStyle: talent.workStyle,
  });

  const strengths: string[] = [];
  const concerns: string[] = [];
  if (breakdown.skillFit >= 0.6) strengths.push('求めるスキル・専門領域との適合度が高い');
  else if (breakdown.skillFit < 0.3) concerns.push('スキル・専門領域の一致が少ない');
  if (breakdown.workloadFit >= 0.7) strengths.push('稼働条件が合っている');
  else if (breakdown.workloadFit < 0.4) concerns.push('稼働可能時間の条件が合わない可能性がある');
  if (breakdown.industryFit >= 0.5) strengths.push('興味のある業種と一致している');
  if (breakdown.regionFit >= 0.7) strengths.push('地域条件が近い、またはリモート対応可能');
  else if (breakdown.regionFit < 0.3) concerns.push('拠点が離れている');

  return {
    candidate_id: candidate.id,
    score: Math.round(breakdown.total * 100),
    strengths: strengths.length > 0 ? strengths : ['基本的な登録情報があります'],
    concerns,
    reason: `スキル適合${Math.round(breakdown.skillFit * 100)}% / 稼働条件${Math.round(
      breakdown.workloadFit * 100
    )}% / 業種興味${Math.round(breakdown.industryFit * 100)}% / 地域${Math.round(
      breakdown.regionFit * 100
    )}%を基に算出（ルールベース）。`,
  };
}

const AI_REQUEST_TIMEOUT_MS = 8000;

/**
 * Tries an AI scoring endpoint first (only if VITE_AI_MATCH_ENDPOINT is
 * configured), and falls back to the rule-based engine on any failure:
 * no endpoint configured, network error, timeout, non-OK response, or a
 * response that fails schema validation. This fallback path is what
 * actually runs in this deployment today, since no AI provider endpoint
 * is configured — see the STEP 2 report for details.
 */
export async function scoreCandidates(
  myRole: Role,
  myProfile: Talent | Company,
  candidates: (Talent | Company)[]
): Promise<ScoreCandidatesResult> {
  const endpoint = import.meta.env.VITE_AI_MATCH_ENDPOINT as string | undefined;

  if (endpoint && candidates.length > 0) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ myRole, myProfile, candidates }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (res.ok) {
        const json = await res.json().catch(() => null);
        const validated = json === null ? null : validateAiResponse(json);
        if (validated) {
          return { scores: new Map(validated.map((s) => [s.candidate_id, s])), source: 'ai' };
        }
      }
    } catch {
      // network error, timeout/abort, or unexpected throw — fall through to rule-based.
    }
  }

  const scores = new Map<string, AiCandidateScore>();
  for (const candidate of candidates) {
    scores.set(candidate.id, ruleBasedScore(myRole, myProfile, candidate));
  }
  return { scores, source: 'rule-based' };
}
