import {
  extractLabeledValue,
  findRateInFreeText,
  findRemoteInFreeText,
  parseDateValue,
  parseEngineerSkillList,
  parseRateRange,
  parseRequiredSkillList,
  parseYesNo,
} from '../extractors';

// すべて匿名の合成(synthetic)データ。実メールの内容ではない。

describe('extractLabeledValue', () => {
  it('既存のコロン形式を引き続き抽出できる', () => {
    const body = '単価: 60万円〜80万円\n勤務地: 東京都';
    expect(extractLabeledValue(body, ['単価'])).toBe('60万円〜80万円');
  });

  it('【ラベル】値 形式(全角カッコ、コロンなし)を抽出できる', () => {
    const body = '【スキル】AWS / Linux\n【単価】68万円〜80万円';
    expect(extractLabeledValue(body, ['スキル'])).toBe('AWS / Linux');
    expect(extractLabeledValue(body, ['単価'])).toBe('68万円〜80万円');
  });

  it('改行が無くHTML由来で1行に潰れた本文でも【ラベル】値を抽出できる', () => {
    const body = '合同会社サンプル 様 いつもお世話になっております。 【作業場所】東京 【単価】70万円 【期間】即日〜長期 ご検討よろしくお願いいたします。';
    expect(extractLabeledValue(body, ['作業場所'])).toBe('東京');
    expect(extractLabeledValue(body, ['単価'])).toBe('70万円');
  });

  it('値は次の【ラベル】が現れるまでを取得する(複数行にまたがる値も含む)', () => {
    const body = '【希望】Web開発、バックエンドメイン\n　　　　リーダー案件も希望\n【スキル】Java';
    expect(extractLabeledValue(body, ['希望'])).toBe('Web開発、バックエンドメイン リーダー案件も希望');
  });

  it('ラベル名の別名(内部に全角スペースが入る表記)を同一視する', () => {
    const bodyWithSpace = '【場 所】大阪';
    const bodyWithoutSpace = '【場所】大阪';
    expect(extractLabeledValue(bodyWithSpace, ['場所', '作業場所'])).toBe('大阪');
    expect(extractLabeledValue(bodyWithoutSpace, ['場所', '作業場所'])).toBe('大阪');
  });

  it('該当するラベルが無ければundefinedを返す', () => {
    expect(extractLabeledValue('関係の無い本文です', ['単価'])).toBeUndefined();
  });
});

// BP要員紹介メールで観察された「■ラベル 値」形式(■のみの見出し、
// 閉じカッコ無し)。次の■または末尾までが値になる。
describe('extractLabeledValue (■見出し形式)', () => {
  it('改行区切りの「■スキル」見出しから値を抽出できる', () => {
    const body = '■スキル\nJava, Spring Boot, AWS\n■経験\n5年';
    expect(extractLabeledValue(body, ['スキル'])).toBe('Java, Spring Boot, AWS');
  });

  it('HTML由来で1行に潰れた「■スキル 値 ■次の見出し」からも抽出できる', () => {
    const body = '■スキル Java, Spring Boot, AWS ■経験 5年';
    expect(extractLabeledValue(body, ['スキル'])).toBe('Java, Spring Boot, AWS');
  });

  it('全角カンマ区切りの値も抽出できる(分割自体はparseEngineerSkillList側の責務)', () => {
    const body = '■スキル\nJava、Spring、AWS\n■経験\n3年';
    expect(extractLabeledValue(body, ['スキル'])).toBe('Java、Spring、AWS');
  });

  it('既存の【スキル】形式は引き続き優先して動作する(■形式より先に試す)', () => {
    const body = '【スキル】Java, AWS\n【経験】5年';
    expect(extractLabeledValue(body, ['スキル'])).toBe('Java, AWS');
  });

  it('■見出しが無いメールでは従来通りundefinedを返す', () => {
    const body = 'スキルシートを送付いたします。よろしくお願いいたします。';
    expect(extractLabeledValue(body, ['スキル'])).toBeUndefined();
  });
});

// BP要員紹介メールで観察された「・ラベル：値」形式(箇条書きの「・」で
// 始まるコロン形式)。ラベル自体に全角カッコの注釈("単金（税抜）")が
// 含まれる場合も、その注釈込みでラベルの一部として一致させる。
describe('extractLabeledValue (・箇条書きコロン形式)', () => {
  it('「・単金（税抜）：」から値を抽出できる(注釈込みのラベル一致、改行区切り)', () => {
    const body = '・最寄駅：渋谷駅\n・単金（税抜）：70万円\n・稼働：即日';
    expect(extractLabeledValue(body, ['単金（税抜）'])).toBe('70万円');
  });

  it('HTML由来で1行に潰れ複数の「・ラベル：値」が並ぶ実メール相当の構造からも抽出できる', () => {
    const body = '・出社：応相談 ・単金（税抜）：100万円 ・希望：開発推進案件 ・NG：管理系業務 ■スキル';
    expect(extractLabeledValue(body, ['単金（税抜）'])).toBe('100万円');
  });

  it('該当ラベルが無ければundefinedを返す(・稼働／・出社頻度は今回対象外)', () => {
    const body = '・稼働：即日\n・出社頻度：フルリモート';
    expect(extractLabeledValue(body, ['単金（税抜）'])).toBeUndefined();
  });
});

