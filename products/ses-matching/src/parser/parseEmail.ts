import type { RawEmail } from '../gmail/types';
import {
  extractLabeledValue,
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

function detectEmailType(subject: string, body: string): 'project' | 'engineer' | null {
  const text = `${subject}\n${body}`;
  const projectScore = countMatches(text, PROJECT_KEYWORDS);
  const engineerScore = countMatches(text, ENGINEER_KEYWORDS);
  if (projectScore === 0 && engineerScore === 0) return null;
  if (projectScore === engineerScore) return null; // 同点は判別不能として扱う
  return projectScore > engineerScore ? 'project' : 'engineer';
}

function parseProjectCandidate(body: string, id: string): Record<string, unknown> {
  const candidate: Record<string, unknown> = { id };

  const requiredValue = extractLabeledValue(body, ['必須スキル']);
  const preferredValue = extractLabeledValue(body, ['歓迎スキル', '尚可スキル']);
  const requiredSkills = [
    ...(requiredValue ? parseRequiredSkillList(requiredValue, true) : []),
    ...(preferredValue ? parseRequiredSkillList(preferredValue, false) : []),
  ];
  if (requiredSkills.length > 0) candidate.requiredSkills = requiredSkills;

  const rateValue = extractLabeledValue(body, ['単価']);
  const rateRange = rateValue ? parseRateRange(rateValue) : undefined;
  if (rateRange) {
    candidate.rateMin = rateRange.min;
    candidate.rateMax = rateRange.max;
  }

  const location = extractLabeledValue(body, ['勤務地']);
  if (location) candidate.location = location;

  const remoteValue = extractLabeledValue(body, ['リモート']);
  const remoteAllowed = remoteValue ? parseYesNo(remoteValue) : undefined;
  if (remoteAllowed !== undefined) candidate.remoteAllowed = remoteAllowed;

  const startDateValue = extractLabeledValue(body, ['稼働開始', '開始日']);
  const startDate = startDateValue ? parseDateJa(startDateValue) : undefined;
  if (startDate) candidate.startDate = startDate;

  const japaneseLevelValue = extractLabeledValue(body, ['日本語レベル', '日本語']);
  const japaneseLevel = japaneseLevelValue ? parseJapaneseLevel(japaneseLevelValue) : undefined;
  if (japaneseLevel) candidate.japaneseLevel = japaneseLevel;

  return candidate;
}

function parseEngineerCandidate(body: string, id: string): Record<string, unknown> {
  const candidate: Record<string, unknown> = { id };

  const skillsValue = extractLabeledValue(body, ['スキル']);
  if (skillsValue) candidate.skills = parseEngineerSkillList(skillsValue);

  const rateValue = extractLabeledValue(body, ['希望単価']);
  const rateRange = rateValue ? parseRateRange(rateValue) : undefined;
  if (rateRange) {
    candidate.desiredRateMin = rateRange.min;
    candidate.desiredRateMax = rateRange.max;
  }

  const locationsValue = extractLabeledValue(body, ['希望勤務地']);
  if (locationsValue) candidate.desiredLocations = parseLocationList(locationsValue);

  const remoteValue = extractLabeledValue(body, ['リモート希望', 'リモート']);
  const remoteDesired = remoteValue ? parseYesNo(remoteValue) : undefined;
  if (remoteDesired !== undefined) candidate.remoteDesired = remoteDesired;

  const availableFromValue = extractLabeledValue(body, ['稼働可能日', '稼働開始']);
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
      return { status: 'parsed', recordType: 'project', candidate: parseProjectCandidate(body, raw.id) };
    }
    if (type === 'engineer') {
      return { status: 'parsed', recordType: 'engineer', candidate: parseEngineerCandidate(body, raw.id) };
    }
    return { status: 'unparsed', reason: 'could not determine whether this is a project or engineer email' };
  } catch {
    return { status: 'unparsed', reason: 'unexpected email format' };
  }
}
