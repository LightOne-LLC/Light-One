import { toRawEmail, type GmailApiMessage } from '../parseMessage';

function b64(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64url');
}

describe('toRawEmail', () => {
  it('metadataを正しく変換できる', () => {
    const message: GmailApiMessage = {
      id: 'msg-1',
      threadId: 'thread-1',
      payload: {
        headers: [
          { name: 'From', value: 'agency@example.test' },
          { name: 'Subject', value: 'テスト件名' },
          { name: 'Date', value: '2026-09-13' },
        ],
        mimeType: 'text/plain',
        body: { data: b64('本文テスト') },
      },
    };

    const raw = toRawEmail(message);
    expect(raw.id).toBe('msg-1');
    expect(raw.threadId).toBe('thread-1');
    expect(raw.from).toBe('agency@example.test');
    expect(raw.subject).toBe('テスト件名');
    expect(raw.date).toBe('2026-09-13');
    expect(raw.bodyText).toBe('本文テスト');
  });

  it('text/plainのbodyを安全に扱える(シンプルな単一パート)', () => {
    const message: GmailApiMessage = {
      id: 'msg-2',
      payload: { mimeType: 'text/plain', body: { data: b64('プレーン本文') } },
    };
    expect(toRawEmail(message).bodyText).toBe('プレーン本文');
  });

  it('multipart/alternativeでtext/plainパートを優先する', () => {
    const message: GmailApiMessage = {
      id: 'msg-3',
      payload: {
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/plain', body: { data: b64('プレーン優先') } },
          { mimeType: 'text/html', body: { data: b64('<p>HTML版</p>') } },
        ],
      },
    };
    expect(toRawEmail(message).bodyText).toBe('プレーン優先');
  });

  it('text/plainが無ければtext/htmlをタグ除去して使う', () => {
    const message: GmailApiMessage = {
      id: 'msg-4',
      payload: {
        mimeType: 'multipart/alternative',
        parts: [{ mimeType: 'text/html', body: { data: b64('<p>HTMLのみ<br>本文</p>') } }],
      },
    };
    expect(toRawEmail(message).bodyText).toBe('HTMLのみ 本文');
  });

  it('ヘッダーやbodyが無い異常なメッセージでもクラッシュしない', () => {
    expect(() => toRawEmail({})).not.toThrow();
    const raw = toRawEmail({});
    expect(raw.id).toBe('');
    expect(raw.bodyText).toBe('');
  });
});
