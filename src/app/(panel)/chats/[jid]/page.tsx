import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/dal";
import { resolvePeople, sendableJid, withContacts, type Person } from "@/lib/chats";
import { dayKey, formatDayLabel, formatTime } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { AutoRefresh } from "@/components/auto-refresh";
import { ChatComposer, DiscardButton } from "@/components/chat-composer";

const KIND_LABEL: Record<string, string> = {
  image: "📷 Foto",
  video: "🎥 Video",
  audio: "🎤 Audio",
  document: "📄 Documento",
  sticker: "Sticker",
  location: "📍 Ubicación",
  contact: "👤 Contacto",
  poll: "📊 Encuesta",
  other: "Mensaje no compatible",
};

const LIMIT = 300;

/** Como WhatsApp: nombre de la agenda; si no, "+número ~nombre de perfil" */
function senderLabel(person: Person | undefined, pushName: string | null) {
  const profile = person?.notify ?? pushName;
  if (person?.name) return { main: person.name, extra: null };
  if (person?.phone) return { main: `+${person.phone}`, extra: profile ? `~${profile}` : null };
  if (profile) return { main: `~${profile}`, extra: null };
  return null;
}

function senderHue(key: string) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export default async function ChatPage({ params }: PageProps<"/chats/[jid]">) {
  await requireSession();
  const jid = decodeURIComponent((await params).jid);

  const row = await db.waChat.findUnique({ where: { jid } });
  if (!row) notFound();
  const [chat] = await withContacts([row]);

  const [latest, total, pending] = await Promise.all([
    db.waMessage.findMany({ where: { chatJid: jid }, orderBy: { timestamp: "desc" }, take: LIMIT }),
    db.waMessage.count({ where: { chatJid: jid } }),
    // Mensajes escritos aquí que el worker todavía no envía
    db.scheduledMessage.findMany({
      where: { to: jid, type: "now", OR: [{ active: true }, { lastError: { not: null } }] },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const messages = latest.reverse();
  const people = chat.isGroup
    ? await resolvePeople(messages.flatMap((m) => (m.senderJid && !m.fromMe ? [m.senderJid] : [])))
    : new Map<string, Person>();

  const subtitle = chat.isGroup
    ? "Grupo"
    : chat.hasName
      ? (chat.phoneLabel ?? "")
      : chat.phoneLabel
        ? ""
        : "Número oculto por WhatsApp";

  return (
    <>
      <AutoRefresh intervalMs={5000} />

      <header className="flex items-center gap-3 border-b border-border bg-surface px-3 py-2.5">
        <Link href="/chats" className="rounded-full p-1.5 text-muted hover:bg-surface-2 md:hidden" aria-label="Volver">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <Avatar name={chat.displayName} group={chat.isGroup} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-medium">{chat.displayName}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        <Link
          href={{ pathname: "/mensajes/nuevo", query: { to: sendableJid(chat), label: chat.displayName } }}
          className="btn-ghost px-3 py-1.5 text-xs"
          title="Programar un mensaje para este chat"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
          <span className="hidden sm:inline">Programar</span>
        </Link>
      </header>

      {/* flex-col-reverse: el scroll arranca abajo, en el mensaje más reciente */}
      <div className="flex flex-1 flex-col-reverse overflow-y-auto bg-chat-bg px-3 py-4 sm:px-[6%]">
        <div className="flex flex-col gap-1">
          {total > LIMIT && (
            <p className="mx-auto mb-2 rounded-lg bg-surface/80 px-3 py-1 text-xs text-muted">
              Mostrando los últimos {LIMIT} de {total.toLocaleString("es-BO")} mensajes
            </p>
          )}
          {messages.length === 0 && pending.length === 0 && (
            <p className="mx-auto rounded-lg bg-surface/80 px-3 py-1.5 text-center text-xs text-muted">
              No hay mensajes guardados de este chat.
            </p>
          )}

          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || dayKey(prev.timestamp) !== dayKey(m.timestamp);
            const senderKey = m.senderJid ?? m.senderName;
            const sameSender =
              prev && !newDay && prev.fromMe === m.fromMe && (prev.senderJid ?? prev.senderName) === senderKey;
            const sender =
              chat.isGroup && !m.fromMe && !sameSender
                ? senderLabel(m.senderJid ? people.get(m.senderJid) : undefined, m.senderName)
                : null;
            return (
              <div key={m.id}>
                {newDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-lg bg-surface px-3 py-1 text-xs text-muted shadow-sm">
                      {formatDayLabel(m.timestamp)}
                    </span>
                  </div>
                )}
                <div className={`flex ${m.fromMe ? "justify-end" : "justify-start"} ${sameSender ? "" : "mt-1.5"}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm sm:max-w-[65%] ${
                      m.fromMe ? "bg-bubble-out" : "bg-bubble-in"
                    }`}
                  >
                    {sender && (
                      <p className="mb-0.5 flex items-baseline gap-2 text-xs">
                        <span
                          className="truncate font-medium"
                          style={{ color: `hsl(${senderHue(senderKey ?? "")} 65% var(--sender-l))` }}
                        >
                          {sender.main}
                        </span>
                        {sender.extra && <span className="truncate text-muted">{sender.extra}</span>}
                      </p>
                    )}
                    {m.kind !== "text" && <p className="text-xs text-muted">{KIND_LABEL[m.kind] ?? "Mensaje"}</p>}
                    <p className="whitespace-pre-wrap break-words">
                      {m.text}
                      <span className="float-right mt-1.5 ml-3 text-[11px] leading-none text-muted">
                        {formatTime(m.timestamp)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {pending.map((p) => (
            <div key={p.id} className="mt-1.5 flex justify-end">
              <div className="max-w-[85%] rounded-lg bg-bubble-out px-2.5 py-1.5 text-sm shadow-sm sm:max-w-[65%]">
                <p className={`whitespace-pre-wrap break-words ${p.lastError ? "" : "opacity-70"}`}>
                  {p.text}
                  <span className="float-right mt-1.5 ml-3 text-[11px] leading-none text-muted" title="Enviando…">
                    {p.lastError ? "" : "🕓"}
                  </span>
                </p>
                {p.lastError && (
                  <p className="mt-1 flex items-center justify-between gap-3 text-xs text-danger">
                    <span>No se envió: {p.lastError}</span>
                    <DiscardButton id={p.id} />
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ChatComposer jid={chat.jid} label={chat.displayName} />
    </>
  );
}
