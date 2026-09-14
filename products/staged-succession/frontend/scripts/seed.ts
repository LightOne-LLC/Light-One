/**
 * Seeds a Supabase project with 5 fictional talents + 5 fictional companies
 * (see scripts/seedData.ts — clearly-fake demo/test data, never real people
 * or companies). Only a few pairs are matched (see SEED_MATCH_PAIRS below):
 * one walks through phase1 -> phase2 -> phase3, another sits partway into
 * phase2, and one stays a plain phase-1 match — most pairs are left
 * unmatched so the Search screen shows both "未接触" and "つながり中".
 *
 * Idempotent: safe to re-run. Users/profiles/talents/companies use
 * create-or-find + upsert, matches/messages/phase_history are only written
 * if they don't already exist for that pair/match.
 *
 * Requires admin (service_role) access, so this is a one-off Node script
 * run locally by whoever owns the Supabase project — never something the
 * deployed frontend runs itself.
 *
 * Usage:
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   npx tsx scripts/seed.ts
 */
import { createClient } from '@supabase/supabase-js';
import { scorePhase1, scorePhase2To3, scorePhase3 } from '../src/calc/scoring';
import { Company, Talent } from '../src/types';
import { SEED_COMPANIES, SEED_PASSWORD, SEED_TALENTS, SeedCompany, SeedTalent } from './seedData';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Project Settings > API) before running this script.');
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function getOrCreateUser(email: string): Promise<string> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
  });
  if (!error && created.user) return created.user.id;

  const { data: list, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email === email);
  if (!existing) throw new Error(`Could not create or find user ${email}: ${error?.message}`);
  return existing.id;
}

