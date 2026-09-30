"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { seedDemoAction } from "@/app/actions";

type Thread = {
  id: string;
  kind: "dm" | "comment";
  channel: "instagram" | "facebook";
  participantUsername: string | null;
  participantName: string | null;
  mediaCaption: string | null;
  mediaPermalink: string | null;
  status: "open" | "done" | "archived";
  unread: boolean;
  intent: string | null;
  needsAttention: boolean;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  isDemo: boolean;
};

type Draft = { id: string; text: string; confidence: string | null; rationale: string | null; model: string };
type Item = { thread: Thread; draft: Draft | null };
type Message = { id: string; direction: "inbound" | "outbound"; text: string; authorName: string | null; sentAt: string; attachments: { type: string; url?: string }[] };
type Detail = {
  thread: Thread;
  account: { igUsername: string | null; pageName: string } | null;
  messages: Message[];
  draft: Draft | null;
  window: "standard" | "human_agent" | "closed" | null;
};

type Filter = "open" | "attention" | "done" | "archived";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "To reply" },
  { key: "attention", label: "Needs attention" },
  { key: "done", label: "Replied" },
  { key: "archived", label: "Archived" },
];

const INTENT_STYLE: Record<string, string> = {
  lead: "bg-emerald-100 text-emerald-800",
  question: "bg-sky-100 text-sky-800",
  complaint: "bg-red-100 text-red-800",
  support: "bg-amber-100 text-amber-800",
  praise: "bg-pink-100 text-pink-800",
  spam: "bg-zinc-200 text-zinc-600",
  other: "bg-zinc-100 text-zinc-600",
};

/** IG users have @handles; Facebook users only have display names. */
function displayName(t: Pick<Thread, "participantUsername" | "participantName">) {
  if (t.participantUsername) return `@${t.participantUsername}`;
  return t.participantName ?? "Unknown";
}

