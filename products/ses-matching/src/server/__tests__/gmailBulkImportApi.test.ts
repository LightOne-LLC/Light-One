import type { RawEmail } from '../../gmail/types';
import { clampLimit, DEFAULT_LIMIT, MAX_LIMIT, performGmailBulkImport } from '../gmailBulkImportApi';

// すべて匿名の合成(synthetic)メール。実Gmail/OAuthには一切アクセスしない
// (fetchRawEmailsを差し替えて注入する)。

const SECRET_BODY_MARKER = '__この文字列は絶対にレスポンスへ含まれてはいけない本文__';

const validProjectEmail: RawEmail = {
  id: 'email-project-valid',
  from: 'agency@example.test',
  subject: '【新規案件】Javaエンジニア募集',
  bodyText: [
    SECRET_BODY_MARKER,
    '必須スキル: Java(3年以上)',
    '単価: 60万円〜80万円',
    '勤務地: 東京都',
    'リモート: 可',
    '稼働開始: 2026-04-01',
  ].join('\n'),
};

const incompleteProjectEmail: RawEmail = {
  id: 'email-project-incomplete',
  subject: '案件のご案内',
  bodyText: `${SECRET_BODY_MARKER}\n必須スキル: Java(3年以上)`,
};

const validEngineerEmail: RawEmail = {
  id: 'email-engineer-valid',
  subject: 'スキルシート送付の件',
  bodyText: [
    SECRET_BODY_MARKER,
    'スキル: Java(5年)',
    '希望単価: 70万円',
    '希望勤務地: 東京都',
    'リモート希望: 希望',
    '稼働可能日: 2026-04-01',
  ].join('\n'),
};

const anotherValidEngineerEmail: RawEmail = {
  id: 'email-engineer-valid-2',
  subject: 'スキルシート送付の件2',
  bodyText: [
    SECRET_BODY_MARKER,
    'スキル: AWS(3年)',
    '希望単価: 65万円',
    '希望勤務地: 東京都',
    'リモート希望: 希望',
    '稼働可能日: 2026-05-01',
  ].join('\n'),
};

// BP-A形式(・稼働：に年の無い"10月〜"のみ記載 -> unknown precisionとなり
// validationはFAILする)。
const incompleteBpEngineerEmail: RawEmail = {
  id: 'email-engineer-bp-incomplete',
  subject: '個人事業主のご紹介',
  bodyText: [
    SECRET_BODY_MARKER,
    '■基本情報',
    '・最寄駅：渋谷駅',
    '■希望条件',
    '・稼働：10月〜',
    '・ご経歴を拝見しご連絡いたしました',
    '■スキル',
    'Java',
    '募集フォームよりご連絡ください',
  ].join('\n'),
};

// 株式会社キャリアビート形式(■ラベル■値、両側■)の案件メール。
// ■期間■に年+月のみ(日無し)の表記があり、month precisionとして取得できる。
const monthPrecisionProjectEmail: RawEmail = {
  id: 'email-project-month-precision',
  subject: '案件のご紹介',
  bodyText: [
    SECRET_BODY_MARKER,
    '■必須スキル■',
    'Java、Spring Boot',
    '■単価■',
    '60万円~80万円',
    '■場所■',
    '東京都',
    '■期間■',
    '2026年10月 ~ 2027年3月',
  ].join('\n'),
};

// 同形式で■期間■が「即日~長期」の案件メール(immediate precision)。
const immediateProjectEmail: RawEmail = {
  id: 'email-project-immediate',
  subject: '案件のご紹介2',
  bodyText: [
    SECRET_BODY_MARKER,
    '■必須スキル■',
    'Java',
    '■単価■',
    '70万円',
    '■場所■',
    '大阪府',
    '■期間■',
    '即日~長期',
  ].join('\n'),
};

const unrelatedEmail: RawEmail = {
  id: 'email-unrelated',
  subject: '会議の日程調整について',
  bodyText: `${SECRET_BODY_MARKER}\n来週の定例会議の件です。`,
};

describe('clampLimit', () => {
  it('デフォルト値(200)を返す(未指定)', () => {
    expect(clampLimit(undefined)).toBe(DEFAULT_LIMIT);
  });

  it('0以下の値はデフォルト値へ丸める', () => {
    expect(clampLimit(0)).toBe(DEFAULT_LIMIT);
    expect(clampLimit(-5)).toBe(DEFAULT_LIMIT);
  });

  it('数値でない値はデフォルト値へ丸める', () => {
    expect(clampLimit('abc')).toBe(DEFAULT_LIMIT);
    expect(clampLimit(null)).toBe(DEFAULT_LIMIT);
  });

  it('MAX_LIMIT(200)を超える値は上限に丸める(ユーザー入力をそのままGmail APIへ渡さない)', () => {
    expect(clampLimit(9999)).toBe(MAX_LIMIT);
  });

  it('範囲内の値はそのまま(整数化して)使う', () => {
    expect(clampLimit(30)).toBe(30);
    expect(clampLimit('30')).toBe(30);
    expect(clampLimit(30.9)).toBe(30);
  });
});

