// Source of truth for the Vercel Serverless Function at
// GET /api/gmail/fetch-one — the production entry point for the same
// route that src/server/vitePlugin.ts serves locally under `vite dev`/
// `vite preview` (Vite's dev/preview server never runs on Vercel's
// static hosting, so that plugin's hooks don't apply there).
//
// No new backend framework: this only wires the existing, unchanged
// gmail -> parser -> validation -> matching pipeline (performGmailImport)
// to an HTTP response — no logic lives here.
//
// This file itself is never deployed directly. `npm run build:gmail-function`
// (run manually before `vercel deploy`/`vercel --prod`; local dev/build/
// tests never call it) bundles this file into api/gmail/fetch-one.js —
// gitignored, api/ deliberately has no committed source of its own. See
// scripts/bundleGmailFunction.mjs for why a plain relative-import file
// can't be deployed as-is, and why that step can't just be Vercel's own
// build command.

import { performGmailImport } from './gmailImportApi';

interface MinimalRequest {
  method?: string;
}

interface MinimalResponse {
  status(code: number): { json(body: unknown): void };
}

export default async function handler(req: MinimalRequest, res: MinimalResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ success: false, reason: 'method not allowed' });
    return;
  }

  const result = await performGmailImport();
  res.status(result.success ? 200 : 502).json(result);
}
