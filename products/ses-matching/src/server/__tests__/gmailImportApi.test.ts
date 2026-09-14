import type { RawEmail } from '../../gmail/types';
import { performGmailImport } from '../gmailImportApi';

// すべて匿名の合成(synthetic)メール。実Gmail/OAuthには一切アクセスしない
// (fetchRawEmailを差し替えて注入する)。

const SECRET_BODY_MARKER = '__この文字列は絶対にレスポンスへ含まれてはいけない本文__';

const projectEmail: RawEmail = {
  id: 'email-1',
  from: 'agency@example.test',
  subject: '【新規案件】Javaエンジニア募集',
  date: '2026-09-01',
  bodyText: [
    SECRET_BODY_MARKER,
    '必須スキル: Java(3年以上)',
    '単価: 60万円〜80万円',
    '勤務地: 東京都',
    'リモート: 可',
    '稼働開始: 2026-04-01',
    '日本語レベル: ビジネスレベル',
  ].join('\n'),
};

const incompleteProjectEmail: RawEmail = {
  id: 'email-2',
  subject: '案件のご案内',
  bodyText: `${SECRET_BODY_MARKER}\n必須スキル: Java(3年以上)`,
};

const engineerEmail: RawEmail = {
  id: 'email-3',
  subject: 'スキルシート送付の件',
  bodyText: [
    SECRET_BODY_MARKER,
    'スキル: Java(5年)',
    '希望単価: 70万円',
    '希望勤務地: 東京都',
    'リモート希望: 希望',
    '稼働可能日: 2026-04-01',
    '日本語レベル: ビジネスレベル',
  ].join('\n'),
};

const unrelatedEmail: RawEmail = {
  id: 'email-4',
  subject: '会議の日程調整について',
  bodyText: `${SECRET_BODY_MARKER}\n来週の定例会議の件です。`,
};

// BP要員紹介メール(■見出し形式)を再現した合成データ。このメールには単金の
// 記載が無いため、出社頻度・稼働と同様にrateRangeも未取得のままとなる
// (■スキルからskillNamesは取得できる)。
const bpEngineerEmail: RawEmail = {
  id: 'email-5',
  subject: '個人事業主のご紹介',
  bodyText: [
    SECRET_BODY_MARKER,
    '■基本情報',
    '・最寄駅：渋谷駅',
    '■希望条件',
    '・稼働：10月〜',
    '・ご経歴を拝見しご連絡いたしました',
    '■スキル',
    'Java, Spring Boot, AWS',
    '■備考',
    '募集フォームよりご連絡ください',
  ].join('\n'),
};

// ・単金（税抜）：の記載があるBP要員紹介メール。skillNamesに加えrateRangeも
// 取得できるが、出社頻度・稼働(availableFrom)は今回未対応のため
// validationはFAILのまま。
const bpEngineerWithRateEmail: RawEmail = {
  id: 'email-6',
  subject: '個人事業主のご紹介',
  bodyText: [
    SECRET_BODY_MARKER,
    '■基本情報',
    '・最寄駅：渋谷駅',
    '■希望条件',
    '・稼働：10月〜',
    '・単金（税抜）：80万円',
    '・ご経歴を拝見しご連絡いたしました',
    '■スキル',
    'Java, Spring Boot, AWS',
    '■備考',
    '募集フォームよりご連絡ください',
  ].join('\n'),
};

// ・出社頻度：の記載もあるBP要員紹介メール。skillNames/rateRangeに加え、
// locations(最寄駅)とremoteDesiredも取得できるが、稼働(availableFrom)は
// 今回未対応のためvalidationはFAILのまま。
const bpEngineerWithLocationRemoteEmail: RawEmail = {
  id: 'email-7',
  subject: '個人事業主のご紹介',
  bodyText: [
    SECRET_BODY_MARKER,
    '■基本情報',
    '・最寄駅：川崎駅',
    '■希望条件',
    '・稼働：10月〜',
    '・出社頻度：フルリモート',
    '・単金（税抜）：80万円',
    '・ご経歴を拝見しご連絡いたしました',
    '■スキル',
    'Java, Spring Boot, AWS',
    '■備考',
    '募集フォームよりご連絡ください',
  ].join('\n'),
};

