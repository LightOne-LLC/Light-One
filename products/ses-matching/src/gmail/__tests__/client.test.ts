import type { OAuth2Client } from 'google-auth-library';
import { authenticate, getGmailService, getMessagesBatch, listMessageIdsSince } from '../client';

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

// getMessagesBatch()のバッチHTTPリクエスト組み立て・multipart/mixedレスポンス
// 解析・個別失敗時の扱いのみを検証する。実Gmail/OAuthネットワークには
// 一切アクセスしない(globalのfetchをモックで差し替える)。
describe('getMessagesBatch', () => {
  function fakeAuth(token = 'fake-access-token') {
    return { getAccessToken: vi.fn().mockResolvedValue({ token }) } as unknown as OAuth2Client;
  }

  function buildMultipartResponse(parts: { status: number; json?: Record<string, unknown> }[]) {
    const boundary = 'batch_test_boundary';
    let body = '';
    parts.forEach((part, i) => {
      body += `--${boundary}\r\n`;
      body += 'Content-Type: application/http\r\n';
      body += `Content-ID: <response-item-${i}>\r\n\r\n`;
      body += `HTTP/1.1 ${part.status} ${part.status === 200 ? 'OK' : 'Not Found'}\r\n`;
      body += 'Content-Type: application/json; charset=UTF-8\r\n\r\n';
      body += part.json ? JSON.stringify(part.json) : '';
      body += '\r\n\r\n';
    });
    body += `--${boundary}--`;
    return { boundary, body };
  }

  function mockFetchWithParts(parts: { status: number; json?: Record<string, unknown> }[]) {
    const { boundary, body } = buildMultipartResponse(parts);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? `multipart/mixed; boundary=${boundary}` : null),
      },
      text: async () => body,
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('複数messageを1回のバッチHTTPリクエストで取得できる', async () => {
    const fetchMock = mockFetchWithParts([
      { status: 200, json: { id: 'msg-1', threadId: 'thread-1', internalDate: '1700000000000', payload: { headers: [] } } },
      { status: 200, json: { id: 'msg-2', threadId: 'thread-2', internalDate: '1700000001000', payload: { headers: [] } } },
    ]);

    const results = await getMessagesBatch(fakeAuth(), ['msg-1', 'msg-2']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.map((m) => m.id).sort()).toEqual(['msg-1', 'msg-2']);
  });

  it('message内容(internalDate含む)がgetMessage()個別取得時と同じ形式で返る', async () => {
    mockFetchWithParts([
      {
        status: 200,
        json: { id: 'msg-1', threadId: 'thread-1', internalDate: '1700000000000', payload: { headers: [{ name: 'Subject', value: 'Hello' }] } },
      },
    ]);

    const [result] = await getMessagesBatch(fakeAuth(), ['msg-1']);
    expect(result).toEqual({
      id: 'msg-1',
      threadId: 'thread-1',
      internalDate: '1700000000000',
      payload: { headers: [{ name: 'Subject', value: 'Hello' }] },
    });
  });

  it('一部messageの取得が失敗(404等)しても、成功分だけを返し全体を失敗させない', async () => {
    mockFetchWithParts([
      { status: 200, json: { id: 'msg-1', internalDate: '1700000000000' } },
      { status: 404, json: { error: { code: 404, message: 'Requested entity was not found.' } } },
      { status: 200, json: { id: 'msg-3', internalDate: '1700000002000' } },
    ]);

    const results = await getMessagesBatch(fakeAuth(), ['msg-1', 'msg-2', 'msg-3']);
    expect(results.map((m) => m.id)).toEqual(['msg-1', 'msg-3']);
  });

  it('1バッチの上限を超えるidは複数のバッチHTTPリクエストに分割される', async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `msg-${i}`);
    const fetchMock = mockFetchWithParts([{ status: 200, json: { id: 'placeholder' } }]);

    await getMessagesBatch(fakeAuth(), ids);

    // 25件 / 10件(1バッチの上限) = 3バッチ必要(10+10+5)
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('idが空配列の場合はHTTPリクエストを発行せず空配列を返す', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const results = await getMessagesBatch(fakeAuth(), []);

    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('バッチHTTPリクエスト自体が失敗した場合は例外を投げる(個別失敗と区別する)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' }),
    );

    await expect(getMessagesBatch(fakeAuth(), ['msg-1'])).rejects.toThrow(/Gmail batch request failed/);
  });
});