function talentToRow(id: string, t: SeedTalent) {
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

function companyToRow(id: string, c: SeedCompany) {
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

/**
 * profiles has no UPDATE grant (role is immutable by design), but
 * `.upsert()` compiles to `INSERT ... ON CONFLICT DO UPDATE`, which Postgres
 * privilege-checks for INSERT *and* UPDATE up front regardless of whether a
 * conflict actually happens — so upserting profiles as service_role always
 * fails permission checks. A plain check-then-insert avoids that.
 */
async function insertProfileIfMissing(id: string, role: 'talent' | 'company'): Promise<void> {
  const { data: existing, error: findError } = await admin.from('profiles').select('id').eq('id', id).maybeSingle();
  if (findError) throw findError;
  if (existing) return;
  const { error } = await admin.from('profiles').insert({ id, role });
  if (error) throw error;
}

async function seedProfiles(): Promise<{ talentIds: string[]; companyIds: string[] }> {
  const talentIds: string[] = [];
  for (const t of SEED_TALENTS) {
    const id = await getOrCreateUser(t.email);
    await insertProfileIfMissing(id, 'talent');
    const { error } = await admin.from('talents').upsert(talentToRow(id, t));
    if (error) throw error;
    talentIds.push(id);
  }

  const companyIds: string[] = [];
  for (const c of SEED_COMPANIES) {
    const id = await getOrCreateUser(c.email);
    await insertProfileIfMissing(id, 'company');
    const { error } = await admin.from('companies').upsert(companyToRow(id, c));
    if (error) throw error;
    companyIds.push(id);
  }

  console.log(`Seeded ${talentIds.length} talents and ${companyIds.length} companies.`);
  return { talentIds, companyIds };
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

/**
 * Only a handful of talent/company pairs get a match — most stay
 * unmatched so the Search screen shows a realistic mix of "未接触" and
 * "つながり中" instead of every candidate already being connected.
 */
const SEED_MATCH_PAIRS: [talentIndex: number, companyIndex: number][] = [
  [0, 0], // walked through to phase 3 below
  [3, 3], // walked through to phase 2 below
  [1, 2], // left as a plain phase-1 match
];

async function getOrCreateMatch(talent: Talent, company: Company): Promise<string> {
  const { data: existing, error: findError } = await admin
    .from('matches')
    .select('id')
    .eq('talent_id', talent.id)
    .eq('company_id', company.id)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing.id as string;

  const phase1 = scorePhase1For(talent, company);
  const { data, error } = await admin
    .from('matches')
    .insert({ talent_id: talent.id, company_id: company.id, score_breakdown: { phase1, currentTotal: phase1.total } })
    .select('id')
    .single();
  if (error) throw error;
  await admin.from('matches').update({ phase_entered_at: { '1': daysAgo(60) } }).eq('id', data.id);
  return data.id as string;
}

async function seedMatches(talents: Talent[], companies: Company[]): Promise<Map<string, string>> {
  const matchIdByPair = new Map<string, string>();
  for (const [ti, ci] of SEED_MATCH_PAIRS) {
    const talent = talents[ti];
    const company = companies[ci];
    const id = await getOrCreateMatch(talent, company);
    matchIdByPair.set(`${talent.id}_${company.id}`, id);
  }
  console.log(`Seeded ${matchIdByPair.size} matches (out of ${talents.length * companies.length} possible pairs).`);
  return matchIdByPair;
}

async function seedMessages(matchId: string, talentId: string, companyId: string, exchanges: number, startDaysAgo: number) {
  const { count, error: countError } = await admin
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('match_id', matchId);
  if (countError) throw countError;
  if (count && count > 0) return; // already seeded on a previous run

  const rows = Array.from({ length: exchanges }, (_, i) => {
    const isTalentTurn = i % 2 === 0;
    const day = Math.max(startDaysAgo - i * (startDaysAgo / exchanges), 0.1);
    return {
      match_id: matchId,
      sender_id: isTalentTurn ? talentId : companyId,
      sender_role: isTalentTurn ? 'talent' : 'company',
      body: isTalentTurn ? `よろしくお願いします。進捗共有です(${i + 1})。` : `ありがとうございます、確認しました(${i + 1})。`,
      created_at: daysAgo(day),
    };
  });
  const { error } = await admin.from('messages').insert(rows);
  if (error) throw error;
  await admin
    .from('matches')
    .update({ message_count: exchanges, first_message_at: daysAgo(startDaysAgo), last_message_at: daysAgo(0.1) })
    .eq('id', matchId);
}

async function insertPhaseHistoryIfMissing(
  matchId: string,
  fromPhase: number,
  toPhase: string,
  rest: { reason: string; changed_by: string; score_at_change: number; created_at: string }
) {
  const { data: existing, error } = await admin
    .from('phase_history')
    .select('id')
    .eq('match_id', matchId)
    .eq('to_phase', toPhase)
    .maybeSingle();
  if (error) throw error;
  if (existing) return; // already recorded on a previous run

  await admin.from('phase_history').insert({ match_id: matchId, from_phase: fromPhase, to_phase: toPhase, ...rest });
}

async function seedPhaseWalkthrough(talents: Talent[], companies: Company[], matchIdByPair: Map<string, string>) {
  const talent1 = talents[0];
  const company1 = companies[0];
  const matchId1 = matchIdByPair.get(`${talent1.id}_${company1.id}`)!;

  await seedMessages(matchId1, talent1.id, company1.id, 50, 45);

  const { data: match1Row, error: match1Error } = await admin.from('matches').select('phase').eq('id', matchId1).single();
  if (match1Error) throw match1Error;

  const phase1a = scorePhase1For(talent1, company1);
  const phase2to3a = scorePhase2To3({
    engagementDurationDays: 45,
    messageCount: 50,
    talentRating: 5,
    companyRating: 4,
    phase1Total: phase1a.total,
  });
  const phase3a = scorePhase3({
    successionInterestLevel: talent1.successionInterestLevel,
    fundingCapacity: talent1.fundingCapacity,
    successionTimeframe: company1.successionTimeframe,
    talentPrefecture: talent1.prefecture,
    companyPrefecture: company1.prefecture,
    relocatable: talent1.relocatable,
  });

  if (match1Row.phase < 2) {
    await admin
      .from('matches')
      .update({
        continuation_intent: { talent: true, company: true },
        reviews: { talentRating: 5, talentComment: '想像以上に温かく迎えてもらえた', companyRating: 4, companyComment: '真剣に向き合ってくれている' },
        phase: 2,
        phase_entered_at: { '1': daysAgo(60), '2': daysAgo(20) },
      })
      .eq('id', matchId1);
  }
  await insertPhaseHistoryIfMissing(matchId1, 1, '2', {
    reason: 'フェーズ1スコアが基準を満たし、双方が継続を希望しました。',
    changed_by: talent1.id,
    score_at_change: phase1a.total,
    created_at: daysAgo(20),
  });

  if (match1Row.phase < 3) {
    await admin
      .from('matches')
      .update({
        phase: 3,
        score_breakdown: { phase1: phase1a, phase2to3: phase2to3a, phase3: phase3a, currentTotal: phase3a.total },
        phase_entered_at: { '1': daysAgo(60), '2': daysAgo(20), '3': daysAgo(2) },
      })
      .eq('id', matchId1);
  }
  await insertPhaseHistoryIfMissing(matchId1, 2, '3', {
    reason: '関与期間・やり取り量・レビューの総合スコアが承継検討フェーズの基準を満たしました。',
    changed_by: company1.id,
    score_at_change: phase2to3a.total,
    created_at: daysAgo(2),
  });
  console.log(`t1 x c1 walked through phase1(${phase1a.total}) -> phase2(${phase2to3a.total}) -> phase3(${phase3a.total}).`);

  const talent4 = talents[3];
  const company4 = companies[3];
  const matchId2 = matchIdByPair.get(`${talent4.id}_${company4.id}`)!;
  await seedMessages(matchId2, talent4.id, company4.id, 8, 10);

  const { data: match2Row, error: match2Error } = await admin.from('matches').select('phase').eq('id', matchId2).single();
  if (match2Error) throw match2Error;

  if (match2Row.phase < 2) {
    await admin
      .from('matches')
      .update({
        continuation_intent: { talent: true, company: true },
        phase: 2,
        phase_entered_at: { '1': daysAgo(60), '2': daysAgo(10) },
      })
      .eq('id', matchId2);
  }
  await insertPhaseHistoryIfMissing(matchId2, 1, '2', {
    reason: 'フェーズ1スコアが基準を満たし、双方が継続を希望しました。',
    changed_by: talent4.id,
    score_at_change: 0.75,
    created_at: daysAgo(10),
  });
  console.log('t4 x c4 advanced to phase 2 (not yet eligible for phase 3) as an in-progress example.');
}

async function main() {
  const { talentIds, companyIds } = await seedProfiles();

  const { data: talentRows, error: talentsErr } = await admin.from('talents').select('*').in('id', talentIds);
  if (talentsErr) throw talentsErr;
  const { data: companyRows, error: companiesErr } = await admin.from('companies').select('*').in('id', companyIds);
  if (companiesErr) throw companiesErr;

  const talents: Talent[] = talentRows.map((r) => ({
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
    bio: r.bio,
  }));
  const companies: Company[] = companyRows.map((r) => ({
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
  }));

  const matchIdByPair = await seedMatches(talents, companies);
  await seedPhaseWalkthrough(talents, companies, matchIdByPair);

  console.log(`Seed complete. Sign in as any of the seed emails with password "${SEED_PASSWORD}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