describe('performGmailImport', () => {
  it('Gmail取得成功: 案件メールでvalidation PASSしtopCandidateまで返す', async () => {
    const result = await performGmailImport(async () => projectEmail);
    expect(result.success).toBe(true);
    expect(result.type).toBe('project');
    expect(result.validation?.valid).toBe(true);
    expect(result.topCandidate?.engineerId).toBeTruthy();
    expect(typeof result.topCandidate?.score).toBe('number');
  });

  it('案件メールでも必須情報が不足していればvalidation FAILを返す', async () => {
    const result = await performGmailImport(async () => incompleteProjectEmail);
    expect(result.success).toBe(true);
    expect(result.type).toBe('project');
    expect(result.validation?.valid).toBe(false);
    expect(result.validation?.errors.length).toBeGreaterThan(0);
    expect(result.topCandidate).toBeUndefined();
  });

  it('要員メールを正しく判定しvalidation PASSを返す', async () => {
    const result = await performGmailImport(async () => engineerEmail);
    expect(result.success).toBe(true);
    expect(result.type).toBe('engineer');
    expect(result.validation?.valid).toBe(true);
    expect(result.skillNames).toEqual(['Java']);
    expect(result.rateRange).toEqual({ min: 70, max: 70 });
    expect(result.locations).toEqual(['東京都']);
    expect(result.remoteDesired).toBe(true);
  });

  it('BP要員メール(■見出し形式・単金/出社頻度の記載無し)から■スキルとlocations(最寄駅)を返す(remoteDesired/稼働は未対応でvalidationはFAILのまま)', async () => {
    const result = await performGmailImport(async () => bpEngineerEmail);
    expect(result.success).toBe(true);
    expect(result.type).toBe('engineer');
    expect(result.skillNames).toEqual(['Java', 'Spring Boot', 'AWS']);
    expect(result.rateRange).toBeUndefined();
    expect(result.locations).toEqual(['渋谷駅']);
    expect(result.remoteDesired).toBeUndefined();
    expect(result.validation?.valid).toBe(false);
  });

  it('BP要員メール(・単金（税抜）：あり)からskillNamesとrateRangeの両方を返す(出社頻度は未記載のためremoteDesiredは未取得、稼働は未対応でvalidationはFAILのまま)', async () => {
    const result = await performGmailImport(async () => bpEngineerWithRateEmail);
    expect(result.success).toBe(true);
    expect(result.type).toBe('engineer');
    expect(result.skillNames).toEqual(['Java', 'Spring Boot', 'AWS']);
    expect(result.rateRange).toEqual({ min: 80, max: 80 });
    expect(result.remoteDesired).toBeUndefined();
    expect(result.validation?.valid).toBe(false);
  });

  it('BP要員メール(・出社頻度：フルリモートあり)からskillNames/rateRange/locations/remoteDesiredの全てを返す(稼働は未対応でvalidationはFAILのまま)', async () => {
    const result = await performGmailImport(async () => bpEngineerWithLocationRemoteEmail);
    expect(result.success).toBe(true);
    expect(result.type).toBe('engineer');
    expect(result.skillNames).toEqual(['Java', 'Spring Boot', 'AWS']);
    expect(result.rateRange).toEqual({ min: 80, max: 80 });
    expect(result.locations).toEqual(['川崎駅']);
    expect(result.remoteDesired).toBe(true);
    expect(result.validation?.valid).toBe(false);
  });

  it('案件/要員どちらでもないメールはunparsedを返す', async () => {
    const result = await performGmailImport(async () => unrelatedEmail);
    expect(result.success).toBe(true);
    expect(result.type).toBe('unparsed');
    expect(result.reason).toBeTruthy();
  });

  it('Gmail取得失敗時はsuccess:falseとreasonを返す', async () => {
    const result = await performGmailImport(async () => {
      throw new Error('network unreachable');
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('network unreachable');
  });

  it('メールボックスが空の場合はsuccess:falseを返す', async () => {
    const result = await performGmailImport(async () => null);
    expect(result.success).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('レスポンスに本文(bodyText)を一切含めない', async () => {
    for (const email of [
      projectEmail,
      incompleteProjectEmail,
      engineerEmail,
      unrelatedEmail,
      bpEngineerEmail,
      bpEngineerWithRateEmail,
      bpEngineerWithLocationRemoteEmail,
    ]) {
      const result = await performGmailImport(async () => email);
      expect(JSON.stringify(result)).not.toContain(SECRET_BODY_MARKER);
      expect(result).not.toHaveProperty('bodyText');
    }
  });
});
