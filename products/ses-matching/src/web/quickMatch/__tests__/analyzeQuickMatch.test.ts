import { analyzeQuickMatchText } from '../analyzeQuickMatch';

// 今回の実案件(要求仕様に明記されたサンプル)。個人名・電話番号等の
// PIIは含まれない、案件条件のみのテキスト。
const REAL_PROJECT_SAMPLE = `お世話になっております。
こちら急ぎの案件となります🙇‍♀️
よろしくお願いいたします。
先週面談しましたが、見送りや他決で決まりませんでした。
本日か明日で面談できる人を優先します。
※外部設計がしっかりしていない現場なので、それでも詳細設計以降を問題なくやれる方を求めております。事前にご確認をお願いします。
65歳までOKです！
＝＝＝＝＝＝＝＝＝＝＝
■概要　　：駐車場管理システム新規構築(AS400)
■就業時間：9:30～18:30　休憩60分
■スキル　：開発～結合テストフェーズ
　　　　　　ILE-RPGの開発経験
　　　　　　※コミュニケーション能力と積極的に動ける方
　　　　　　仕訳関連知識(尚可)
■作業内容：製造，結合テスト等
■期間　　：2026年10月～2026月12月(延長の可能性大)
■作業場所：(最寄駅：大門，芝公園，浜松町)  or  在宅(週２～3日)
■要員数　：1名
■単価　　：55万円
　　　　　　※140H～190H 時間精算 中間割り
■面談　　：1回（上位との面談）
■年齢　　：50歳代希望(製造に自信があれば60歳代前半の検討可）
＝＝＝＝＝＝＝＝＝＝＝`;

describe('analyzeQuickMatchText', () => {
  it('空文字は status: empty を返す', () => {
    expect(analyzeQuickMatchText('')).toEqual({ status: 'empty' });
  });

  it('空白のみの入力も status: empty を返す', () => {
    expect(analyzeQuickMatchText('　\n\t  ')).toEqual({ status: 'empty' });
  });

  it('案件/要員どちらの強いシグナルも無いテキストはauto判定でparse-failedになる', () => {
    const result = analyzeQuickMatchText('こんにちは、来週の予定について確認させてください。', 'auto');
    expect(result.status).toBe('parse-failed');
  });

  it('override:"project"を指定すると、実案件サンプルをProjectとして構造化しvalidationも通る', () => {
    const result = analyzeQuickMatchText(REAL_PROJECT_SAMPLE, 'project');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok' || result.recordType !== 'project') return;

    expect(result.record.requiredSkills.length).toBeGreaterThan(0);
    expect(result.record.rateMin).toBe(55);
    expect(result.record.rateMax).toBe(55);
    expect(result.record.remoteAllowed).toBe(true);
    expect(result.record.startDate).toEqual({ precision: 'month', value: '2026-10' });
  });

  it('override指定なし(auto)でも実案件サンプルをProjectとして正しく判定する(detectEmailType強化の回帰確認)', () => {
    // 以前は「要員数」(ENGINEER_KEYWORDSの「要員」に部分一致)と「案件」が
    // 汎用キーワードスコアで同点になり、「■スキル」でのタイブレークにより
    // Engineerと誤判定されていた(実データで確認済みの既知のバグ)。
    // 案件固有の構造シグナル(■概要/■作業内容/■期間/■作業場所/■要員数/■面談)
    // を追加したことで、タイブレークに達する前にProjectが明確に優勢になる。
    const result = analyzeQuickMatchText(REAL_PROJECT_SAMPLE, 'auto');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.recordType).toBe('project');
  });

  it('日付の誤記("2026月12月")を勝手に別の日付へ補正しない', () => {
    const result = analyzeQuickMatchText(REAL_PROJECT_SAMPLE, 'project');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok' || result.recordType !== 'project') return;
    // startDateは開始月(2026-10)のみを保持し、誤記のある終了時期を
    // 別のフィールドとして推測生成しない(ProjectRecordに終了日フィールド
    // 自体が存在しないことを、候補オブジェクトに無いことで確認する)。
    expect(result.record).not.toHaveProperty('endDate');
  });

  it('override:"engineer"を指定すると、要員スキルシート風のテキストをEngineerとして構造化する', () => {
    const engineerText = [
      '合同会社サンプルの田中です。',
      '現在フリーの技術者をご紹介させていただきます。',
      '氏名：山田太郎',
      '経歴：Java開発 5年、AWS運用 2年',
      'スキル：Java(5年)、AWS(2年)',
      '希望単価：70万円',
      '稼働可能日：即日',
      '希望勤務地：東京都',
      'リモート希望：あり',
    ].join('\n');

    const result = analyzeQuickMatchText(engineerText, 'engineer');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok' || result.recordType !== 'engineer') return;
    expect(result.record.skills.length).toBeGreaterThan(0);
  });

  it('override未指定(auto)はdetectEmailTypeと同じ判定に従う(要員文脈が強いテキストがEngineerと判定される)', () => {
    const engineerText = [
      '要員のご紹介です。',
      '経歴：Java開発5年',
      'スキル：Java(5年)',
      '希望単価：70万円',
      '稼働可能日：即日',
      '希望勤務地：東京都',
      'リモート希望：あり',
    ].join('\n');
    const result = analyzeQuickMatchText(engineerText, 'auto');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.recordType).toBe('engineer');
  });

  it('必須項目が欠けているテキストはstatus: validation-failedとなり、途中まで抽出できた内容も保持する', () => {
    // 必須スキルのラベルはあるが、単価・勤務地・稼働時期・remoteAllowedが
    // 一切書かれていない案件文(validationがFAILするのは既存仕様通り)。
    const incompleteProjectText = ['案件のご紹介です。', '必須スキル：Java'].join('\n');
    const result = analyzeQuickMatchText(incompleteProjectText, 'project');
    expect(result.status).toBe('validation-failed');
    if (result.status !== 'validation-failed') return;
    expect(result.recordType).toBe('project');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.candidate).toHaveProperty('requiredSkills');
  });

  it('同じテキストを複数回解析しても、その都度異なるid(その場限りの識別子)が振られる', () => {
    const r1 = analyzeQuickMatchText(REAL_PROJECT_SAMPLE, 'project');
    const r2 = analyzeQuickMatchText(REAL_PROJECT_SAMPLE, 'project');
    if (r1.status !== 'ok' || r2.status !== 'ok' || r1.recordType !== 'project' || r2.recordType !== 'project') {
      throw new Error('setup failed');
    }
    expect(r1.record.id).not.toBe(r2.record.id);
  });
});
