import { validateEngineerRecord } from '../../intake/engineer';
import { validateProjectRecord } from '../../intake/project';
import { dummyEngineers } from '../../demo/dummyData';
import { matchProjectToEngineers } from '../../matching/matchProjectToEngineers';
import type { RawEmail } from '../../gmail/types';
import { parseEmail } from '../parseEmail';

// すべて匿名の合成(synthetic)メール本文。実メール・実在企業・実在人物ではない。

const projectEmail: RawEmail = {
  id: 'email-project-001',
  from: 'agency@example.test',
  subject: '【新規案件】Javaエンジニア募集',
  date: '2026-09-01',
  bodyText: [
    '案件名: 大手金融系システム開発',
    '必須スキル: Java(3年以上)、Spring Boot',
    '歓迎スキル: AWS',
    '単価: 60万円〜80万円',
    '勤務地: 東京都',
    'リモート: 可',
    '稼働開始: 2026-04-01',
    '日本語レベル: ビジネスレベル',
  ].join('\n'),
};

const engineerEmail: RawEmail = {
  id: 'email-engineer-001',
  from: 'engineer-agent@example.test',
  subject: 'スキルシート送付の件',
  date: '2026-09-02',
  bodyText: [
    '要員情報のご案内です。',
    'スキル: Java(5年)、AWS(2年)',
    '希望単価: 70万円',
    '希望勤務地: 東京都、神奈川県',
    'リモート希望: 希望',
    '稼働可能日: 2026-04-01',
    '日本語レベル: ビジネスレベル',
  ].join('\n'),
};

const unrelatedEmail: RawEmail = {
  id: 'email-unrelated-001',
  from: 'colleague@example.test',
  subject: '会議の日程調整について',
  date: '2026-09-03',
  bodyText: '来週の定例会議ですが、火曜14時でよろしいでしょうか。',
};

const incompleteProjectEmail: RawEmail = {
  id: 'email-project-incomplete',
  subject: '案件のご案内(必須スキルのみ)',
  bodyText: '必須スキル: Java(3年以上)',
};

describe('parseEmail', () => {
  it('案件メールをProjectRecord候補へ変換する', () => {
    const result = parseEmail(projectEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.recordType).toBe('project');
    expect(result.candidate).toMatchObject({
      id: 'email-project-001',
      rateMin: 60,
      rateMax: 80,
      location: '東京都',
      remoteAllowed: true,
      startDate: '2026-04-01',
      japaneseLevel: 'business',
    });
    expect(result.candidate.requiredSkills).toEqual([
      { name: 'Java', minYears: 3, required: true },
      { name: 'Spring Boot', minYears: 0, required: true },
      { name: 'AWS', minYears: 0, required: false },
    ]);
  });

  it('要員メールをEngineerRecord候補へ変換する', () => {
    const result = parseEmail(engineerEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.recordType).toBe('engineer');
    expect(result.candidate).toMatchObject({
      id: 'email-engineer-001',
      desiredRateMin: 70,
      desiredRateMax: 70,
      desiredLocations: ['東京都', '神奈川県'],
      remoteDesired: true,
      availableFrom: '2026-04-01',
      japaneseLevel: 'business',
    });
  });

  it('案件/要員のいずれとも判別できないメールはunparsedになる', () => {
    const result = parseEmail(unrelatedEmail);
    expect(result).toEqual({
      status: 'unparsed',
      reason: 'could not determine whether this is a project or engineer email',
    });
  });

  it('必須情報が不足している案件メールはparsed扱いでもvalidationでFAILする', () => {
    const result = parseEmail(incompleteProjectEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.recordType).toBe('project');

    const validation = validateProjectRecord(result.candidate);
    expect(validation.valid).toBe(false);
  });

  it('想定外フォーマット(空・記号のみ等)でもクラッシュしない', () => {
    expect(() => parseEmail({ id: 'e1' })).not.toThrow();
    expect(() => parseEmail({ id: 'e2', bodyText: '' })).not.toThrow();
    expect(() => parseEmail({ id: 'e3', bodyText: '!@#$%^&*()_+{}[]' })).not.toThrow();
    expect(parseEmail({ id: 'e4', bodyText: '案件 要員' }).status).toBe('unparsed'); // 同点は判別不能扱い
  });
});

describe('parseEmail -> 既存Validation -> Matching への接続', () => {
  it('案件メール由来のProjectRecordがvalidationを通過し、既存Matching Engineに接続できる', () => {
    const parsed = parseEmail(projectEmail);
    expect(parsed.status).toBe('parsed');
    if (parsed.status !== 'parsed' || parsed.recordType !== 'project') return;

    const validation = validateProjectRecord(parsed.candidate);
    expect(validation.valid).toBe(true);
    if (!validation.valid) return;

    const results = matchProjectToEngineers(validation.value, dummyEngineers);
    expect(results.length).toBe(dummyEngineers.length);
    expect(results[0].score).toBeGreaterThanOrEqual(results[results.length - 1].score);
  });

  it('要員メール由来のEngineerRecordが既存Validationを通過する', () => {
    const parsed = parseEmail(engineerEmail);
    expect(parsed.status).toBe('parsed');
    if (parsed.status !== 'parsed' || parsed.recordType !== 'engineer') return;

    const validation = validateEngineerRecord(parsed.candidate);
    expect(validation.valid).toBe(true);
  });
});
