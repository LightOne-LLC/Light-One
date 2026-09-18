// Validationエラーのフィールド名(例: "startDate")を、Workspace UI表示用の
// 短い日本語ラベルへ変換する。マッピングが無いフィールドはそのまま返す。
const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  requiredSkills: '必須スキル',
  rateMin: '単価(下限)',
  rateMax: '単価(上限)',
  location: '勤務地',
  remoteAllowed: 'リモート可否',
  startDate: '開始日',
  japaneseLevel: '日本語レベル',
  skills: 'スキル',
  desiredRateMin: '希望単価(下限)',
  desiredRateMax: '希望単価(上限)',
  desiredLocations: '希望勤務地',
  remoteDesired: 'リモート希望',
  availableFrom: '稼働開始日',
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}
