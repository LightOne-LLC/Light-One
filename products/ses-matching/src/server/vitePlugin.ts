// Viteのdev/previewサーバーに、GET /api/gmail/fetch-one と
// GET /api/gmail/fetch を生やすプラグイン。configureServer/
// configurePreviewServerはVite自身のNodeプロセス内でのみ実行され、
// クライアントバンドルには一切含まれない — これが「ブラウザにGmail認証情報を
// 持ち込まない」ための境界そのもの。
//
// 新しいBackend framework(Express等)は導入していない。Viteが既に
// 持っているサーバー(connectベースのmiddleware)をそのまま使う。

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { performGmailImport } from './gmailImportApi';
import { performGmailBulkImport } from './gmailBulkImportApi';

const FETCH_ONE_ROUTE = '/api/gmail/fetch-one';
const FETCH_ROUTE = '/api/gmail/fetch';

function writeJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function createHandler() {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.method !== 'GET' || !req.url) {
      next();
      return;
    }

    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === FETCH_ONE_ROUTE) {
      performGmailImport()
        .then((result) => writeJson(res, result.success ? 200 : 502, result))
        .catch(() => writeJson(res, 500, { success: false, reason: 'internal error' }));
      return;
    }

    if (url.pathname === FETCH_ROUTE) {
      const limitParam = url.searchParams.get('limit') ?? undefined;
      performGmailBulkImport(limitParam)
        .then((result) => writeJson(res, result.success ? 200 : 502, result))
        .catch(() => writeJson(res, 500, { success: false, reason: 'internal error' }));
      return;
    }

    next();
  };
}

export function gmailApiPlugin(): Plugin {
  return {
    name: 'ses-matching-gmail-api',
    configureServer(server) {
      server.middlewares.use(createHandler());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createHandler());
    },
  };
}
