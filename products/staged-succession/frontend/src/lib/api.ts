import { supabase } from './supabase';
import { scorePhase1, scorePhase2To3, scorePhase3, PHASE2TO3_PROMOTION_THRESHOLD } from '../calc/scoring';
import {
  Company,
  LikeDecision,
  Match,
  MatchPhase,
  MatchReviews,
  MatchStatus,
  PhaseHistoryEntry,
  Role,
  ScoreBreakdown,
  Talent,
} from '../types';

/** Postgres unique_violation — see https://www.postgresql.org/docs/current/errcodes-appendix.html */
const UNIQUE_VIOLATION = '23505';

const PHASE1_PROMOTION_THRESHOLD = 0.6;

async function requireUser(): Promise<{ uid: string; role: Role }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('サインインが必要です。');
  const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (error || !profile) throw new Error('ロールが設定されていません。');
  return { uid: user.id, role: profile.role as Role };
}

// --- talents ---------------------------------------------------------

interface TalentRow {
  id: string;
  name: string;
  skills: string[];
  interested_industries: string[];
  weekly_available_hours: number;
  work_style: Talent['workStyle'];
  relocatable: boolean;
  prefecture: string;
  succession_interest_level: Talent['successionInterestLevel'];
  funding_capacity: number;
  bio: string | null;
}

function talentFromRow(r: TalentRow): Talent {
  return {
    id: r.id,
    uid: r.id,
    name: r.name,
    skills: r.skills,
    interestedIndustries: r.interested_industries,
    weeklyAvailableHours: r.weekly_available_hours,
    workStyle: r.work_style,
    relocatable: r.relocatable,
    prefecture: r.prefecture,
    successionInterestLevel: r.succession_interest_level,
    fundingCapacity: r.funding_capacity,
    bio: r.bio ?? '',
  };
}

function talentToRow(id: string, t: Omit<Talent, 'id' | 'uid'>) {
  return {
    id,
    name: t.name,
    skills: t.skills,
    interested_industries: t.interestedIndustries,
    weekly_available_hours: t.weeklyAvailableHours,
    work_style: t.workStyle,
    relocatable: t.relocatable,
    prefecture: t.prefecture,
    succession_interest_level: t.successionInterestLevel,
    funding_capacity: t.fundingCapacity,
    bio: t.bio ?? '',
  };
}

// --- companies ---------------------------------------------------------

interface CompanyRow {
  id: string;
  name: string;
  industry: string;
  prefecture: string;
  overview: string;
  financial_health: Company['financialHealth'];
  wanted_persona_tags: string[];
  wanted_persona_tag_weights: Record<string, number> | null;
  side_job_acceptable: boolean;
  required_weekly_hours_min: number;
  required_weekly_hours_max: number;
  succession_timeframe: Company['successionTimeframe'];
}

function companyFromRow(r: CompanyRow): Company {
  return {
    id: r.id,
    uid: r.id,
    name: r.name,
    industry: r.industry,
    prefecture: r.prefecture,
    overview: r.overview,
    financialHealth: r.financial_health,
    wantedPersonaTags: r.wanted_persona_tags,
    wantedPersonaTagWeights: r.wanted_persona_tag_weights ?? {},
    sideJobAcceptable: r.side_job_acceptable,
    requiredWeeklyHours: { min: r.required_weekly_hours_min, max: r.required_weekly_hours_max },
    successionTimeframe: r.succession_timeframe,
  };
}

function companyToRow(id: string, c: Omit<Company, 'id' | 'uid'>) {
  return {
    id,
    name: c.name,
    industry: c.industry,
    prefecture: c.prefecture,
    overview: c.overview,
    financial_health: c.financialHealth,
    wanted_persona_tags: c.wantedPersonaTags,
    wanted_persona_tag_weights: c.wantedPersonaTagWeights ?? {},
    side_job_acceptable: c.sideJobAcceptable,
    required_weekly_hours_min: c.requiredWeeklyHours.min,
    required_weekly_hours_max: c.requiredWeeklyHours.max,
    succession_timeframe: c.successionTimeframe,
  };
}

// --- matches ---------------------------------------------------------

interface MatchRow {
  id: string;
  talent_id: string;
  company_id: string;
  phase: MatchPhase;
  status: MatchStatus;
  score_breakdown: ScoreBreakdown;
  reviews: MatchReviews;
  continuation_intent: { talent?: boolean; company?: boolean };
  message_count: number;
  phase_entered_at: Partial<Record<'1' | '2' | '3', string>>;
}