describe('parseRateRange', () => {
  it('範囲区切り"68〜80万円"を抽出する', () => {
    expect(parseRateRange('68〜80万円')).toEqual({ min: 68, max: 80 });
  });

  it('範囲区切り"68万円〜80万円"を抽出する', () => {
    expect(parseRateRange('68万円〜80万円')).toEqual({ min: 68, max: 80 });
  });

  it('"73万(Min68万)"のようなMin明示表記を抽出する', () => {
    expect(parseRateRange('73万(Min68万)')).toEqual({ min: 68, max: 73 });
  });

  it('単一値"80万円"はmin=maxとして扱う', () => {
    expect(parseRateRange('80万円')).toEqual({ min: 80, max: 80 });
  });

  it('カンマ区切りの円表記"550,000円/月"を万円へ換算する', () => {
    expect(parseRateRange('550,000円/月')).toEqual({ min: 55, max: 55 });
  });

  it('"95万円／月前後"のような補足付き単一値も抽出する', () => {
    expect(parseRateRange('95万円／月前後')).toEqual({ min: 95, max: 95 });
  });

  it('"〜80万円（固定）"は固定値としてmin=maxで抽出する', () => {
    expect(parseRateRange('〜80万円（固定）')).toEqual({ min: 80, max: 80 });
  });

  it('下限が不明な"〜65万円（スキル見合い）"は下限を捏造せず抽出しない', () => {
    expect(parseRateRange('〜65万円（スキル見合い）')).toBeUndefined();
  });

  it('数値が2つあっても関係が不明な場合はレンジとして採用しない', () => {
    // 単価と無関係な数値が2つ紛れ込んだ場合の安全側動作
    expect(parseRateRange('担当者3名体制、来期は2倍規模を予定')).toBeUndefined();
  });

  it('既存のコロン形式テストで使われていた単一値"70万円"は引き続きmin=max扱い', () => {
    expect(parseRateRange('70万円')).toEqual({ min: 70, max: 70 });
  });

  it('全角チルダ"65万～75万"の範囲区切りを抽出する(BP-Aの単金表記で観察)', () => {
    expect(parseRateRange('65万～75万')).toEqual({ min: 65, max: 75 });
  });
});

describe('findRateInFreeText', () => {
  it('件名中の"73万"のような単価表記を抽出する', () => {
    expect(findRateInFreeText('【GH要員/73万/10月/フルリモート希望】バックエンド開発')).toEqual({
      min: 73,
      max: 73,
    });
  });

  it('件名中の範囲表記を抽出する', () => {
    expect(findRateInFreeText('【新規案件】68〜80万円/Java')).toEqual({ min: 68, max: 80 });
  });

  it('"万"が隣接しない数値(案件番号等)は単価として誤抽出しない', () => {
    expect(findRateInFreeText('【HB006435】ベテランJavaエンジニアのご紹介')).toBeUndefined();
  });

  it('単価が無い件名はundefinedを返す', () => {
    expect(findRateInFreeText('【面談1回】インフラPMO要員探してます')).toBeUndefined();
  });
});

describe('findRemoteInFreeText', () => {
  it('"フルリモート"を検出する', () => {
    expect(findRemoteInFreeText('フルリモート希望(初日出社可能)')).toBe(true);
  });

  it('"テレワーク"を検出する', () => {
    expect(findRemoteInFreeText('与野（テレワーク併用）')).toBe(true);
  });

  it('地名側の"不可"に引きずられず"リモートメイン"を正しくtrueと判定する', () => {
    expect(findRemoteInFreeText('リモートメイン（地方不可）')).toBe(true);
  });

  it('強いキーワードが無ければundefinedを返す(誤判定回避)', () => {
    expect(findRemoteInFreeText('東京都渋谷区')).toBeUndefined();
  });
});

describe('parseYesNo (remote判定の強いキーワード優先)', () => {
  it('"リモートメイン（地方不可）"はtrue(地方不可に引きずられない)', () => {
    expect(parseYesNo('リモートメイン（地方不可）')).toBe(true);
  });

  it('通常の"可"/"不可"判定は従来通り機能する', () => {
    expect(parseYesNo('可')).toBe(true);
    expect(parseYesNo('不可')).toBe(false);
  });
});

