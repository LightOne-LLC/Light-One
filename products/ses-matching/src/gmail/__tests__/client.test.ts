import { authenticate } from '../client';

// authenticate()の"env var優先"分岐と"サーバーレスではfail fast"分岐のみを検証する。
// 実Gmail/OAuthネットワークには一切アクセスしない(env var経路はファイル/ネットワーク
// I/Oを行わずOAuth2Clientを構築するだけなので、テストでも安全に呼び出せる)。

const ENV_KEYS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'VERCEL'] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  // ローカルの実credentials.json/token.jsonが存在しても影響を受けないよう、
  // 存在しないパスを指す。
  process.env.GMAIL_CREDENTIALS_PATH = '/tmp/ses-matching-test-does-not-exist-credentials.json';
  process.env.GMAIL_TOKEN_PATH = '/tmp/ses-matching-test-does-not-exist-token.json';
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  delete process.env.GMAIL_CREDENTIALS_PATH;
  delete process.env.GMAIL_TOKEN_PATH;
});

describe('authenticate', () => {
  it('GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKENが揃っていればファイル/ブラウザ認証を使わず構築する', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REFRESH_TOKEN = 'test-refresh-token';

    const client = await authenticate();
    expect(client.credentials.refresh_token).toBe('test-refresh-token');
  });

  it('env varが一部欠けている場合はenv var経路を使わない', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    // client secret / refresh tokenを与えない
    process.env.VERCEL = '1';

    await expect(authenticate()).rejects.toThrow(/Gmail credentials are not configured/);
  });

  it('サーバーレス環境(VERCEL)でenv varも既存tokenも無ければfail fastする(ハングしない)', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REFRESH_TOKEN;
    process.env.VERCEL = '1';

    await expect(authenticate()).rejects.toThrow(/Gmail credentials are not configured/);
  });
});