function matchFromRow(r: MatchRow): Match {
  return {
    id: r.id,
    talentId: r.talent_id,
    companyId: r.company_id,
    phase: r.phase,
    status: r.status,
    scoreBreakdown: r.score_breakdown,
    reviews: r.reviews ?? {},
    messageCount: r.message_count,
    continuationIntent: r.continuation_intent ?? {},
  };
}

function daysSince(iso: string | undefined): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24));
}

function computeCurrentTotal(phase: MatchPhase, breakdown: ScoreBreakdown): number {
  if (phase === 3 && breakdown.phase3) return breakdown.phase3.total;
  if (phase >= 2 && breakdown.phase2to3) return breakdown.phase2to3.total;
  return breakdown.phase1.total;
}

function scorePhase1For(talent: Talent, company: Company) {
  return scorePhase1({
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
}

async function upsertMatchScore(talent: Talent, company: Company): Promise<void> {
  const phase1 = scorePhase1For(talent, company);

  const { data: existing } = await supabase
    .from('matches')
    .select('id, phase, score_breakdown')
    .eq('talent_id', talent.id)
    .eq('company_id', company.id)
    .maybeSingle();

  if (!existing) {
    const scoreBreakdown: ScoreBreakdown = { phase1, currentTotal: phase1.total };
    const { error } = await supabase
      .from('matches')
      .insert({ talent_id: talent.id, company_id: company.id, score_breakdown: scoreBreakdown });
    if (error) throw new Error(error.message);
    return;
  }

  const merged: ScoreBreakdown = { ...(existing.score_breakdown as ScoreBreakdown), phase1 };
  const currentTotal = computeCurrentTotal(existing.phase as MatchPhase, merged);
  const { error } = await supabase
    .from('matches')
    .update({ score_breakdown: { ...merged, currentTotal } })
    .eq('id', existing.id);
  if (error) throw new Error(error.message);
}

async function getOwnTalent(uid: string): Promise<Talent> {
  const { data, error } = await supabase.from('talents').select('*').eq('id', uid).single();
  if (error || !data) throw new Error('先に人材プロフィールを登録してください。');
  return talentFromRow(data as TalentRow);
}

async function getOwnCompany(uid: string): Promise<Company> {
  const { data, error } = await supabase.from('companies').select('*').eq('id', uid).single();
  if (error || !data) throw new Error('先に企業プロフィールを登録してください。');
  return companyFromRow(data as CompanyRow);
}

async function fetchMatchRow(matchId: string): Promise<MatchRow> {
  const { data, error } = await supabase.from('matches').select('*').eq('id', matchId).single();
  if (error || !data) throw new Error('マッチが見つかりません。');
  return data as MatchRow;
}

function assertParticipant(uid: string, row: MatchRow): 'talent' | 'company' {
  if (row.talent_id === uid) return 'talent';
  if (row.company_id === uid) return 'company';
  throw new Error('このマッチの当事者ではありません。');
}

interface PromotionEvaluation {
  phase: MatchPhase;
  eligible: boolean;
  reason: string;
  scoreBreakdown: ScoreBreakdown;
}

async function evaluate(matchId: string): Promise<{ row: MatchRow; evaluation: PromotionEvaluation }> {
  const row = await fetchMatchRow(matchId);

  if (row.phase === 1) {
    const mutualIntent = Boolean(row.continuation_intent?.talent && row.continuation_intent?.company);
    const total = row.score_breakdown.phase1.total;
    const eligible = total >= PHASE1_PROMOTION_THRESHOLD && mutualIntent;
    return {
      row,
      evaluation: {
        phase: 1,
        eligible,
        reason: eligible
          ? 'フェーズ1スコアが基準を満たし、双方が継続を希望しています。'
          : `フェーズ1スコア(${total}) >= ${PHASE1_PROMOTION_THRESHOLD} かつ双方の継続希望が必要です。`,
        scoreBreakdown: row.score_breakdown,
      },
    };
  }

  if (row.phase === 2) {
    const phase2to3 = scorePhase2To3({
      engagementDurationDays: daysSince(row.phase_entered_at?.['1']),
      messageCount: row.message_count ?? 0,
      talentRating: row.reviews?.talentRating,
      companyRating: row.reviews?.companyRating,
      phase1Total: row.score_breakdown.phase1.total,
    });
    const scoreBreakdown: ScoreBreakdown = { ...row.score_breakdown, phase2to3, currentTotal: phase2to3.total };
    const { error } = await supabase.from('matches').update({ score_breakdown: scoreBreakdown }).eq('id', matchId);
    if (error) throw new Error(error.message);

    return {
      row: { ...row, score_breakdown: scoreBreakdown },
      evaluation: {
        phase: 2,
        eligible: phase2to3.eligibleForPhase3,
        reason: phase2to3.eligibleForPhase3
          ? '関与期間・やり取り量・レビューの総合スコアが承継検討フェーズの基準を満たしています。'
          : `昇格スコア(${phase2to3.total}) が基準(${PHASE2TO3_PROMOTION_THRESHOLD})未満です。`,
        scoreBreakdown,
      },
    };
  }

  return {
    row,
    evaluation: {
      phase: row.phase,
      eligible: false,
      reason: 'フェーズ3は最終フェーズです。承継成立(complete)または解消(decline)のみ選択できます。',
      scoreBreakdown: row.score_breakdown,
    },
  };
}

async function insertHistory(
  matchId: string,
  fromPhase: MatchPhase | null,
  toPhase: MatchPhase | 'declined' | 'completed',
  reason: string,
  changedBy: string,
  scoreAtChange: number
) {
  const { error } = await supabase.from('phase_history').insert({
    match_id: matchId,
    from_phase: fromPhase,
    to_phase: String(toPhase),
    reason,
    changed_by: changedBy,
    score_at_change: scoreAtChange,
  });
  if (error) throw new Error(error.message);
}

function parsePhaseOrStatus(s: string): MatchPhase | MatchStatus {
  if (s === '1' || s === '2' || s === '3') return Number(s) as MatchPhase;
  return s as MatchStatus;
}

/**
 * Called after recording a 'like'. Checks whether the target already liked
 * the caller back and, if so, creates the match — reusing the exact same
 * phase1 scoring + row shape `upsertMatchScore` already writes, so a
 * swipe-born match is indistinguishable from a "候補を再計算"-born one.
 *
 * Race-safe by construction: `matches` has a `unique (talent_id, company_id)`
 * constraint (0001_init.sql), so if two concurrent requests both try to
 * create the same match, the second insert fails with a unique_violation,
 * which is treated as success (re-fetch and return the winner's row) rather
 * than an error.
 */
async function checkMutualLikeAndCreateMatch(uid: string, role: Role, targetId: string): Promise<Match | null> {
  const { data: reciprocal, error: reciprocalError } = await supabase
    .from('likes')
    .select('decision')
    .eq('liker_id', targetId)
    .eq('target_id', uid)
    .maybeSingle();
  if (reciprocalError) throw new Error(reciprocalError.message);
  if (!reciprocal || reciprocal.decision !== 'like') return null;

  const talentId = role === 'talent' ? uid : targetId;
  const companyId = role === 'talent' ? targetId : uid;

  const { data: existing, error: existingError } = await supabase
    .from('matches')
    .select('*')
    .eq('talent_id', talentId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return matchFromRow(existing as MatchRow);

  const [talent, company] = await Promise.all([
    role === 'talent' ? getOwnTalent(uid) : api.getTalent(targetId),
    role === 'company' ? getOwnCompany(uid) : api.getCompany(targetId),
  ]);
  const phase1 = scorePhase1For(talent, company);
  const scoreBreakdown: ScoreBreakdown = { phase1, currentTotal: phase1.total };

  const { data: inserted, error: insertError } = await supabase
    .from('matches')
    .insert({ talent_id: talentId, company_id: companyId, score_breakdown: scoreBreakdown })
    .select('*')
    .single();

  if (insertError) {
    if ((insertError as { code?: string }).code === UNIQUE_VIOLATION) {
      const { data: raceWinner, error: raceError } = await supabase
        .from('matches')
        .select('*')
        .eq('talent_id', talentId)
        .eq('company_id', companyId)
        .single();
      if (raceError || !raceWinner) throw new Error(raceError?.message ?? 'マッチの取得に失敗しました。');
      return matchFromRow(raceWinner as MatchRow);
    }
    throw new Error(insertError.message);
  }
  return matchFromRow(inserted as MatchRow);
}

export const api = {
  // --- talents ---
  upsertTalent: async (data: Omit<Talent, 'id' | 'uid'>) => {
    const { uid } = await requireUser();
    const { error } = await supabase.from('talents').upsert(talentToRow(uid, data));
    if (error) throw new Error(error.message);
    return { id: uid };
  },
  getTalent: async (id: string): Promise<Talent> => {
    const { data, error } = await supabase.from('talents').select('*').eq('id', id).single();
    if (error || !data) throw new Error('人材プロフィールが見つかりません。');
    return talentFromRow(data as TalentRow);
  },
  listTalents: async (limit = 50) => {
    const { data, error } = await supabase
      .from('talents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return { talents: (data as TalentRow[]).map(talentFromRow) };
  },

  // --- companies ---
  upsertCompany: async (data: Omit<Company, 'id' | 'uid'>) => {
    const { uid } = await requireUser();
    const { error } = await supabase.from('companies').upsert(companyToRow(uid, data));
    if (error) throw new Error(error.message);
    return { id: uid };
  },
  getCompany: async (id: string): Promise<Company> => {
    const { data, error } = await supabase.from('companies').select('*').eq('id', id).single();
    if (error || !data) throw new Error('企業プロフィールが見つかりません。');
    return companyFromRow(data as CompanyRow);
  },
  listCompanies: async (limit = 50) => {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return { companies: (data as CompanyRow[]).map(companyFromRow) };
  },

  // --- matching ---
  refreshMatchesForCaller: async () => {
    const { uid, role } = await requireUser();

    if (role === 'talent') {
      const talent = await getOwnTalent(uid);
      const { data: companies, error } = await supabase.from('companies').select('*');
      if (error) throw new Error(error.message);
      const rows = (companies as CompanyRow[]).map(companyFromRow);
      await Promise.all(rows.map((c) => upsertMatchScore(talent, c)));
      return { matched: rows.length };
    }

    const company = await getOwnCompany(uid);
    const { data: talents, error } = await supabase.from('talents').select('*');
    if (error) throw new Error(error.message);
    const rows = (talents as TalentRow[]).map(talentFromRow);
    await Promise.all(rows.map((t) => upsertMatchScore(t, company)));
    return { matched: rows.length };
  },

  listMatchesForCaller: async (phase?: MatchPhase) => {
    const { uid, role } = await requireUser();
    let query = supabase.from('matches').select('*').eq(role === 'company' ? 'company_id' : 'talent_id', uid);
    if (phase !== undefined) query = query.eq('phase', phase);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const matches = (data as MatchRow[]).map(matchFromRow).sort((a, b) => b.scoreBreakdown.currentTotal - a.scoreBreakdown.currentTotal);
    return { matches };
  },

  // --- messaging ---
  sendMessage: async (matchId: string, body: string) => {
    const { uid, role } = await requireUser();
    const { data, error } = await supabase
      .from('messages')
      .insert({ match_id: matchId, sender_id: uid, sender_role: role, body })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return { id: data.id as string };
  },

  // --- reviews ---
  submitReview: async (matchId: string, rating: number, comment?: string) => {
    const { uid, role } = await requireUser();
    const row = await fetchMatchRow(matchId);
    const side = assertParticipant(uid, row);
    if (side !== role) throw new Error('ロールとマッチの当事者が一致しません。');

    const reviews: MatchReviews = { ...row.reviews };
    if (side === 'talent') {
      reviews.talentRating = rating as MatchReviews['talentRating'];
      reviews.talentComment = comment ?? '';
    } else {
      reviews.companyRating = rating as MatchReviews['companyRating'];
      reviews.companyComment = comment ?? '';
    }
    const { error } = await supabase.from('matches').update({ reviews }).eq('id', matchId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  },

  // --- phases ---
  expressContinuationIntent: async (matchId: string) => {
    const { uid } = await requireUser();
    const row = await fetchMatchRow(matchId);
    const side = assertParticipant(uid, row);
    const continuationIntent = { ...row.continuation_intent, [side]: true };
    const { error } = await supabase.from('matches').update({ continuation_intent: continuationIntent }).eq('id', matchId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  },

  evaluatePhaseUpgrade: async (matchId: string) => {
    const { uid } = await requireUser();
    const { row, evaluation } = await evaluate(matchId);
    assertParticipant(uid, row);
    return evaluation;
  },

  changePhase: async (matchId: string, action: 'promote' | 'decline' | 'complete', reason?: string) => {
    const { uid } = await requireUser();
    const row = await fetchMatchRow(matchId);
    assertParticipant(uid, row);

    if (row.status !== 'active') throw new Error('このマッチは既に終了しています。');

    if (action === 'decline') {
      const { error } = await supabase.from('matches').update({ status: 'declined' }).eq('id', matchId);
      if (error) throw new Error(error.message);
      await insertHistory(matchId, row.phase, 'declined', reason || '当事者による解消', uid, row.score_breakdown.currentTotal);
      return { status: 'declined' as const };
    }

    if (action === 'complete') {
      if (row.phase !== 3) throw new Error('フェーズ3のマッチのみ承継成立にできます。');
      const { error } = await supabase.from('matches').update({ status: 'completed' }).eq('id', matchId);
      if (error) throw new Error(error.message);
      await insertHistory(matchId, 3, 'completed', reason || '事業承継が成立しました。', uid, row.score_breakdown.currentTotal);
      return { status: 'completed' as const };
    }

    // action === 'promote'
    const { evaluation } = await evaluate(matchId);
    if (!evaluation.eligible) throw new Error(evaluation.reason);

    if (row.phase === 1) {
      const phaseEnteredAt = { ...row.phase_entered_at, '2': new Date().toISOString() };
      const { error } = await supabase.from('matches').update({ phase: 2, phase_entered_at: phaseEnteredAt }).eq('id', matchId);
      if (error) throw new Error(error.message);
      await insertHistory(matchId, 1, 2, reason || evaluation.reason, uid, evaluation.scoreBreakdown.currentTotal);
      return { status: 'active' as const, phase: 2 as MatchPhase };
    }

    if (row.phase === 2) {
      const talent = await api.getTalent(row.talent_id);
      const company = await api.getCompany(row.company_id);
      const phase3 = scorePhase3({
        successionInterestLevel: talent.successionInterestLevel,
        fundingCapacity: talent.fundingCapacity,
        successionTimeframe: company.successionTimeframe,
        talentPrefecture: talent.prefecture,
        companyPrefecture: company.prefecture,
        relocatable: talent.relocatable,
      });
      const scoreBreakdown: ScoreBreakdown = { ...evaluation.scoreBreakdown, phase3, currentTotal: phase3.total };
      const phaseEnteredAt = { ...row.phase_entered_at, '3': new Date().toISOString() };
      const { error } = await supabase
        .from('matches')
        .update({ phase: 3, score_breakdown: scoreBreakdown, phase_entered_at: phaseEnteredAt })
        .eq('id', matchId);
      if (error) throw new Error(error.message);
      await insertHistory(matchId, 2, 3, reason || evaluation.reason, uid, phase3.total);
      return { status: 'active' as const, phase: 3 as MatchPhase };
    }

    throw new Error('これ以上昇格できません。');
  },

  // --- like / skip (swipe) ---
  listDecidedTargetIds: async (): Promise<Set<string>> => {
    const { uid } = await requireUser();
    const { data, error } = await supabase.from('likes').select('target_id').eq('liker_id', uid);
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((r) => r.target_id as string));
  },

  likeOrSkip: async (targetId: string, decision: LikeDecision): Promise<{ match: Match | null }> => {
    const { uid, role } = await requireUser();
    if (targetId === uid) throw new Error('自分自身は選択できません。');

    const { error } = await supabase.from('likes').insert({ liker_id: uid, liker_role: role, target_id: targetId, decision });
    if (error && (error as { code?: string }).code !== UNIQUE_VIOLATION) throw new Error(error.message);
    // unique_violation here just means this candidate was already decided
    // (duplicate Like/Skip) — idempotent, not an error.

    if (decision === 'skip') return { match: null };
    const match = await checkMutualLikeAndCreateMatch(uid, role, targetId);
    return { match };
  },

  listPhaseHistory: async (matchId: string): Promise<{ history: PhaseHistoryEntry[] }> => {
    const { data, error } = await supabase
      .from('phase_history')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    const history: PhaseHistoryEntry[] = (data ?? []).map((h) => ({
      id: h.id,
      matchId: h.match_id,
      fromPhase: h.from_phase,
      toPhase: parsePhaseOrStatus(h.to_phase),
      reason: h.reason,
      changedBy: h.changed_by,
      scoreAtChange: h.score_at_change,
      createdAt: h.created_at,
    }));
    return { history };
  },
};

