/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Optional AI candidate-scoring endpoint; unset in this deployment, so
   *  matchScoring.ts always falls back to the rule-based scorer. */
  readonly VITE_AI_MATCH_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
