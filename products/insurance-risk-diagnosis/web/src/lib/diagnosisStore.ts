import { runDiagnosis as calcDiagnosis } from '../calc';
import type { DiagnosisInput, DiagnosisResult, HistoryItem } from '../types/diagnosis';

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
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      requiredDeathCoverage: r.result.deathCoverage.requiredAmount,
      medicalScore: r.result.medicalRisk.score,
      disabilityScore: r.result.disabilityRisk.score,
      assetFormationScore: r.result.assetFormation.score,
      suggestedProductTypes: r.result.suggestedProductTypes,
    }));
}

export async function getDiagnosisDetail(id: string): Promise<{ id: string; input: DiagnosisInput; result: DiagnosisResult; createdAt: string }> {
  const record = loadAll().find((r) => r.id === id);
  if (!record) throw new Error('診断結果が見つかりません。');
  return record;
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
