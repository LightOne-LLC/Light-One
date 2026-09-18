import { runDiagnosis as calcDiagnosis, levelFromScore } from '../calc';
import type { DiagnosisInput, DiagnosisResult, HistoryItem, RiskCategoryResult } from '../types/diagnosis';

interface StoredDiagnosis {
  id: string;
  input: DiagnosisInput;
  result: DiagnosisResult;
  createdAt: string;
}

const STORAGE_KEY = 'insurance-risk-diagnosis:history';

function loadAll(): StoredDiagnosis[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredDiagnosis[]) : [];
  } catch {
    return [];
  }
}

function saveAll(records: StoredDiagnosis[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    throw new Error('診断結果の保存に失敗しました(ブラウザのストレージが利用できません)。');
  }
}

// 旧バージョン(7領域のRisk Profile導入前)で保存された結果には categories / overallScore が存在しない。
// 過去の履歴を開いても壊れないよう、旧4項目から簡易的にRisk Profile相当のデータを補完する。
function normalizeResult(result: DiagnosisResult): DiagnosisResult {
  if (Array.isArray(result.categories) && result.categories.length > 0 && typeof result.overallScore === 'number') {
    return result;
  }
  const legacyCategories: RiskCategoryResult[] = [
    { key: 'death', label: '死亡', score: Math.round(result.deathCoverage?.riskScore ?? 0), level: levelFromScore(result.deathCoverage?.riskScore ?? 0), reasons: result.deathCoverage?.reasons ?? [] },
    { key: 'medical', label: '医療', score: Math.round(result.medicalRisk?.score ?? 0), level: levelFromScore(result.medicalRisk?.score ?? 0), reasons: result.medicalRisk?.reasons ?? [] },
    { key: 'disability', label: '就業不能', score: Math.round(result.disabilityRisk?.score ?? 0), level: levelFromScore(result.disabilityRisk?.score ?? 0), reasons: result.disabilityRisk?.reasons ?? [] },
    { key: 'retirement', label: '老後', score: Math.round(result.assetFormation?.score ?? 0), level: levelFromScore(result.assetFormation?.score ?? 0), reasons: result.assetFormation?.reasons ?? [] },
  ];
  const overallScore = Math.round(legacyCategories.reduce((s, c) => s + c.score, 0) / legacyCategories.length);
  return {
    ...result,
    categories: legacyCategories,
    overallScore,
    assumptions: result.assumptions?.length
      ? result.assumptions
      : ['この診断結果はアップグレード前のバージョンで保存されたため、一部の項目(介護・資産・相続)は表示されません。'],
  };
}

// サーバーには何も送らず、診断はブラウザ内で計算し、このブラウザのlocalStorageにのみ保存する(完全無料構成)。
export async function runDiagnosis(input: DiagnosisInput): Promise<{ id: string; result: DiagnosisResult }> {
  const result = calcDiagnosis(input);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const records = loadAll();
  records.push({ id, input, result, createdAt });
  saveAll(records);

  return { id, result };
}

export async function listDiagnosisHistory(): Promise<HistoryItem[]> {
  return loadAll()
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => {
      const result = normalizeResult(r.result);
      const topRisks = result.categories
        .slice()
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((c) => ({ label: c.label, level: c.level }));
      return {
        id: r.id,
        createdAt: r.createdAt,
        requiredDeathCoverage: result.deathCoverage.requiredAmount,
        overallScore: result.overallScore,
        topRisks,
        suggestedProductTypes: result.suggestedProductTypes,
      };
    });
}

export async function getDiagnosisDetail(id: string): Promise<{ id: string; input: DiagnosisInput; result: DiagnosisResult; createdAt: string }> {
  const record = loadAll().find((r) => r.id === id);
  if (!record) throw new Error('診断結果が見つかりません。');
  return { ...record, result: normalizeResult(record.result) };
}

export async function deleteDiagnosisHistory(id: string): Promise<void> {
  const records = loadAll().filter((r) => r.id !== id);
  saveAll(records);
}

const DRAFT_STORAGE_KEY = 'insurance-risk-diagnosis:draft';

// 診断フォームの入力途中データのみを保存する下書き機能。診断結果の保存(STORAGE_KEY)とは別のキー・別のライフサイクルで管理する。
export function saveDraft(input: DiagnosisInput): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(input));
  } catch {
    // 下書き保存に失敗しても入力自体は継続できるため、エラーは無視する。
  }
}

export function loadDraft(): DiagnosisInput | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DiagnosisInput) : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // 削除に失敗しても致命的ではないため無視する。
  }
}
