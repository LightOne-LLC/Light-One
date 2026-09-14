import type { RawEmail } from '../gmail/types';
import {
  extractLabeledValue,
  findRateInFreeText,
  findRemoteInFreeText,
  parseDateJa,
  parseEngineerSkillList,
  parseJapaneseLevel,
  parseLocationList,
  parseRateRange,
  parseRequiredSkillList,
  parseYesNo,
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
  const requiredSkills = [
    ...(requiredValue ? parseRequiredSkillList(requiredValue, true) : []),
    ...(preferredValue ? parseRequiredSkillList(preferredValue, false) : []),
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
  const startDate = startDateValue ? parseDateJa(startDateValue) : undefined;
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
  const rateValue = extractLabeledValue(body, ['希望単価', '単価', '単金（税抜）', '単金(税抜)', '単金']);
  const rateRange = rateValue ? parseRateRange(rateValue) : findRateInFreeText(subject);
  if (rateRange) {
    candidate.desiredRateMin = rateRange.min;
    candidate.desiredRateMax = rateRange.max;
  }

  const locationsValue = extractLabeledValue(body, ['希望勤務地', '最寄駅']);
  if (locationsValue) candidate.desiredLocations = parseLocationList(locationsValue);

  const remoteValue = extractLabeledValue(body, ['リモート希望', 'リモート', '通勤']);
  const remoteDesired = (remoteValue ? parseYesNo(remoteValue) : undefined) ?? findRemoteInFreeText(subject);
  if (remoteDesired !== undefined) candidate.remoteDesired = remoteDesired;

  const availableFromValue = extractLabeledValue(body, ['稼働可能日', '稼働開始日', '稼働開始']);
  const availableFrom = availableFromValue ? parseDateJa(availableFromValue) : undefined;
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
