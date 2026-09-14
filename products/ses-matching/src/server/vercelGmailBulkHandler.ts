// Source of truth for the Vercel Serverless Function at
// GET /api/gmail/fetch — the production entry point for the same route
// that src/server/vitePlugin.ts serves locally under `vite dev`/
// `vite preview`. Same pattern as vercelGmailHandler.ts (fetch-one):
// this only wires the existing, unchanged
// gmail -> parser -> validation -> matching pipeline
// (performGmailBulkImport) to an HTTP response — no logic lives here.
//
// This file itself is never deployed directly. `npm run build:gmail-function`
// bundles this (and vercelGmailHandler.ts) into api/gmail/fetch.js —
// gitignored, same reasoning as fetch-one.js (see
// scripts/bundleGmailFunction.mjs).

import { performGmailBulkImport } from './gmailBulkImportApi';

interface MinimalRequest {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
}

interface MinimalResponse {
  status(code: number): { json(body: unknown): void };
}

export default async function handler(req: MinimalRequest, res: MinimalResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ success: false, reason: 'method not allowed' });
    return;
  }

  const limitParam = req.query?.limit;
  const limit = Array.isArray(limitParam) ? limitParam[0] : limitParam;

  const result = await performGmailBulkImport(limit);
  res.status(result.success ? 200 : 502).json(result);
}