describe('parseRequiredSkillList / parseEngineerSkillList (ヶ月表記対応)', () => {
  it('"Java(51ヶ月)"を年数へ換算する', () => {
    expect(parseEngineerSkillList('Java(51ヶ月)')).toEqual([{ name: 'Java', years: 4.25 }]);
  });

  it('"約72ヶ月"のような概数表記も処理する', () => {
    expect(parseEngineerSkillList('TypeScript(約72ヶ月)')).toEqual([{ name: 'TypeScript', years: 6 }]);
  });

  it('既存の年単位表記("Java(3年以上)")は引き続き動作する', () => {
    expect(parseRequiredSkillList('Java(3年以上)', true)).toEqual([{ name: 'Java', minYears: 3, required: true }]);
  });

  it('先頭の"言語："見出しを除去してから解析する', () => {
    expect(parseEngineerSkillList('言語：JavaScript(70ヶ月) / Java(51ヶ月)')).toEqual([
      { name: 'JavaScript', years: 5.83 },
      { name: 'Java', years: 4.25 },
    ]);
  });
});

describe('parseDateValue', () => {
  it('"2026-10-15"はday precisionとしてそのまま取得する', () => {
    expect(parseDateValue('2026-10-15')).toEqual({ precision: 'day', value: '2026-10-15' });
  });

  it('"2026年10月1日"はday precisionへ正規化する', () => {
    expect(parseDateValue('2026年10月1日')).toEqual({ precision: 'day', value: '2026-10-01' });
  });

  it('"2026-10"(年月のみ)はmonth precisionとしてそのまま取得する', () => {
    expect(parseDateValue('2026-10')).toEqual({ precision: 'month', value: '2026-10' });
  });

  it('"2026年10月"(日が無い)はmonth precisionへ正規化する', () => {
    expect(parseDateValue('2026年10月')).toEqual({ precision: 'month', value: '2026-10' });
  });

  it('"2026年10月 ~ 2027年3月"のような範囲表記は先頭の年月をmonth precisionとして取得する', () => {
    expect(parseDateValue('2026年10月 ~ 2027年3月')).toEqual({ precision: 'month', value: '2026-10' });
  });

  it('"即日"はimmediate precisionとして取得する(具体的な暦日へは変換しない)', () => {
    expect(parseDateValue('即日')).toEqual({ precision: 'immediate', value: '' });
  });

  it('"即日~長期"のような補足付きでもimmediate precisionとして取得する', () => {
    expect(parseDateValue('即日~長期')).toEqual({ precision: 'immediate', value: '' });
  });

  it('年が無い"10月〜"は年を推測しないためunknown precisionとして扱う', () => {
    expect(parseDateValue('10月〜')).toEqual({ precision: 'unknown', value: '' });
  });

  it('"8月or9月〜"のような複数月にまたがる曖昧な表記はunknown precisionとして扱う(1つに決め打ちしない)', () => {
    expect(parseDateValue('8月or9月~長期')).toEqual({ precision: 'unknown', value: '' });
  });

  it('日付らしい記載が全く無ければundefinedを返す(フィールド自体が存在しなかったことと区別する)', () => {
    expect(parseDateValue('スキル見合い')).toBeUndefined();
  });
});

// 株式会社キャリアビート形式の案件メールで観察された「■ラベル■値」
// (■で開閉された見出し)。単独の■(閉じ側が無いextractSectionValue)とは
// 区別して扱う。
describe('extractLabeledValue (■ラベル■形式、両側■)', () => {
  it('「■期間■\\n値」から値を抽出できる(次の■または末尾までが値)', () => {
    const body = '■単価■\n60万円~80万円\n■期間■\n2026年10月 ~ 2027年3月\n■備考■\n商流:貴社まで';
    expect(extractLabeledValue(body, ['期間'])).toBe('2026年10月 ~ 2027年3月');
  });

  it('単独■(片側のみ)のextractSectionValue形式より後に試される(片側形式が優先して一致する)', () => {
    // ■スキルの直後に■が無いため、既存のextractSectionValue(片側)が
    // 先に一致する。両形式が混在していても既存挙動を壊さないことを確認する。
    const body = '■スキル Java, AWS ■経験 5年';
    expect(extractLabeledValue(body, ['スキル'])).toBe('Java, AWS');
  });

  it('■ラベル■形式が無い本文ではundefinedを返す', () => {
    const body = 'スキルシートを送付いたします。';
    expect(extractLabeledValue(body, ['期間'])).toBeUndefined();
  });
});
