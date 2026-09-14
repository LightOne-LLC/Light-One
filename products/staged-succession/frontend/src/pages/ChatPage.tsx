import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Message } from '../types';

interface MessageRow {
  id: string;
  match_id: string;
  sender_id: string;
  sender_role: Message['senderRole'];
  body: string;
  created_at: string;
}

function rowToMessage(r: MessageRow): Message {
  return { id: r.id, matchId: r.match_id, senderId: r.sender_id, senderRole: r.sender_role, body: r.body, createdAt: r.created_at };
}

function formatTime(createdAt: unknown): string {
  if (typeof createdAt === 'string') return new Date(createdAt).toLocaleString('ja-JP');
  return '送信中...';
}

export function ChatPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!matchId) return;

    let cancelled = false;
    setLoading(true);
    supabase
      .from('messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        if (data) setMessages((data as MessageRow[]).map(rowToMessage));
        setLoading(false);
      });

    // Realtime subscription — Supabase streams Postgres row changes over a
    // websocket it manages internally, so no manual polling is needed.
    const channel = supabase
      .channel(`messages:${matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        (payload) => {
          setMessages((prev) => [...prev, rowToMessage(payload.new as MessageRow)]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() || !user || !matchId || sending) return;
    setError(null);
    setSending(true);
    try {
      await api.sendMessage(matchId, body.trim());
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-5" style={{ minHeight: 'calc(100dvh - 3.5rem)' }}>
        <div className="animate-noren-rise mb-3 flex items-start justify-between gap-2">
          <h1 className="font-mincho truncate text-[17px] font-semibold text-foreground" title={matchId}>
            メッセージ
          </h1>
          <Link
            to={`/matches/${matchId}/phase`}
            className="font-jp shrink-0 text-[12px] text-muted-foreground underline-offset-4 hover:text-accent hover:underline"
          >
            フェーズ管理へ
          </Link>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-card">
          {loading ? (
            <p className="font-jp text-[13px] text-muted-foreground">読み込み中...</p>
          ) : (
            <>
              {messages.map((m) => {
                const mine = m.senderId === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`font-jp max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[13.5px] ${
                        mine ? 'bg-accent text-accent-foreground' : 'bg-surface-secondary text-foreground'
                      }`}
                    >
                      <p>{m.body}</p>
                      <p className={`mt-1 text-[10px] ${mine ? 'text-accent-foreground/70' : 'text-muted-foreground'}`}>
                        {formatTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && <p className="font-jp text-[13px] text-muted-foreground">まだメッセージはありません。</p>}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p className="font-jp mt-1.5 text-[12px] text-danger">{error}</p>}

        <form onSubmit={handleSend} className="mt-3 flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="メッセージを入力..."
            disabled={sending}
            className="font-jp flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-[13.5px] text-foreground outline-none transition-colors focus:border-accent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="font-jp rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-accent-foreground shadow-card transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? '送信中...' : '送信'}
          </button>
        </form>
      </div>
    </div>
  );
}
