import type { DiagnosisInput, DiagnosisResult } from '../types/diagnosis';
import { buildDiagnosisResult } from './riskProfile';

export function runDiagnosis(input: DiagnosisInput): DiagnosisResult {
  return buildDiagnosisResult(input);
}
