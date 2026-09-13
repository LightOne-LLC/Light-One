// Viteのdev/previewサーバーに、GET /api/gmail/fetch-one を1本だけ生やす
// プラグイン。configureServer/configurePreviewServerはVite自身のNode
// プロセス内でのみ実行され、クライアントバンドルには一切含まれない —
// これが「ブラウザにGmail認証情報を持ち込まない」ための境界そのもの。
//
// 新しいBackend framework(Express等)は導入していない。Viteが既に
// 持っているサーバー(connectベースのmiddleware)をそのまま使う。

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { performGmailImport } from './gmailImportApi';

const ROUTE = '/api/gmail/fetch-one';

function createHandler() {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url !== ROUTE || req.method !== 'GET') {
      next();
      return;
    }

    performGmailImport()
      .then((result) => {
        res.statusCode = result.success ? 200 : 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      })
      .catch(() => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, reason: 'internal error' }));
      });
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