describe('performGmailBulkImport', () => {
  it('複数メールを分類・集計する(project/engineer/unparsed)', async () => {
    const result = await performGmailBulkImport(50, async () => [
      validProjectEmail,
      incompleteProjectEmail,
      validEngineerEmail,
      unrelatedEmail,
    ]);

    expect(result.success).toBe(true);
    expect(result.fetched).toBe(4);
    expect(result.project).toEqual({
      total: 2,
      valid: 1,
      invalid: 1,
      datePrecision: { day: 1, month: 0, immediate: 0, unknown: 0, missing: 1 },
    });
    expect(result.engineer).toEqual({
      total: 1,
      valid: 1,
      invalid: 0,
      datePrecision: { day: 1, month: 0, immediate: 0, unknown: 0, missing: 0 },
    });
    expect(result.unparsed).toBe(1);
  });

  it('limitをclampしてから使う(ユーザー入力をそのままGmail APIへ渡さない)', async () => {
    const fetchRawEmails = vi.fn().mockResolvedValue([]);
    const result = await performGmailBulkImport(9999, fetchRawEmails);

    expect(fetchRawEmails).toHaveBeenCalledWith(MAX_LIMIT);
    expect(result.limit).toBe(MAX_LIMIT);
  });

  it('空の結果でもクラッシュせずゼロ集計を返す', async () => {
    const result = await performGmailBulkImport(50, async () => []);

    const emptyDatePrecision = { day: 0, month: 0, immediate: 0, unknown: 0, missing: 0 };
    expect(result.success).toBe(true);
    expect(result.fetched).toBe(0);
    expect(result.project).toEqual({ total: 0, valid: 0, invalid: 0, datePrecision: emptyDatePrecision });
    expect(result.engineer).toEqual({ total: 0, valid: 0, invalid: 0, datePrecision: emptyDatePrecision });
    expect(result.unparsed).toBe(0);
    expect(result.validationErrors).toEqual({});
    expect(result.matching).toEqual({ validProjects: 0, validEngineers: 0, matchableProjects: 0, sample: undefined });
  });

  it('Gmail取得失敗時はsuccess:falseとreasonを返す(集計フィールドは含めない)', async () => {
    const result = await performGmailBulkImport(50, async () => {
      throw new Error('network unreachable');
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe('network unreachable');
    expect(result.project).toBeUndefined();
  });

  it('想定外の形式(malformed)のメールでも例外を投げず、unparsedとして扱う', async () => {
    const malformedEmail = { id: 'malformed' } as RawEmail; // bodyText/subjectが無い
    const result = await performGmailBulkImport(50, async () => [malformedEmail]);

    expect(result.success).toBe(true);
    expect(result.unparsed).toBe(1);
  });

  it('validationのFAIL理由をフィールド名別に集計する(個別メールの内容は含めない)', async () => {
    const result = await performGmailBulkImport(50, async () => [incompleteProjectEmail, incompleteBpEngineerEmail]);

    expect(result.success).toBe(true);
    // incompleteProjectEmailは必須スキルのみ記載 -> rateMin/rateMax/location/remoteAllowed/startDateが不足
    expect(result.validationErrors?.rateMin).toBeGreaterThan(0);
    expect(result.validationErrors?.location).toBeGreaterThan(0);
    // incompleteBpEngineerEmailはavailableFromが不足(今回未対応のため必然)
    expect(result.validationErrors?.availableFrom).toBeGreaterThan(0);
    // 個別メールの本文/氏名/メールアドレスがどこにも含まれない
    expect(JSON.stringify(result)).not.toContain(SECRET_BODY_MARKER);
  });

  it('validな案件・要員が揃えばmatchProjectToEngineers()でランキングまで返す', async () => {
    const result = await performGmailBulkImport(50, async () => [
      validProjectEmail,
      validEngineerEmail,
      anotherValidEngineerEmail,
    ]);

    expect(result.success).toBe(true);
    expect(result.matching?.validProjects).toBe(1);
    expect(result.matching?.validEngineers).toBe(2);
    expect(result.matching?.matchableProjects).toBe(1);
    expect(result.matching?.sample?.projectId).toBe('email-project-valid');
    expect(result.matching?.sample?.ranking).toHaveLength(2);
    // スコア降順であることを確認(既存matchProjectToEngineersの挙動をそのまま利用)
    const scores = result.matching?.sample?.ranking.map((r) => r.score) ?? [];
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('validな要員が0件の場合、案件がvalidでもmatchableProjectsは0、sampleも無い', async () => {
    const result = await performGmailBulkImport(50, async () => [validProjectEmail, incompleteBpEngineerEmail]);

    expect(result.success).toBe(true);
    expect(result.matching?.validProjects).toBe(1);
    expect(result.matching?.validEngineers).toBe(0);
    expect(result.matching?.matchableProjects).toBe(0);
    expect(result.matching?.sample).toBeUndefined();
  });

  it('レスポンスに本文(bodyText)・from・subjectを一切含めない', async () => {
    const result = await performGmailBulkImport(50, async () => [
      validProjectEmail,
      validEngineerEmail,
      incompleteBpEngineerEmail,
      unrelatedEmail,
    ]);

    const json = JSON.stringify(result);
    expect(json).not.toContain(SECRET_BODY_MARKER);
    expect(json).not.toContain('agency@example.test');
    expect(json).not.toContain('スキルシート送付の件');
  });

  it('日付精度(day/month/immediate/unknown/missing)をフィールド別に正しく集計する', async () => {
    const result = await performGmailBulkImport(50, async () => [
      validProjectEmail, // startDate: day
      monthPrecisionProjectEmail, // startDate: month
      immediateProjectEmail, // startDate: immediate
      incompleteProjectEmail, // startDate: missing(記載なし)
      validEngineerEmail, // availableFrom: day
      anotherValidEngineerEmail, // availableFrom: day
      incompleteBpEngineerEmail, // availableFrom: unknown(年の無い"10月〜")
    ]);

    expect(result.success).toBe(true);
    expect(result.project?.datePrecision).toEqual({
      day: 1,
      month: 1,
      immediate: 1,
      unknown: 0,
      missing: 1,
    });
    expect(result.engineer?.datePrecision).toEqual({
      day: 2,
      month: 0,
      immediate: 0,
      unknown: 1,
      missing: 0,
    });
  });
});

describe('performGmailBulkImport (Matching Workspace用のview model)', () => {
  it('validな案件・要員はvalidProjects/validEngineersとしてそのまま返す(既存matchProjectToEngineers()にそのまま渡せる型)', async () => {
    const result = await performGmailBulkImport(50, async () => [validProjectEmail, validEngineerEmail]);

    expect(result.validProjects).toHaveLength(1);
    expect(result.validProjects?.[0].id).toBe('email-project-valid');
    expect(result.validEngineers).toHaveLength(1);
    expect(result.validEngineers?.[0].id).toBe('email-engineer-valid');
  });

  it('projectsには件名をtitleとして含み、valid/invalidを問わず全件を返す', async () => {
    const result = await performGmailBulkImport(50, async () => [validProjectEmail, incompleteProjectEmail]);

    expect(result.projects).toHaveLength(2);
    const valid = result.projects?.find((p) => p.id === 'email-project-valid');
    expect(valid?.title).toBe('【新規案件】Javaエンジニア募集');
    expect(valid?.skills).toEqual(['Java']);
    expect(valid?.rateMin).toBe(60);
    expect(valid?.rateMax).toBe(80);
    expect(valid?.location).toBe('東京都');
    expect(valid?.remoteAllowed).toBe(true);
    expect(valid?.startDate).toEqual({ precision: 'day', value: '2026-04-01' });
    expect(valid?.validation).toEqual({ valid: true, errors: [] });

    const invalid = result.projects?.find((p) => p.id === 'email-project-incomplete');
    expect(invalid?.validation.valid).toBe(false);
    // フィールド名のみ(個別メールの本文/内容は含めない)、重複は除去される。
    expect(invalid?.validation.errors).toContain('rateMin');
    expect(invalid?.validation.errors).toContain('location');
    expect(invalid?.validation.errors).toContain('startDate');
  });

  it('本文に「案件名：」ラベルがある場合は、件名より優先してtitleに使う(営業デモでの表示名対応)', async () => {
    const projectWithNameLabel: RawEmail = {
      id: 'email-project-named',
      subject: '案件のご案内',
      bodyText: [
        '案件名: 大手金融系システム開発',
        '必須スキル: Java(3年以上)',
        '単価: 60万円〜80万円',
        '勤務地: 東京都',
        '稼働開始: 2026-04-01',
      ].join('\n'),
    };
    const result = await performGmailBulkImport(50, async () => [projectWithNameLabel]);
    const project = result.projects?.find((p) => p.id === 'email-project-named');
    expect(project?.title).toBe('大手金融系システム開発');
  });

  it('projects/validProjects/validEngineersにも本文(bodyText)・from・件名以外の個人情報を含めない', async () => {
    const result = await performGmailBulkImport(50, async () => [
      validProjectEmail,
      validEngineerEmail,
      incompleteProjectEmail,
    ]);

    const json = JSON.stringify({ projects: result.projects, validProjects: result.validProjects, validEngineers: result.validEngineers });
    expect(json).not.toContain(SECRET_BODY_MARKER);
    expect(json).not.toContain('agency@example.test');
  });
});
