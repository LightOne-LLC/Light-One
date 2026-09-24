import { authenticate, getGmailService, listMessageIdsSince } from '../client';

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

// listMessageIdsSince()の"ページネーションを最後まで処理する(500件で
// 打ち切らない)"分岐と"after:クエリの日付組み立て"分岐のみを検証する。
// 実Gmail/OAuthネットワークには一切アクセスしない
// (service.users.messages.listをモックで差し替える)。
describe('listMessageIdsSince', () => {
  function fakeService(list: (...args: unknown[]) => unknown) {
    return { users: { messages: { list } } } as unknown as ReturnType<typeof getGmailService>;
  }

  it('nextPageTokenが無くなるまでページネーションし、1ページ目(500件)超も取りこぼさず全件返す', async () => {
    const page1 = Array.from({ length: 500 }, (_, i) => ({ id: `p1-${i}` }));
    const page2 = [{ id: 'p2-0' }, { id: 'p2-1' }];
    const list = vi
      .fn()
      .mockResolvedValueOnce({ data: { messages: page1, nextPageToken: 'TOKEN_2' } })
      .mockResolvedValueOnce({ data: { messages: page2 } });

    const result = await listMessageIdsSince(fakeService(list), Date.now());

    expect(list).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(502);
    expect(result[500]).toEqual({ id: 'p2-0' });
    // 2回目の呼び出しでは1回目のnextPageTokenをそのまま渡す。
    expect(list.mock.calls[1][0]).toMatchObject({ pageToken: 'TOKEN_2' });
  });

  it('after:クエリには暦日境界の取りこぼしを避けるため1日前倒しした日付を使う', async () => {
    const list = vi.fn().mockResolvedValue({ data: { messages: [] } });
    // 2026-01-10T00:00:00Z (JSTでは2026-01-10 09:00) の3日前を想定。
    const sinceMs = Date.UTC(2026, 0, 10, 0, 0, 0);

    await listMessageIdsSince(fakeService(list), sinceMs);

    expect(list.mock.calls[0][0]).toMatchObject({ q: 'after:2026/01/09' });
  });

  it('該当メールが無ければ空配列を返す', async () => {
    const list = vi.fn().mockResolvedValue({ data: {} });
    const result = await listMessageIdsSince(fakeService(list), Date.now());
    expect(result).toEqual([]);
  });
});