function ChannelBadge({ channel }: { channel: Thread["channel"] }) {
  return channel === "facebook" ? (
    <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-[#1877F2] text-[9px] font-bold text-white" title="Facebook">f</span>
  ) : (
    <span
      className="grid h-4 w-4 shrink-0 place-items-center rounded bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 text-[9px] font-bold text-white"
      title="Instagram"
    >
      ◎
    </span>
  );
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export function InboxView({
  initialItems,
  hasConnection,
  hasBrokenConnection,
}: {
  initialItems: Item[];
  hasConnection: boolean;
  hasBrokenConnection: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("open");
  const [items, setItems] = useState<Item[]>(initialItems);
  const [selectedId, setSelectedId] = useState<string | null>(initialItems[0]?.thread.id ?? null);

  const load = useCallback(async (f: Filter) => {
    const { items } = await api<{ items: Item[] }>(`/api/inbox/list?filter=${f}`);
    setItems(items);
    return items;
  }, []);

  // Light polling so new webhook-delivered messages show up without a refresh.
  useEffect(() => {
    const t = setInterval(() => load(filter).catch(() => undefined), 15_000);
    return () => clearInterval(t);
  }, [filter, load]);

  const changeFilter = async (f: Filter) => {
    setFilter(f);
    const next = await load(f);
    setSelectedId(next[0]?.thread.id ?? null);
  };

  const onDone = async () => {
    const idx = items.findIndex((i) => i.thread.id === selectedId);
    const next = await load(filter);
    setSelectedId(next[Math.min(idx, next.length - 1)]?.thread.id ?? null);
  };

  const isEmpty = items.length === 0;

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* List */}
      <section className={`flex w-full flex-col border-r border-zinc-200 bg-white md:w-96 ${selectedId ? "hidden md:flex" : "flex"}`}>
        <div className="border-b border-zinc-200 p-3">
          <h1 className="px-1 text-lg font-semibold">Inbox</h1>
          <div className="mt-2 flex gap-1 overflow-x-auto text-xs">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => changeFilter(f.key)}
                className={`whitespace-nowrap rounded-full px-3 py-1 ${filter === f.key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {hasBrokenConnection && (
          <Link href="/app/settings/connections" className="block bg-amber-50 px-4 py-2 text-xs text-amber-800">
            An Instagram connection needs attention — reconnect →
          </Link>
        )}
        <ul className="flex-1 overflow-y-auto">
          {items.map(({ thread: t, draft }) => (
            <li key={t.id}>
              <button
                onClick={() => {
                  setSelectedId(t.id);
                  setItems((xs) => xs.map((x) => (x.thread.id === t.id ? { ...x, thread: { ...x.thread, unread: false } } : x)));
                }}
                className={`w-full border-b border-zinc-100 px-4 py-3 text-left hover:bg-zinc-50 ${selectedId === t.id ? "bg-brand-50" : ""}`}
              >
                <div className="flex items-center gap-2">
                  {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                  <ChannelBadge channel={t.channel} />
                  <span className="truncate font-medium">{displayName(t)}</span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500">
                    {t.kind === "dm" ? "DM" : "Comment"}
                  </span>
                  {t.isDemo && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">sample</span>}
                  <span className="ml-auto shrink-0 text-xs text-zinc-400">{timeAgo(t.lastMessageAt)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{t.lastMessagePreview}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {t.intent && <span className={`rounded px-1.5 py-0.5 text-[10px] ${INTENT_STYLE[t.intent] ?? ""}`}>{t.intent}</span>}
                  {t.needsAttention && <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] text-white">needs attention</span>}
                  {draft && <span className="text-[11px] text-brand-600">✦ draft ready</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
        {isEmpty && (
          <div className="flex-1 p-6 text-center text-sm text-zinc-500">
            {filter === "open" ? (
              <>
                <p className="font-medium text-zinc-700">You&apos;re all caught up 🎉</p>
                {!hasConnection && (
                  <div className="mt-4 space-y-3">
                    <Link href="/app/settings/connections" className="block rounded-lg bg-brand-600 px-4 py-2 font-medium text-white">
                      Connect Instagram
                    </Link>
                    <form action={seedDemoAction}>
                      <button className="w-full rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-50">
                        Load sample conversations
                      </button>
                    </form>
                  </div>
                )}
              </>
            ) : (
              <p>Nothing here.</p>
            )}
          </div>
        )}
      </section>

      {/* Detail */}
      <section className={`min-w-0 flex-1 flex-col ${selectedId ? "flex" : "hidden md:flex"}`}>
        {selectedId ? (
          <ThreadPane key={selectedId} threadId={selectedId} onBack={() => setSelectedId(null)} onDone={onDone} />
        ) : (
          <div className="m-auto text-sm text-zinc-400">Select a conversation</div>
        )}
      </section>
    </div>
  );
}

function ThreadPane({ threadId, onBack, onDone }: { threadId: string; onBack: () => void; onDone: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "send" | "regen" | "moderate" | "status">(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"public" | "private">("public");

  useEffect(() => {
    api<Detail>(`/api/inbox/${threadId}/detail`)
      .then((d) => {
        setDetail(d);
        setText(d.draft?.text ?? "");
      })
      .catch((e) => setError(e.message));
  }, [threadId]);

  const t = detail?.thread;
  const edited = useMemo(() => Boolean(detail?.draft && text.trim() !== detail.draft.text.trim()), [detail, text]);

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const send = () =>
    run("send", async () => {
      await api(`/api/inbox/${threadId}/send`, {
        method: "POST",
        body: JSON.stringify({ text, draftId: detail?.draft?.id, mode, approved: true }),
      });
      onDone();
    });

  const regenerate = () =>
    run("regen", async () => {
      const { draft } = await api<{ draft: Draft | null }>(`/api/inbox/${threadId}/draft`, { method: "POST" });
      setDetail((d) => (d ? { ...d, draft } : d));
      setText(draft?.text ?? "");
    });

  const moderate = (action: "hide" | "delete") =>
    run("moderate", async () => {
      if (action === "delete" && !confirm("Delete this comment from Instagram? This can't be undone.")) return;
      await api(`/api/inbox/${threadId}/moderate`, { method: "POST", body: JSON.stringify({ action }) });
      onDone();
    });

  const setStatus = (status: "done" | "archived" | "open") =>
    run("status", async () => {
      await api(`/api/inbox/${threadId}/status`, { method: "POST", body: JSON.stringify({ status }) });
      onDone();
    });

  if (!detail || !t) {
    return <div className="m-auto text-sm text-zinc-400">{error ?? "Loading…"}</div>;
  }

  const windowClosed = detail.window === "closed";

  return (
    <>
      <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3">
        <button onClick={onBack} className="text-sm text-brand-600 md:hidden">← Back</button>
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {displayName(t)}
            {t.participantUsername && t.participantName && <span className="ml-2 font-normal text-zinc-500">{t.participantName}</span>}
          </p>
          <p className="text-xs text-zinc-500">
            {t.channel === "facebook"
              ? t.kind === "dm" ? "Facebook Messenger message" : "Facebook comment"
              : t.kind === "dm" ? "Instagram direct message" : "Instagram comment"}
            {t.channel === "facebook"
              ? detail.account?.pageName && ` · to ${detail.account.pageName}`
              : detail.account?.igUsername && ` · to @${detail.account.igUsername}`}
            {t.isDemo && " · sample data (replies are not actually sent)"}
          </p>
        </div>
        <div className="ml-auto flex gap-2 text-xs">
          {t.status === "open" ? (
            <button onClick={() => setStatus("done")} disabled={!!busy} className="rounded-lg border border-zinc-300 px-2.5 py-1.5 hover:bg-zinc-50">
              Mark done
            </button>
          ) : (
            <button onClick={() => setStatus("open")} disabled={!!busy} className="rounded-lg border border-zinc-300 px-2.5 py-1.5 hover:bg-zinc-50">
              Reopen
            </button>
          )}
          {t.kind === "comment" && (
            <>
              <button onClick={() => moderate("hide")} disabled={!!busy} className="rounded-lg border border-zinc-300 px-2.5 py-1.5 hover:bg-zinc-50">
                Hide
              </button>
              <button onClick={() => moderate("delete")} disabled={!!busy} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-red-700 hover:bg-red-50">
                Delete
              </button>
            </>
          )}
        </div>
      </header>

      {t.kind === "comment" && t.mediaCaption && (
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-600">
          On post: <span className="italic">&ldquo;{t.mediaCaption.slice(0, 140)}&rdquo;</span>
          {t.mediaPermalink && (
            <a href={t.mediaPermalink} target="_blank" rel="noreferrer" className="ml-2 text-brand-600">View post ↗</a>
          )}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-4">
        {detail.messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${m.direction === "outbound" ? "bg-brand-600 text-white" : "border border-zinc-200 bg-white"}`}
            >
              {t.kind === "comment" && m.authorName && (
                <p className={`mb-0.5 text-[11px] ${m.direction === "outbound" ? "text-brand-100" : "text-zinc-500"}`}>@{m.authorName}</p>
              )}
              <p className="whitespace-pre-wrap">{m.text || (m.attachments.length ? `[${m.attachments[0]!.type}]` : "")}</p>
              <p className={`mt-1 text-[10px] ${m.direction === "outbound" ? "text-brand-100" : "text-zinc-400"}`}>
                {new Date(m.sentAt).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Composer: AI draft pre-filled, human approves */}
      <div className="border-t border-zinc-200 bg-white p-4">
        {detail.draft && (
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="rounded bg-brand-50 px-1.5 py-0.5 font-medium text-brand-700">✦ AI draft</span>
            {detail.draft.confidence && <span>confidence: {detail.draft.confidence}</span>}
            {detail.draft.rationale && <span className="truncate">· {detail.draft.rationale}</span>}
            {edited && <span className="text-amber-700">· edited</span>}
          </div>
        )}
        {t.needsAttention && (
          <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
            Flagged for attention — read carefully before replying.
          </p>
        )}
        {detail.window === "human_agent" && (
          <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            It&apos;s been over 24 hours since this person messaged. Your reply will be sent as a human-agent response
            (allowed up to 7 days).
          </p>
        )}
        {windowClosed && (
          <p className="mb-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
            Meta only allows replies within 7 days of the customer&apos;s last message.
          </p>
        )}
        {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder={busy === "regen" ? "Drafting…" : "Write a reply…"}
          className="w-full resize-y rounded-xl border border-zinc-300 p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {t.kind === "comment" && (
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "public" | "private")}
              className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
            >
              <option value="public">Reply publicly</option>
              <option value="private">Reply privately (DM)</option>
            </select>
          )}
          <button
            onClick={regenerate}
            disabled={!!busy}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            {busy === "regen" ? "Drafting…" : "↻ New draft"}
          </button>
          <span className="ml-auto text-xs text-zinc-400">{text.length}/1000</span>
          <button
            onClick={send}
            disabled={!!busy || !text.trim() || windowClosed}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy === "send" ? "Sending…" : "Approve & send"}
          </button>
        </div>
      </div>
    </>
  );
}
