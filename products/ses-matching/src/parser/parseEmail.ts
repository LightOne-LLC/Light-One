import type { RawEmail } from '../gmail/types';
import {
  extractBulletValueNoColonNumeric,
  extractLabeledValue,
  extractNestedSkillSections,
  findRateInFreeText,
  findRemoteInFreeText,
  parseDateValue,
  parseEngineerSkillList,
  parseJapaneseLevel,
  parseLocationList,
  parseNestedRequirementList,
  parseRateRange,
  parseRequiredSkillList,
  parseYesNo,
  stripNoteSuffix,
} from './extractors';
import type { ParsedEmailResult } from './types';

const PROJECT_KEYWORDS = ['案件', '募集', '必須スキル', '商流'];
const ENGINEER_KEYWORDS = ['要員', 'スキルシート', '希望単価', '稼働可能日', '経歴'];

function countMatches(text: string, keywords: string[]): number {
  return keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0);
}

// 実際のBP要員紹介メール(HTML由来で改行が失われ1行化するケースが多い)で
// 観察された、■見出し(■基本情報/■希望条件/■スキル/■経験/■PR/■備考)による
// セクション構造と、・ラベル：の箇条書き(・稼働：/・出社頻度：)。
// いずれも記号込みの複数文字からなる固有性の高い表現であり、通常の無関係な
// メール本文に偶然出現することは考えにくいため、単独の一致でも
// 「BP要員メールらしい構造的シグナル」として扱う(単純な1単語一致による
// 粗い判定とは異なる)。
const BP_ENGINEER_STRUCTURAL_MARKERS = [
  '■基本情報',
  '■希望条件',
  '■スキル',
  '■経験',
  '■PR',
  '■ＰＲ',
  '■備考',
  '・稼働：',
  '・稼働:',
  '・出社頻度：',
  '・出社頻度:',
];

function hasBpEngineerStructuralSignal(body: string): boolean {
  return BP_ENGINEER_STRUCTURAL_MARKERS.some((marker) => body.includes(marker));
}

function detectEmailType(subject: string, body: string): 'project' | 'engineer' | null {
  const text = `${subject}\n${body}`;
  const projectScore = countMatches(text, PROJECT_KEYWORDS);
  const engineerScore = countMatches(text, ENGINEER_KEYWORDS);
  if (projectScore === 0 && engineerScore === 0) return null;
  if (projectScore === engineerScore) {
    // 通常のキーワード判定が同点で決着しない場合のみ、BP要員メール特有の
    // 構造的シグナルでタイブレークする。既存の非同点判定(明確にproject/
    // engineerと判別できるメール)には一切影響しない。
    return hasBpEngineerStructuralSignal(body) ? 'engineer' : null;
  }
  return projectScore > engineerScore ? 'project' : 'engineer';
}

