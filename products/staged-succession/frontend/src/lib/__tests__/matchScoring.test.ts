import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AiCandidateScore, ruleBasedScore, scoreCandidates, validateAiResponse } from '../matchScoring';
import { Company, Talent } from '../../types';

const talent: Talent = {
  id: 't1',
  uid: 't1',
  name: 'サンプル太郎',
  skills: ['経理', 'EC運営'],
  interestedIndustries: ['製造業'],
  weeklyAvailableHours: 10,
  workStyle: 'both',
  relocatable: true,
  prefecture: '長野県',
  successionInterestLevel: 5,
  fundingCapacity: 1000,
  bio: 'テスト用',
};

const company: Company = {
  id: 'c1',
  uid: 'c1',
  name: 'サンプル製作所',
  industry: '製造業',
  prefecture: '長野県',
  overview: 'テスト用',
  financialHealth: 'average',
  wantedPersonaTags: ['経理', 'EC運営'],
  wantedPersonaTagWeights: { 経理: 2 },
  sideJobAcceptable: true,
  requiredWeeklyHours: { min: 5, max: 15 },
  successionTimeframe: '1-3y',
};

const mismatchedCompany: Company = {
  ...company,
  id: 'c2',
  industry: '飲食業',
  prefecture: '沖縄県',
  wantedPersonaTags: ['法務'],
  sideJobAcceptable: false,
};

describe('validateAiResponse', () => {
  const valid: AiCandidateScore[] = [
    { candidate_id: 'c1', score: 80, strengths: ['a'], concerns: [], reason: 'ok' },
  ];

  it('accepts a well-formed array', () => {
    expect(validateAiResponse(valid)).toEqual(valid);
  });

  it('rejects a non-array payload', () => {
    expect(validateAiResponse({ not: 'an array' })).toBeNull();
  });

  it('rejects malformed entries (score out of range)', () => {
    expect(validateAiResponse([{ ...valid[0], score: 150 }])).toBeNull();
  });

  it('rejects malformed entries (missing fields)', () => {
    expect(validateAiResponse([{ candidate_id: 'c1', score: 80 }])).toBeNull();
  });

  it('rejects malformed entries (wrong types)', () => {
    expect(validateAiResponse([{ ...valid[0], strengths: 'not-an-array' }])).toBeNull();
  });

  it('accepts an empty array (0 candidates)', () => {
    expect(validateAiResponse([])).toEqual([]);
  });
});

describe('ruleBasedScore', () => {
  it('scores a well-matched pair highly and lists strengths', () => {
    const result = ruleBasedScore('company', company, talent);
    expect(result.candidate_id).toBe('t1');
    expect(result.score).toBeGreaterThan(50);
    expect(result.strengths.length).toBeGreaterThan(0);
    expect(result.reason).toContain('ルールベース');
  });

  it('scores a mismatched pair lower and lists concerns', () => {
    const goodResult = ruleBasedScore('talent', talent, company);
    const badResult = ruleBasedScore('talent', talent, mismatchedCompany);
    expect(badResult.score).toBeLessThan(goodResult.score);
    expect(badResult.concerns.length).toBeGreaterThan(0);
  });

  it('always returns a score within 0-100', () => {
    const result = ruleBasedScore('company', company, talent);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe('scoreCandidates', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('falls back to rule-based scoring when no AI endpoint is configured', async () => {
    const result = await scoreCandidates('company', company, [talent]);
    expect(result.source).toBe('rule-based');
    expect(result.scores.get('t1')).toBeDefined();
  });

  it('handles an empty candidate list without error', async () => {
    const result = await scoreCandidates('company', company, []);
    expect(result.source).toBe('rule-based');
    expect(result.scores.size).toBe(0);
  });

  it('falls back to rule-based when the AI endpoint returns malformed JSON', async () => {
    vi.stubEnv('VITE_AI_MATCH_ENDPOINT', 'https://example.invalid/score');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ not: 'a valid shape' }),
    }) as unknown as typeof fetch;

    const result = await scoreCandidates('company', company, [talent]);
    expect(result.source).toBe('rule-based');
    expect(result.scores.get('t1')).toBeDefined();
  });

  it('falls back to rule-based when the AI endpoint throws (network error / timeout)', async () => {
    vi.stubEnv('VITE_AI_MATCH_ENDPOINT', 'https://example.invalid/score');
    global.fetch = vi.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;

    const result = await scoreCandidates('company', company, [talent]);
    expect(result.source).toBe('rule-based');
  });

  it('falls back to rule-based when the AI endpoint responds with a non-OK status', async () => {
    vi.stubEnv('VITE_AI_MATCH_ENDPOINT', 'https://example.invalid/score');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;

    const result = await scoreCandidates('company', company, [talent]);
    expect(result.source).toBe('rule-based');
  });

  it('uses the AI response when it is well-formed', async () => {
    vi.stubEnv('VITE_AI_MATCH_ENDPOINT', 'https://example.invalid/score');
    const aiPayload: AiCandidateScore[] = [
      { candidate_id: 't1', score: 91, strengths: ['AI strength'], concerns: [], reason: 'AI reason' },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => aiPayload,
    }) as unknown as typeof fetch;

    const result = await scoreCandidates('company', company, [talent]);
    expect(result.source).toBe('ai');
    expect(result.scores.get('t1')?.score).toBe(91);
  });
});
