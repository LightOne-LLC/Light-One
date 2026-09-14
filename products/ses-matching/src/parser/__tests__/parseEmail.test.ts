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

// 実メール観察(25通)で確認された【ラベル】値形式・表記ゆれを再現した
// 匿名合成データ(架空の企業・人物)。HTMLメールで改行が失われ1行に
// 潰れているケースを想定し、あえて改行を含めていない。
const bracketFormatProjectEmail: RawEmail = {
  id: 'email-project-bracket-001',
  subject: '【新規案件情報】Linuxサーバ運用保守／基本リモート',
  bodyText:
    '合同会社サンプル ご担当者様 いつもお世話になっております。 【案件名】基幹システム運用保守 【必須スキル】Linux(3年以上)、シェルスクリプト 【作業場所】新宿駅より徒歩5分 【作業期間】2026年10月1日〜2027年3月31日 【単価】〜75万円（固定） 【日本語レベル】ビジネスレベル 【面談】1回 ご検討よろしくお願いいたします。',
};

// 実メールでよく見る「日本語レベルの記載が無い」ケースをそのまま再現したもの。
// 現在のvalidateProjectRecordはjapaneseLevelを必須とするため、Parserの
// 抽出精度に関わらずここでValidationはFAILし続ける(実データ観察で判明した
// 既知のギャップ)。
const bracketFormatProjectEmailWithoutJapaneseLevel: RawEmail = {
  id: 'email-project-bracket-002',
  subject: '【新規案件情報】Linuxサーバ運用保守／基本リモート',
  bodyText:
    '【必須スキル】Linux(3年以上) 【作業場所】新宿駅より徒歩5分 【作業期間】2026年10月1日〜2027年3月31日 【単価】〜75万円（固定） 【面談】1回',
};

// 実メールでよく見る「稼働開始日が月のみ(日が無い)」「日本語レベルの記載が
// 無い」ケースをそのまま再現したもの。Parserの抽出自体は成功するが、
// availableFrom(日が不明)とjapaneseLevel(記載なし)が欠けるため
// ValidationはFAILし続ける(実データ観察で判明した既知のギャップ)。
const bracketFormatEngineerEmail: RawEmail = {
  id: 'email-engineer-bracket-001',
  subject: '【要員/フルリモート希望】Javaバックエンドエンジニアのご紹介',
  bodyText:
    '【氏名】A.B 【最寄駅】新宿駅 【稼働開始日】10月〜 【通勤】フルリモート希望(初日出社可能) 【単価】73万(Min68万) 【スキル】言語：Java(51ヶ月) / AWS(24ヶ月) 【業種・経歴】通信業(36ヶ月)',
};

const bracketFormatEngineerEmailFullyResolvable: RawEmail = {
  id: 'email-engineer-bracket-002',
  subject: '【要員/フルリモート希望】Javaバックエンドエンジニアのご紹介',
  bodyText:
    '【氏名】A.B 【最寄駅】新宿駅 【稼働開始日】2026-10-01 【通勤】フルリモート希望(初日出社可能) 【単価】73万(Min68万) 【スキル】言語：Java(51ヶ月) / AWS(24ヶ月) 【日本語レベル】ビジネスレベル',
};

// 件名だけに単価・リモート情報があり、本文の対応ラベルが無いケース。
const subjectOnlyRateProjectEmail: RawEmail = {
  id: 'email-project-subject-rate-001',
  subject: '【急募案件】インフラ構築案件／75万／フルリモート',
  bodyText: '【必須スキル】AWS、Terraform 【作業場所】大阪 【作業期間】2026年5月1日〜長期',
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

// 実メール25通の観察結果(【ラベル】形式、ラベル別名、ヶ月表記、単価の
// 表記ゆれ、件名フォールバック)を反映した合成テスト。
describe('parseEmail (実フォーマット【ラベル】形式への対応)', () => {
  it('【ラベル】形式・HTML由来の1行本文から案件情報を抽出しValidationまで通過する', () => {
    const result = parseEmail(bracketFormatProjectEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'project') return;

    expect(result.candidate).toMatchObject({
      location: '新宿駅より徒歩5分',
      startDate: '2026-10-01',
      rateMin: 75,
      rateMax: 75,
      japaneseLevel: 'business',
    });
    expect(result.candidate.requiredSkills).toEqual([
      { name: 'Linux', minYears: 3, required: true },
      { name: 'シェルスクリプト', minYears: 0, required: true },
    ]);

    const validation = validateProjectRecord(result.candidate);
    expect(validation.valid).toBe(true);
  });

  it('【ラベル】形式の要員メールからヶ月表記のスキル経験・Min明示の単価を抽出しValidationまで通過する', () => {
    const result = parseEmail(bracketFormatEngineerEmailFullyResolvable);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;

    expect(result.candidate).toMatchObject({
      desiredRateMin: 68,
      desiredRateMax: 73,
      desiredLocations: ['新宿駅'],
      remoteDesired: true,
      availableFrom: '2026-10-01',
      japaneseLevel: 'business',
    });
    expect(result.candidate.skills).toEqual([
      { name: 'Java', years: 4.25 },
      { name: 'AWS', years: 2 },
    ]);

    const validation = validateEngineerRecord(result.candidate);
    expect(validation.valid).toBe(true);
  });

  it('件名のみに単価・リモート情報がある案件メールを件名フォールバックで補完する', () => {
    const result = parseEmail(subjectOnlyRateProjectEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'project') return;

    expect(result.candidate.rateMin).toBe(75);
    expect(result.candidate.rateMax).toBe(75);
    expect(result.candidate.remoteAllowed).toBe(true);
  });

  it('実データで頻出する「稼働開始月のみ(日が無い)」「日本語レベル記載なし」の案件は、他項目が抽出できてもValidationがFAILし続ける(既知のギャップ、日付や日本語レベルを推測しない)', () => {
    const result = parseEmail(bracketFormatProjectEmailWithoutJapaneseLevel);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'project') return;

    // 単価・勤務地・必須スキルは抽出できる
    expect(result.candidate.rateMin).toBe(75);
    expect(result.candidate.location).toBe('新宿駅より徒歩5分');
    // startDateは日付が明示されているため抽出できる一方、japaneseLevelは
    // 実メールに記載が無いため欠落し、Validationは通らない。
    expect(result.candidate.japaneseLevel).toBeUndefined();

    const validation = validateProjectRecord(result.candidate);
    expect(validation.valid).toBe(false);
  });

  it('実データで頻出する「稼働開始日が月のみ」の要員メールは、日付を推測しないためavailableFromが欠落しValidationがFAILし続ける', () => {
    const result = parseEmail(bracketFormatEngineerEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;

    expect(result.candidate.availableFrom).toBeUndefined();

    const validation = validateEngineerRecord(result.candidate);
    expect(validation.valid).toBe(false);
  });
});