function parseProjectCandidate(subject: string, body: string, id: string): Record<string, unknown> {
  const candidate: Record<string, unknown> = { id };

  const requiredValue = extractLabeledValue(body, ['必須スキル', '必要スキル']);
  const preferredValue = extractLabeledValue(body, ['歓迎スキル', '尚可スキル']);
  // 株式会社キャリアビート形式で観察された「■スキル■」+「<<必須>>」/
  // 「<<尚可>>」(稀に【必須】【尚可】)のネスト構造。明示的な必須/歓迎スキル
  // ラベルが無い場合のみのフォールバックとして使う(優先順位を維持)。
  const skillSectionValue = requiredValue || preferredValue ? undefined : extractLabeledValue(body, ['スキル']);
  const nestedSkills = skillSectionValue ? extractNestedSkillSections(skillSectionValue) : {};

  const requiredSkills = [
    ...(requiredValue
      ? parseRequiredSkillList(requiredValue, true)
      : nestedSkills.required
        ? parseNestedRequirementList(nestedSkills.required, true)
        : []),
    ...(preferredValue
      ? parseRequiredSkillList(preferredValue, false)
      : nestedSkills.preferred
        ? parseNestedRequirementList(nestedSkills.preferred, false)
        : []),
  ];
  if (requiredSkills.length > 0) candidate.requiredSkills = requiredSkills;

  const rateValue = extractLabeledValue(body, ['単価', '金額', '契約金額']);
  const rateRange = rateValue ? parseRateRange(rateValue) : findRateInFreeText(subject);
  if (rateRange) {
    candidate.rateMin = rateRange.min;
    candidate.rateMax = rateRange.max;
  }

  const location = extractLabeledValue(body, ['勤務地', '作業場所', '場所']);
  if (location) candidate.location = location;

  const remoteValue = extractLabeledValue(body, ['リモート', '通勤', '出社']);
  const remoteAllowed =
    (remoteValue ? parseYesNo(remoteValue) : undefined) ??
    (location ? findRemoteInFreeText(location) : undefined) ??
    findRemoteInFreeText(subject);
  if (remoteAllowed !== undefined) candidate.remoteAllowed = remoteAllowed;

  const startDateValue = extractLabeledValue(body, ['稼働開始', '開始日', '作業期間', '期間']);
  const startDate = startDateValue ? parseDateValue(startDateValue) : undefined;
  if (startDate) candidate.startDate = startDate;

  const japaneseLevelValue = extractLabeledValue(body, ['日本語レベル', '日本語']);
  const japaneseLevel = japaneseLevelValue ? parseJapaneseLevel(japaneseLevelValue) : undefined;
  if (japaneseLevel) candidate.japaneseLevel = japaneseLevel;

  return candidate;
}

