import { createContext, useContext, useState, type ReactNode } from 'react';
import type { GmailBulkImportResult } from '../server/types';

interface WorkspaceContextValue {
  result: GmailBulkImportResult | null;
  setResult: (result: GmailBulkImportResult) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

/**
 * Dashboardの一括Gmail取り込み結果を、ページ遷移をまたいでMatching
 * Workspace(Projects/Matching/Engineer Detail)から参照できるようにする
 * ための最小限のin-memory state。DBはまだ導入しないため、リロードで
 * 消える(ブラウザのタブ内メモリのみ)仕様で構わない。
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<GmailBulkImportResult | null>(null);
  return <WorkspaceContext.Provider value={{ result, setResult }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
