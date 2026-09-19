import { validateEngineerRecord } from '../../intake/engineer';
import { toProjectInput, validateProjectRecord } from '../../intake/project';
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
// japaneseLevelは任意項目のため、他の必須項目が揃っていればValidationを
// 通過する。
const bracketFormatProjectEmailWithoutJapaneseLevel: RawEmail = {
  id: 'email-project-bracket-002',
  subject: '【新規案件情報】Linuxサーバ運用保守／基本リモート',
  bodyText:
    '【必須スキル】Linux(3年以上) 【作業場所】新宿駅より徒歩5分 【作業期間】2026年10月1日〜2027年3月31日 【単価】〜75万円（固定） 【面談】1回',
};

// 実メールでよく見る「稼働開始日が月のみ、かつ年が無い(日が無い)」ケースを
// そのまま再現したもの。japaneseLevelは任意項目になったため記載が無くても
// 問題ないが、availableFromは年が不明なため推測せずunknown precisionとなり、
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
      startDate: { precision: 'day', value: '2026-04-01' },
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
      availableFrom: { precision: 'day', value: '2026-04-01' },
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

// 実メール(100〜200件規模)の調査に基づく、UI表示用の案件名/人材名抽出。
// idは内部識別子として維持し続け、ここではUI表示専用の値のみを扱う。
describe('parseEmail (案件名/人材名の抽出、営業デモでの表示名対応)', () => {
  it('「案件名：」ラベルがあれば、それをprojectNameとして抽出する', () => {
    const result = parseEmail(projectEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.candidate.projectName).toBe('大手金融系システム開発');
  });

  it('案件名ラベルが無い場合は件名をprojectNameのフォールバックとして使う', () => {
    const email: RawEmail = {
      id: 'email-project-002',
      subject: '【新規案件】Javaエンジニア募集',
      bodyText: [
        '必須スキル: Java(3年以上)',
        '単価: 60万円〜80万円',
        '勤務地: 東京都',
        '稼働開始: 2026-04-01',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.candidate.projectName).toBe('【新規案件】Javaエンジニア募集');
  });

  it('件名が長すぎる場合(営業担当者名・電話番号等を含む実メールで観測されたパターン)は根拠なく採用せずprojectNameを設定しない', () => {
    const email: RawEmail = {
      id: 'email-project-003',
      subject:
        '案件：【超急募◆単価90万・面談1回即決】長期!愛知(常駐)◆大手製造業向けソフトウェア外販化推進 【キャリアビート 担当：09000000000】',
      bodyText: ['必須スキル: Java(3年以上)', '単価: 90万円', '勤務地: 愛知県', '稼働開始: 2026-04-01'].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.candidate.projectName).toBeUndefined();
  });

  it('案件名に括弧を含む技術注記があっても、記号を壊さずそのまま保持する(括弧の一律除去はしない)', () => {
    const email: RawEmail = {
      id: 'email-project-004',
      subject: '案件のご案内',
      bodyText: [
        '案件名: Webアプリケーション開発（C#/ASP.NET/T-SQL）',
        '必須スキル: C#(3年以上)',
        '単価: 70万円',
        '勤務地: 東京都',
        '稼働開始: 2026-04-01',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.candidate.projectName).toBe('Webアプリケーション開発（C#/ASP.NET/T-SQL）');
  });

  it('「氏名：」ラベルがあれば、それをengineerNameとして抽出する', () => {
    const email: RawEmail = {
      id: 'email-engineer-002',
      subject: 'スキルシート送付の件',
      bodyText: [
        '氏名: 山田太郎',
        'スキル: Java(5年)',
        '希望単価: 70万円',
        '希望勤務地: 東京都',
        '稼働可能日: 2026-04-01',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.candidate.engineerName).toBe('山田太郎');
  });

  it('氏名ラベルが無い場合はengineerNameを設定しない(件名は人材名のフォールバックにしない)', () => {
    const result = parseEmail(engineerEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.candidate.engineerName).toBeUndefined();
  });

  it('ラベル抽出時に紛れ込んだ余分な前後のコロンは取り除く(実メールで観測された抽出境界の揺れ)', () => {
    const email: RawEmail = {
      id: 'email-engineer-003',
      subject: 'スキルシート送付の件',
      bodyText: [
        '氏名: ：山田太郎',
        'スキル: Java(5年)',
        '希望単価: 70万円',
        '希望勤務地: 東京都',
        '稼働可能日: 2026-04-01',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.candidate.engineerName).toBe('山田太郎');
  });
});

// 実メール(200件規模)の調査に基づく。「会社名：」のような単一ラベルは
// 案件メール側に存在しなかったため、日本のビジネスメールで標準的な
// 自己紹介文パターンから会社名を取得する。人材側は「所属：」ラベルが
// 高頻度で確認された。商流は両者とも自由テキストのまま保持する。
describe('parseEmail (案件出し会社/所属会社/商流の抽出)', () => {
  it('「(株式会社等)の◯◯です」という自己紹介文からsourceCompanyを抽出する', () => {
    const email: RawEmail = {
      id: 'email-project-company-001',
      subject: '案件のご紹介',
      bodyText: [
        '株式会社サンプルテックの田中です。',
        '必須スキル: Java(3年以上)',
        '単価: 60万円〜80万円',
        '勤務地: 東京都',
        '稼働開始: 2026-04-01',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.candidate.sourceCompany).toBe('株式会社サンプルテック');
  });

  it('「(株式会社等)の◯◯と申します/でございます」の表記ゆれにも対応する', () => {
    const withMoushimasu: RawEmail = {
      id: 'email-project-company-002',
      subject: '案件のご紹介',
      bodyText: [
        '株式会社ネクスト商事の鈴木 一郎と申します。',
        '必須スキル: Java(3年以上)',
        '単価: 60万円',
        '勤務地: 東京都',
        '稼働開始: 2026-04-01',
      ].join('\n'),
    };
    const withGozaimasu: RawEmail = {
      id: 'email-project-company-003',
      subject: '案件のご紹介',
      bodyText: [
        '株式会社フューチャーワークスの佐藤でございます。',
        '必須スキル: Java(3年以上)',
        '単価: 60万円',
        '勤務地: 東京都',
        '稼働開始: 2026-04-01',
      ].join('\n'),
    };
    const r1 = parseEmail(withMoushimasu);
    const r2 = parseEmail(withGozaimasu);
    expect(r1.status).toBe('parsed');
    expect(r2.status).toBe('parsed');
    if (r1.status !== 'parsed' || r2.status !== 'parsed') return;
    expect(r1.candidate.sourceCompany).toBe('株式会社ネクスト商事');
    expect(r2.candidate.sourceCompany).toBe('株式会社フューチャーワークス');
  });

  it('自己紹介文が無い場合は、本文中の単独の会社名らしき記載(署名等)にフォールバックする', () => {
    const email: RawEmail = {
      id: 'email-project-company-004',
      subject: '案件のご紹介',
      bodyText: [
        '必須スキル: Java(3年以上)',
        '単価: 60万円',
        '勤務地: 東京都',
        '稼働開始: 2026-04-01',
        '---',
        'サンプルテック株式会社',
        '担当: 田中',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.candidate.sourceCompany).toBe('サンプルテック株式会社');
  });

  it('会社名らしき記載が本文に一切無ければsourceCompanyを設定しない(推測しない)', () => {
    const result = parseEmail(projectEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.candidate.sourceCompany).toBeUndefined();
  });

  it('「商流：」ラベルの値をそのままcommercialFlowとして保持する(構造化・推測はしない)', () => {
    const email: RawEmail = {
      id: 'email-project-flow-001',
      subject: '案件のご紹介',
      bodyText: [
        '必須スキル: Java(3年以上)',
        '単価: 60万円',
        '勤務地: 東京都',
        '稼働開始: 2026-04-01',
        '商流: 貴社まで',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.candidate.commercialFlow).toBe('貴社まで');
  });

  it('「☆商流：」表記(実メールで確認された別表記)からもcommercialFlowを取得する', () => {
    const email: RawEmail = {
      id: 'email-project-flow-002',
      subject: '案件のご紹介',
      bodyText: [
        '必須スキル: Java(3年以上)',
        '単価: 60万円',
        '勤務地: 東京都',
        '稼働開始: 2026-04-01',
        '☆商流: 現場→弊社',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.candidate.commercialFlow).toBe('現場→弊社');
  });

  it('「所属：」ラベルから人材のaffiliatedCompanyを抽出する', () => {
    const email: RawEmail = {
      id: 'email-engineer-company-001',
      subject: 'スキルシート送付の件',
      bodyText: [
        '氏名: 山田太郎',
        '所属: サンプルテック株式会社 社員',
        'スキル: Java(5年)',
        '希望単価: 70万円',
        '希望勤務地: 東京都',
        '稼働可能日: 2026-04-01',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.candidate.affiliatedCompany).toBe('サンプルテック株式会社 社員');
  });

  it('人材の所属会社と案件を出している会社は別フィールドであり、混同しない', () => {
    const projectResult = parseEmail(projectEmail);
    expect(projectResult.status).toBe('parsed');
    if (projectResult.status !== 'parsed') return;
    expect(projectResult.candidate).not.toHaveProperty('affiliatedCompany');

    const engineerEmailWithAffiliation: RawEmail = {
      id: 'email-engineer-company-002',
      subject: 'スキルシート送付の件',
      bodyText: [
        '氏名: 山田太郎',
        '所属: 弊社フリーランス',
        'スキル: Java(5年)',
        '希望単価: 70万円',
        '希望勤務地: 東京都',
        '稼働可能日: 2026-04-01',
      ].join('\n'),
    };
    const engineerResult = parseEmail(engineerEmailWithAffiliation);
    expect(engineerResult.status).toBe('parsed');
    if (engineerResult.status !== 'parsed') return;
    expect(engineerResult.candidate).not.toHaveProperty('sourceCompany');
    expect(engineerResult.candidate.affiliatedCompany).toBe('弊社フリーランス');
  });

  it('所属ラベルが無ければaffiliatedCompanyを設定しない(推測しない)', () => {
    const result = parseEmail(engineerEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.candidate.affiliatedCompany).toBeUndefined();
  });

  it('氏名の値に性別が直接続く実メール形式("S.F（男性）"等)から、性別のみを取り除いて氏名を取得する', () => {
    const email: RawEmail = {
      id: 'email-engineer-gender-001',
      subject: 'スキルシート送付の件',
      bodyText: [
        '氏名: S.F（男性）',
        'スキル: Java(5年)',
        '希望単価: 70万円',
        '希望勤務地: 東京都',
        '稼働可能日: 2026-04-01',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.candidate.engineerName).toBe('S.F');
  });

  it('氏名内部の一般的な括弧(性別表記以外)は取り除かない', () => {
    const email: RawEmail = {
      id: 'email-engineer-gender-002',
      subject: 'スキルシート送付の件',
      bodyText: [
        '氏名: 山田(太郎)',
        'スキル: Java(5年)',
        '希望単価: 70万円',
        '希望勤務地: 東京都',
        '稼働可能日: 2026-04-01',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.candidate.engineerName).toBe('山田(太郎)');
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
      startDate: { precision: 'day', value: '2026-10-01' },
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
      availableFrom: { precision: 'day', value: '2026-10-01' },
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

  it('実データで頻出する「日本語レベル記載なし」の案件も、他の必須項目が揃っていればValidationを通過する(japaneseLevelは任意項目)', () => {
    const result = parseEmail(bracketFormatProjectEmailWithoutJapaneseLevel);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'project') return;

    // 単価・勤務地・必須スキル・startDateは抽出できる一方、
    // japaneseLevelは実メールに記載が無いため欠落する。
    expect(result.candidate.rateMin).toBe(75);
    expect(result.candidate.location).toBe('新宿駅より徒歩5分');
    expect(result.candidate.japaneseLevel).toBeUndefined();

    const validation = validateProjectRecord(result.candidate);
    expect(validation.valid).toBe(true);
    if (!validation.valid) return;

    // toProjectInput()でjapaneseLevel未指定は'none'へ正規化される。
    expect(toProjectInput(validation.value).japaneseLevel).toBe('none');
  });

  it('実データで頻出する「稼働開始日が月のみ、年も無い」の要員メールは、年を推測しないためunknown precisionとなりValidationがFAILし続ける', () => {
    const result = parseEmail(bracketFormatEngineerEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;

    expect(result.candidate.availableFrom).toEqual({ precision: 'unknown', value: '' });

    const validation = validateEngineerRecord(result.candidate);
    expect(validation.valid).toBe(false);
  });
});

// 実際のBP要員紹介メール(HTML由来で改行が失われ1行化するケースが多い)で
// 観察された「■基本情報/■希望条件/■スキル等のセクション見出し + ・ラベル：の
// 箇条書き」という構造。通常のキーワード判定(PROJECT_KEYWORDS/
// ENGINEER_KEYWORDS)がたまたま同点になり、これまでunparsedへ落ちていた
// 実例を再現した合成データ。「募集」(project側)と「経歴」(engineer側)を
// それぞれ1回だけ含め、意図的に同点(1対1)を作っている。
describe('parseEmail (BP要員メールの分類タイブレーク)', () => {
  const tieWithFullBpStructure: RawEmail = {
    id: 'email-engineer-tie-001',
    subject: '個人事業主のご紹介',
    bodyText: [
      '■基本情報',
      '・氏名：A.B（男性）',
      '・最寄駅：渋谷駅',
      '■希望条件',
      '・稼働：10月〜',
      '・出社頻度：フルリモート',
      '・単金（税抜）：80万円',
      '・ご経歴を拝見しご連絡いたしました',
      '■スキル',
      'Java、AWS',
      '本メールの配信を停止希望の方は募集フォームよりご連絡ください',
    ].join('\n'),
  };

  const tieWithBulletLabelOnly: RawEmail = {
    id: 'email-engineer-tie-002',
    subject: '個人事業主のご紹介',
    bodyText: [
      '弊社の個人事業主をご紹介します。',
      '・稼働：即日',
      '・ご経歴を拝見しご連絡いたしました',
      '本メールの配信停止をご希望の方は募集フォームよりご連絡ください',
    ].join('\n'),
  };

  const tieWithoutBpStructure: RawEmail = {
    id: 'email-tie-no-structure-001',
    subject: '個人事業主のご紹介',
    bodyText: [
      '弊社の個人事業主をご紹介します。',
      '稼働開始は即日です。',
      '経歴を確認の上ご連絡します。',
      '配信停止をご希望の方は募集フォームよりご連絡ください。',
    ].join('\n'),
  };

  it('project/engineerシグナルが同点でも、■基本情報等の構造的シグナルがあればengineerと判定する', () => {
    const result = parseEmail(tieWithFullBpStructure);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.recordType).toBe('engineer');
  });

  it('・稼働：の箇条書きラベルだけでも(■見出しが無くても)engineerと判定する', () => {
    const result = parseEmail(tieWithBulletLabelOnly);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.recordType).toBe('engineer');
  });

  it('BP要員メール特有の構造が無い通常の同点ケースは、従来通りunparsedのままにする', () => {
    const result = parseEmail(tieWithoutBpStructure);
    expect(result).toEqual({
      status: 'unparsed',
      reason: 'could not determine whether this is a project or engineer email',
    });
  });

  it('明確な案件メールの判定は変わらずprojectのまま(既存挙動を維持)', () => {
    const result = parseEmail(projectEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.recordType).toBe('project');
  });

  it('明確な要員メールの判定は変わらずengineerのまま(既存挙動を維持)', () => {
    const result = parseEmail(engineerEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed') return;
    expect(result.recordType).toBe('engineer');
  });
});

// BP-A形式(PR #22のタイブレークでengineerと判定されるようになったメール)
// から、■スキル見出しのスキル、・単金（税抜）：の単価、・最寄駅：の
// desiredLocations、・出社頻度：のremoteDesiredが取得できることを確認する。
// 稼働(startDate/availableFrom)はまだ対応していないため、未取得のままで
// あることも合わせて確認する(今回のスコープ外、既知の状態)。
describe('parseEmail (BP-A要員メールからの■スキル抽出)', () => {
  const bpEngineerWithSkillsSection: RawEmail = {
    id: 'email-engineer-bp-skills-001',
    subject: '個人事業主のご紹介',
    bodyText: [
      '■基本情報',
      '・氏名：A.B（男性）',
      '・最寄駅：渋谷駅',
      '■希望条件',
      '・稼働：10月〜',
      '・出社頻度：フルリモート',
      '・単金（税抜）：80万円',
      '・ご経歴を拝見しご連絡いたしました',
      '■スキル',
      'Java, Spring Boot, AWS',
      '■備考',
      '本メールの配信を停止希望の方は募集フォームよりご連絡ください',
    ].join('\n'),
  };

  it('■スキル見出しからskillsを抽出する(タイブレークでengineer判定されたBP-Aメール)', () => {
    const result = parseEmail(bpEngineerWithSkillsSection);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;

    expect(result.candidate.skills).toEqual([
      { name: 'Java', years: 0 },
      { name: 'Spring Boot', years: 0 },
      { name: 'AWS', years: 0 },
    ]);
    // ・単金（税抜）：80万円 → 固定値としてmin=max=80が取得できる。
    expect(result.candidate.desiredRateMin).toBe(80);
    expect(result.candidate.desiredRateMax).toBe(80);
    // ・最寄駅：渋谷駅 → desiredLocationsとして取得できる(BP-Aには
    // 「勤務地」相当のラベルが無いため最寄駅を採用する、既存の【最寄駅】
    // 形式と同じ扱い)。
    expect(result.candidate.desiredLocations).toEqual(['渋谷駅']);
    // ・出社頻度：フルリモート → 強いキーワード一致でremoteDesired=trueを
    // 取得できる。
    expect(result.candidate.remoteDesired).toBe(true);
    // ・稼働：10月〜 → 年が無いため推測せずunknown precisionとなる
    // (Validationも今回はまだ通らない)。
    expect(result.candidate.availableFrom).toEqual({ precision: 'unknown', value: '' });
  });

  it('・単金（税抜）：の範囲表記(全角チルダ)からmin/maxを取得する', () => {
    const email: RawEmail = {
      id: 'email-engineer-bp-rate-range-001',
      subject: '個人事業主のご紹介',
      bodyText: [
        '■基本情報',
        '・最寄駅：渋谷駅',
        '■希望条件',
        '・単金（税抜）：65万～75万',
        '・ご経歴を拝見しご連絡いたしました',
        '■スキル',
        'Java',
        '本メールの配信を停止希望の方は募集フォームよりご連絡ください',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;

    expect(result.candidate.desiredRateMin).toBe(65);
    expect(result.candidate.desiredRateMax).toBe(75);
  });

  it('単金の記載が無いBP-Aメールでは、従来通りdesiredRateMinを取得しない(回帰確認)', () => {
    const email: RawEmail = {
      id: 'email-engineer-bp-no-rate-001',
      subject: '個人事業主のご紹介',
      bodyText: [
        '■基本情報',
        '・最寄駅：渋谷駅',
        '■希望条件',
        '・稼働：即日',
        '・ご経歴を拝見しご連絡いたしました',
        '■スキル',
        'Java',
        '本メールの配信を停止希望の方は募集フォームよりご連絡ください',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;

    expect(result.candidate.desiredRateMin).toBeUndefined();
    expect(result.candidate.desiredRateMax).toBeUndefined();
  });
});

// BP-A要員メールから、マッチングに必要なlocation(desiredLocations)と
// remoteDesiredを取得できることを確認する。実メール観察の結果、BP-Aには
// 「勤務地」「作業場所」相当のラベルは存在せず「・最寄駅：」のみが記載される
// ため、既存の【最寄駅】形式と同じ扱いでdesiredLocationsへ採用する。また
// 「・出社頻度：」は「出社可能」「常駐可能」等リモートと無関係な文脈でも
// 「可」を含むため、強いキーワードのみで判定するfindRemoteInFreeTextを使い、
// 誤ってtrue判定しないことを確認する。
describe('parseEmail (BP-A要員メールのlocation/remote抽出)', () => {
  function bpAEmail(conditionLines: string[]): RawEmail {
    return {
      id: 'email-engineer-bp-location-remote',
      subject: '個人事業主のご紹介',
      bodyText: [
        '■基本情報',
        '・氏名：A.B（男性）',
        '・最寄駅：川崎駅',
        '■希望条件',
        ...conditionLines,
        '・ご経歴を拝見しご連絡いたしました',
        '■スキル',
        'Java',
        '本メールの配信を停止希望の方は募集フォームよりご連絡ください',
      ].join('\n'),
    };
  }

  it('通常のBP-A形式(改行区切り)から最寄駅をdesiredLocationsとして取得する', () => {
    const result = parseEmail(bpAEmail(['・稼働：即日', '・出社頻度：フルリモート']));
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;
    expect(result.candidate.desiredLocations).toEqual(['川崎駅']);
  });

  it('HTML由来で1行に潰れた本文からもdesiredLocationsを取得する', () => {
    const email: RawEmail = {
      id: 'email-engineer-bp-location-collapsed',
      subject: '個人事業主のご紹介',
      bodyText:
        '■基本情報 ・氏名：A.B（男性） ・最寄駅：川崎駅 ・所属：弊社フリーランス ■希望条件 ・稼働：即日 ・出社頻度：フルリモート ・ご経歴を拝見しご連絡いたしました ■スキル Java 本メールの配信を停止希望の方は募集フォームよりご連絡ください',
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;
    expect(result.candidate.desiredLocations).toEqual(['川崎駅']);
  });

  it('最寄駅の値が空の場合はdesiredLocationsを取得しない(推測しない)', () => {
    const email: RawEmail = {
      id: 'email-engineer-bp-location-empty',
      subject: '個人事業主のご紹介',
      bodyText: [
        '■基本情報',
        '・氏名：A.B（男性）',
        '・最寄駅：',
        '・所属：弊社フリーランス',
        '■希望条件',
        '・稼働：即日',
        '・ご経歴を拝見しご連絡いたしました',
        '■スキル',
        'Java',
        '本メールの配信を停止希望の方は募集フォームよりご連絡ください',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;
    expect(result.candidate.desiredLocations).toBeUndefined();
  });

  it('最寄駅も希望勤務地も無ければdesiredLocationsを取得しない', () => {
    const email: RawEmail = {
      id: 'email-engineer-bp-location-missing',
      subject: '個人事業主のご紹介',
      bodyText: [
        '■基本情報',
        '・氏名：A.B（男性）',
        '■希望条件',
        '・稼働：即日',
        '・ご経歴を拝見しご連絡いたしました',
        '■スキル',
        'Java',
        '本メールの配信を停止希望の方は募集フォームよりご連絡ください',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;
    expect(result.candidate.desiredLocations).toBeUndefined();
  });

  it('「・リモート：可」のような直接ラベルはparseYesNoでtrueと判定する', () => {
    const result = parseEmail(bpAEmail(['・稼働：即日', '・リモート：可']));
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;
    expect(result.candidate.remoteDesired).toBe(true);
  });

  it('「・出社頻度：基本リモート」は強いキーワード一致でtrueと判定する', () => {
    const result = parseEmail(bpAEmail(['・稼働：即日', '・出社頻度：基本リモート']));
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;
    expect(result.candidate.remoteDesired).toBe(true);
  });

  it('「・出社頻度：月2回まで出社可能（全国可）」は"可"だけでtrueと誤判定しない(undefinedのまま)', () => {
    const result = parseEmail(bpAEmail(['・稼働：即日', '・出社頻度：月2回まで出社可能（全国可）']));
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;
    expect(result.candidate.remoteDesired).toBeUndefined();
  });

  it('「・出社頻度：1時間以内常駐可能」も同様に誤判定しない(undefinedのまま)', () => {
    const result = parseEmail(bpAEmail(['・稼働：即日', '・出社頻度：1時間以内常駐可能']));
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;
    expect(result.candidate.remoteDesired).toBeUndefined();
  });

  it('リモート表現が本文に一切無ければremoteDesiredを取得しない', () => {
    const result = parseEmail(bpAEmail(['・稼働：即日']));
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;
    expect(result.candidate.remoteDesired).toBeUndefined();
  });

  it('「・出社頻度：フル出社」のような否定表現は強いキーワード一致でfalseと判定する', () => {
    const result = parseEmail(bpAEmail(['・稼働：即日', '・出社頻度：フル出社']));
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;
    expect(result.candidate.remoteDesired).toBe(false);
  });

  it('integration: raw email → parseEmail → EngineerRecord までlocation/remote/availableFrom(即日)が伝播しvalidationを完全に通過する', () => {
    const email = bpAEmail(['・稼働：即日', '・出社頻度：フルリモート', '・単金（税抜）：80万円']);
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;

    expect(result.candidate.desiredLocations).toEqual(['川崎駅']);
    expect(result.candidate.remoteDesired).toBe(true);
    expect(result.candidate.desiredRateMin).toBe(80);
    expect(result.candidate.desiredRateMax).toBe(80);
    // ・稼働：即日 → immediate precisionとして取得でき、有効な稼働時期情報
    // として受け入れられる。
    expect(result.candidate.availableFrom).toEqual({ precision: 'immediate', value: '' });

    const validation = validateEngineerRecord(result.candidate);
    expect(validation.valid).toBe(true);
  });

  it('既存のskills/rate/japaneseLevel抽出はlocation/remote追加後も壊れていない(回帰確認)', () => {
    const result = parseEmail(engineerEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;

    expect(result.candidate.skills).toEqual([
      { name: 'Java', years: 5 },
      { name: 'AWS', years: 2 },
    ]);
    expect(result.candidate.desiredRateMin).toBe(70);
    expect(result.candidate.desiredLocations).toEqual(['東京都', '神奈川県']);
    expect(result.candidate.remoteDesired).toBe(true);
    expect(result.candidate.japaneseLevel).toBe('business');

    const validation = validateEngineerRecord(result.candidate);
    expect(validation.valid).toBe(true);
  });

  it('案件メール(project)側のlocation/remoteAllowed抽出は今回の変更で壊れていない(回帰確認)', () => {
    const result = parseEmail(projectEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'project') return;

    expect(result.candidate.location).toBe('東京都');
    expect(result.candidate.remoteAllowed).toBe(true);

    const validation = validateProjectRecord(result.candidate);
    expect(validation.valid).toBe(true);
  });
});

// 実メール観察で見つかった別のBP要員紹介フォーマット(単独■見出し、コロン
// 無し、"最寄り駅"表記、注記が値に直接続く)。既存のBP-A(・ラベル：)形式とは
// 別の実在フォーマットとして、そのまま抽出→validationまで通ることを確認する。
describe('parseEmail (単独■見出し・コロン無し・最寄り駅表記のBP要員メール)', () => {
  const singleMarkerEngineerEmail: RawEmail = {
    id: 'email-engineer-single-marker-001',
    subject: '要員のご紹介',
    bodyText: [
      '下記要員のご紹介をさせていただきます。',
      '見合う案件がございましたらご紹介いただけますと幸いです。',
      '■氏名',
      'M.O(41歳/女性)',
      '■希望業務',
      '・上流、PMO案件',
      '■稼働',
      '10月~',
      '■最寄り駅',
      '浜松町 駅 ※リモート希望（週1~4日出社可）',
      '■単価',
      '85万',
      '■所属',
      '弊社個人事業主',
      '■スキル',
      'Tableau、SQL',
    ].join('\n'),
  };

  it('"最寄り駅"(り入り)表記からdesiredLocationsを取得し、注記(※以降)は除去する', () => {
    const result = parseEmail(singleMarkerEngineerEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;

    expect(result.candidate.desiredLocations).toEqual(['浜松町 駅']);
  });

  it('最寄り駅の値に埋め込まれた"※リモート希望"からremoteDesired=trueを取得する', () => {
    const result = parseEmail(singleMarkerEngineerEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;

    expect(result.candidate.remoteDesired).toBe(true);
  });

  it('単独■見出し・コロン無しの"■単価 85万"から単価を取得する', () => {
    const result = parseEmail(singleMarkerEngineerEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;

    expect(result.candidate.desiredRateMin).toBe(85);
    expect(result.candidate.desiredRateMax).toBe(85);
  });

  it('単独■見出し・コロン無しの"■稼働 10月~"は年が無いためunknown precisionのまま(推測しない)', () => {
    const result = parseEmail(singleMarkerEngineerEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;

    expect(result.candidate.availableFrom).toEqual({ precision: 'unknown', value: '' });
  });

  it('コロンが省略された"・単金（税抜）85万円"からも単価を取得する(BP-A箇条書き形式)', () => {
    const email: RawEmail = {
      id: 'email-engineer-no-colon-rate-001',
      subject: '個人事業主のご紹介',
      bodyText: [
        '■基本情報',
        '・最寄駅：渋谷駅',
        '■希望条件',
        '・稼働：即日',
        '・出社頻度：週2日出社可（リモート尚可）',
        '・単金（税抜）85万円',
        '・希望：PM/PdM案件',
        '■スキル',
        'PM、PMO',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'engineer') return;

    expect(result.candidate.desiredRateMin).toBe(85);
    expect(result.candidate.desiredRateMax).toBe(85);
  });
});

// 実案件メール(株式会社キャリアビート形式)で観察された「■スキル■」+
// 「<<必須>>」/「<<尚可>>」ネスト構造。既存の「必須スキル」ラベルが無い
// 案件メールでも、この形式からrequiredSkillsを取得できることを確認する。
describe('parseEmail (■スキル■ + <<必須>>/<<尚可>>ネスト形式の案件メール)', () => {
  const nestedSkillProjectEmail: RawEmail = {
    id: 'email-project-nested-skill-001',
    subject: '案件のご紹介',
    bodyText: [
      '■スキル■',
      '<<必須>>',
      '・Javaでの開発経験',
      '・AWSでのインフラ構築経験',
      '<<尚可>>',
      '・Terraformの利用経験',
      '■単価■',
      '60万円~80万円',
      '■場所■',
      '東京都',
      '■期間■',
      '即日~長期',
    ].join('\n'),
  };

  it('<<必須>>側をrequired:true、<<尚可>>側をrequired:falseとしてrequiredSkillsへ取得する', () => {
    const result = parseEmail(nestedSkillProjectEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'project') return;

    expect(result.candidate.requiredSkills).toEqual([
      { name: 'Javaでの開発経験', minYears: 0, required: true },
      { name: 'AWSでのインフラ構築経験', minYears: 0, required: true },
      { name: 'Terraformの利用経験', minYears: 0, required: false },
    ]);
  });

  it('■期間■の"即日~長期"はimmediate precisionとして取得できる(随時と同じ扱い)', () => {
    const result = parseEmail(nestedSkillProjectEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'project') return;

    expect(result.candidate.startDate).toEqual({ precision: 'immediate', value: '' });
  });

  it('rate/locationも既存の■ラベル■形式でそのまま取得でき、validationを通過する', () => {
    const result = parseEmail(nestedSkillProjectEmail);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'project') return;

    expect(result.candidate.rateMin).toBe(60);
    expect(result.candidate.rateMax).toBe(80);
    expect(result.candidate.location).toBe('東京都');

    // remoteAllowedの記載が無いためvalidationはそこだけFAILする(推測しない)。
    const validation = validateProjectRecord(result.candidate);
    expect(validation.valid).toBe(false);
    if (validation.valid) return;
    expect(validation.errors).toEqual(['remoteAllowed: 真偽値である必要があります']);
  });

  it('明示的な"必須スキル"ラベルがある場合はネスト形式より優先される(既存挙動を維持)', () => {
    const email: RawEmail = {
      id: 'email-project-explicit-label-priority-001',
      subject: '案件のご紹介',
      bodyText: [
        '必須スキル: Python',
        '■スキル■',
        '<<必須>>',
        '・Javaでの開発経験',
      ].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'project') return;

    expect(result.candidate.requiredSkills).toEqual([{ name: 'Python', minYears: 0, required: true }]);
  });

  it('<<必須>>/<<尚可>>が無い通常の■スキル■(単純な技術名の列挙)でも壊れない(該当なしでrequiredSkillsは空のまま)', () => {
    const email: RawEmail = {
      id: 'email-project-plain-skill-section-001',
      subject: '案件のご紹介',
      bodyText: ['■スキル■', 'Java、AWS', '■単価■', '70万円'].join('\n'),
    };
    const result = parseEmail(email);
    expect(result.status).toBe('parsed');
    if (result.status !== 'parsed' || result.recordType !== 'project') return;

    // <<必須>>/<<尚可>>の見出しが無いため、根拠なく「必須」に仕分けせず
    // requiredSkills自体を取得しない(捏造しない)。
    expect(result.candidate.requiredSkills).toBeUndefined();
  });
});