function parseEngineerCandidate(subject: string, body: string, id: string): Record<string, unknown> {
  const candidate: Record<string, unknown> = { id };

  const skillsValue = extractLabeledValue(body, ['スキル']);
  if (skillsValue) candidate.skills = parseEngineerSkillList(skillsValue);

  // BP-A形式の「・単金（税抜）：」もここに接続する(単金＝要員側の希望単価と同義)。
  // 括弧の全角/半角ゆれを個別のラベルとして扱う(注釈込みでラベルの一部とする)。
  // 一部の実メールではコロンが省略される("・単金（税抜）85万円")ため、
  // その場合は数字直前フォールバックで補う。
  const rateLabels = ['希望単価', '単価', '単金（税抜）', '単金(税抜)', '単金'];
  const rateValue = extractLabeledValue(body, rateLabels) ?? extractBulletValueNoColonNumeric(body, rateLabels);
  const rateRange = rateValue ? parseRateRange(rateValue) : findRateInFreeText(subject);
  if (rateRange) {
    candidate.desiredRateMin = rateRange.min;
    candidate.desiredRateMax = rateRange.max;
  }

  // BP-A形式の実メールには「勤務地」「作業場所」「希望勤務地」に相当するラベルは
  // 存在せず、「・最寄駅：」(要員の最寄駅、居住地に近い情報)のみが記載される。
  // 「最寄駅」は「希望勤務地」そのものではないが、BP-A形式では他に代替の
  // 位置情報が無いため、既存の【最寄駅】形式(非BP-A、通常のスキルシート形式)
  // と同様にdesiredLocationsの値として採用する。実際に「勤務地」「作業場所」
  // 相当のラベルが記載されているメールでは、そちらが優先される(labels配列の
  // 先頭に「希望勤務地」を置いているため)。「最寄り駅」(り入り)という表記
  // ゆれも実メールで観測されたため候補に加える。
  const locationsValue = extractLabeledValue(body, ['希望勤務地', '最寄駅', '最寄り駅']);
  // 一部の実メール(単独■見出し形式)では、最寄駅の値に直接
  // "※リモート希望（週1~4日出社可）"のような注記が続けて書かれ、次の■まで
  // 丸ごと1つの値として抽出される。注記込みで勤務地とみなすと汚染される
  // ため、勤務地としてはstripNoteSuffixで※以降を切り落とす(remoteDesiredの
  // 判定には注記込みの元の値を別途使う、下記参照)。
  if (locationsValue) {
    const location = stripNoteSuffix(locationsValue);
    if (location) candidate.desiredLocations = parseLocationList(location);
  }

  // BP-A形式の「・出社頻度：」は「稼働●回まで出社可能」「常駐可能」等、
  // リモートの可否を直接表さない自由文が多い(「可」の一致だけでtrue判定すると
  // 「出社可能」「常駐可能」まで誤ってリモート希望=trueにしてしまう)。そのため
  // 出社頻度の値は、直接的な「リモート」ラベルの値(parseYesNoで柔軟に判定)とは
  // 別に、フルリモート/リモートメイン等の強いキーワードのみで判定する
  // findRemoteInFreeTextを使う(該当が無ければ無理に推測せずundefinedのまま)。
  // 最寄駅の値に埋め込まれた注記(上記)も同様にfindRemoteInFreeTextで拾う
  // (案件側のfindRemoteInFreeText(location)フォールバックと同じ考え方)。
  const directRemoteValue = extractLabeledValue(body, ['リモート希望', 'リモート', '通勤']);
  const commuteFrequencyValue = extractLabeledValue(body, ['出社頻度']);
  const remoteDesired =
    (directRemoteValue ? parseYesNo(directRemoteValue) : undefined) ??
    (commuteFrequencyValue ? findRemoteInFreeText(commuteFrequencyValue) : undefined) ??
    (locationsValue ? findRemoteInFreeText(locationsValue) : undefined) ??
    findRemoteInFreeText(subject);
  if (remoteDesired !== undefined) candidate.remoteDesired = remoteDesired;

  // BP-A形式の実メールは「・稼働：」(開始/可能日を表す接頭辞無しの単独ラベル)
  // のみを使うため、末尾に素の'稼働'も候補として追加する(より具体的な
  // ラベルを優先する順序は維持)。
  const availableFromValue = extractLabeledValue(body, ['稼働可能日', '稼働開始日', '稼働開始', '稼働']);
  const availableFrom = availableFromValue ? parseDateValue(availableFromValue) : undefined;
  if (availableFrom) candidate.availableFrom = availableFrom;

  const japaneseLevelValue = extractLabeledValue(body, ['日本語レベル', '日本語']);
  const japaneseLevel = japaneseLevelValue ? parseJapaneseLevel(japaneseLevelValue) : undefined;
  if (japaneseLevel) candidate.japaneseLevel = japaneseLevel;

  return candidate;
}

/**
 * RawEmailを案件/要員メールとして判定し、既存のvalidateProjectRecord /
 * validateEngineerRecordにそのまま渡せる候補オブジェクトへ変換する。
 *
 * このParserはvalidationを行わない(既存validationとの責務分離)。
 * 抽出できなかったフィールドはcandidateにキーごと含めず、
 * validateProjectRecord/validateEngineerRecordの必須項目チェックに委ねる。
 * 万能パーサーではなく、想定外フォーマットでは例外を投げず"unparsed"を返す。
 */
export function parseEmail(raw: RawEmail): ParsedEmailResult {
  try {
    const body = raw.bodyText ?? '';
    const subject = raw.subject ?? '';
    const type = detectEmailType(subject, body);

    if (type === 'project') {
      return { status: 'parsed', recordType: 'project', candidate: parseProjectCandidate(subject, body, raw.id) };
    }
    if (type === 'engineer') {
      return { status: 'parsed', recordType: 'engineer', candidate: parseEngineerCandidate(subject, body, raw.id) };
    }
    return { status: 'unparsed', reason: 'could not determine whether this is a project or engineer email' };
  } catch {
    return { status: 'unparsed', reason: 'unexpected email format' };
  }
}
