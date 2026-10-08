import type { Prisma, PrismaClient } from "@prisma/client";
import {
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isJidStatusBroadcast,
  isLidUser,
  jidNormalizedUser,
  normalizeMessageContent,
  toNumber,
  type Chat,
  type ChatUpdate,
  type Contact,
  type LIDMapping,
  type WAMessage,
  type WASocket,
} from "baileys";

// Guarda en la base de datos los chats, contactos y mensajes que manda WhatsApp,
// tanto el historial inicial (al vincular) como lo que llega después.

// Transacciones cortas: SQLite permite un solo escritor y el panel también escribe
const CHUNK = 150;

type Op = Prisma.PrismaPromise<unknown>;

function ignoredJid(jid: string | null | undefined): boolean {
  return !jid || isJidStatusBroadcast(jid) || isJidNewsletter(jid) || (isJidBroadcast(jid) ?? false);
}

const digits = (jid?: string | null) => (jid && !isLidUser(jid) ? jid.split("@")[0].split(":")[0] : null);

function tsToDate(t: unknown): Date | null {
  const n = toNumber(t as number);
  return n ? new Date(n * 1000) : null;
}

/** Texto y tipo de un mensaje. null = no vale la pena guardarlo (reacciones, sistema...) */
export function describeMessage(msg: WAMessage): { kind: string; text: string | null } | null {
  const c = normalizeMessageContent(msg.message);
  if (!c) return null;
  if (c.conversation) return { kind: "text", text: c.conversation };
  if (c.extendedTextMessage) return { kind: "text", text: c.extendedTextMessage.text ?? null };
  if (c.imageMessage) return { kind: "image", text: c.imageMessage.caption ?? null };
  if (c.videoMessage) return { kind: "video", text: c.videoMessage.caption ?? null };
  if (c.audioMessage) return { kind: "audio", text: null };
  if (c.documentMessage) return { kind: "document", text: c.documentMessage.fileName ?? c.documentMessage.caption ?? null };
  if (c.documentWithCaptionMessage) return { kind: "document", text: null };
  if (c.stickerMessage) return { kind: "sticker", text: null };
  if (c.locationMessage || c.liveLocationMessage) return { kind: "location", text: c.locationMessage?.name ?? null };
  if (c.contactMessage || c.contactsArrayMessage) return { kind: "contact", text: c.contactMessage?.displayName ?? null };
  const poll = c.pollCreationMessage || c.pollCreationMessageV2 || c.pollCreationMessageV3;
  if (poll) return { kind: "poll", text: poll.name ?? null };
  if (c.reactionMessage || c.protocolMessage || c.senderKeyDistributionMessage) return null;
  return { kind: "other", text: null };
}

/** Quién envió el mensaje: el participante en grupos, el chat en conversaciones 1 a 1 */
function senderOf(m: WAMessage): string | null {
  const remote = m.key.remoteJid;
  const raw = remote && isJidGroup(remote) ? (m.key.participant ?? m.participant) : remote;
  return raw ? jidNormalizedUser(raw) : null;
}

export function previewText(kind: string, text: string | null): string {
  const labels: Record<string, string> = {
    image: "📷 Foto", video: "🎥 Video", audio: "🎤 Audio", document: "📄 Documento",
    sticker: "Sticker", location: "📍 Ubicación", contact: "👤 Contacto", poll: "📊 Encuesta", other: "Mensaje",
  };
  if (kind === "text") return text ?? "";
  return text ? `${labels[kind]}: ${text}` : labels[kind] ?? "Mensaje";
}

export function createHistoryStore(db: PrismaClient, log: (...a: unknown[]) => void) {
  async function runChunks<T>(items: T[], toOp: (item: T) => Op | null) {
    const ops = items.map(toOp).filter((o): o is Op => o !== null);
    for (let i = 0; i < ops.length; i += CHUNK) {
      await db.$transaction(ops.slice(i, i + CHUNK));
    }
  }

  async function saveContacts(contacts: Partial<Contact>[]) {
    await runChunks(contacts, (c) => {
      if (!c.id || ignoredJid(c.id)) return null;
      const id = jidNormalizedUser(c.id);
      const phone = digits(c.phoneNumber) ?? digits(id);
      const data = {
        ...(c.lid !== undefined ? { lid: c.lid } : {}),
        ...(phone ? { phone } : {}),
        ...(c.name ? { name: c.name } : {}),
        ...(c.notify ? { notify: c.notify } : {}),
      };
      return db.waContact.upsert({ where: { jid: id }, create: { jid: id, ...data }, update: data });
    });
    // Contactos de la agenda que traen su @lid: guardar también la relación lid -> número
    const mappings = contacts
      .filter((c) => c.lid && isLidUser(c.lid) && (c.phoneNumber || (c.id && !isLidUser(c.id))))
      .map((c) => ({ lid: c.lid!, pn: c.phoneNumber ?? c.id! }));
    if (mappings.length) await saveLidMappings(mappings);
    const named = contacts.filter((c) => c.name).length;
    if (named) log(`Agenda: ${named} contactos con nombre recibidos`);
  }

  async function saveLidMappings(mappings: LIDMapping[]) {
    const pairs = mappings
      .map((m) => ({ lid: jidNormalizedUser(m.lid), phone: digits(m.pn) }))
      .filter((p): p is { lid: string; phone: string } => Boolean(p.phone));
    await runChunks(pairs, ({ lid, phone }) =>
      db.waContact.upsert({ where: { jid: lid }, create: { jid: lid, lid, phone }, update: { phone } }),
    );
    // El chat @lid hereda el número, así se puede cruzar con el nombre de la agenda
    await runChunks(pairs, ({ lid, phone }) =>
      db.waChat.updateMany({ where: { jid: lid, phone: null }, data: { phone } }),
    );
  }

  async function saveChats(chats: (Chat | ChatUpdate)[]) {
    await runChunks(chats, (c) => {
      if (!c.id || ignoredJid(c.id)) return null;
      const jid = jidNormalizedUser(c.id);
      const isGroup = isJidGroup(jid) ?? false;
      const phone = digits(c.pnJid) ?? (isGroup ? null : digits(jid));
      const lastMessageAt = tsToDate(c.conversationTimestamp ?? c.lastMsgTimestamp);
      const name = c.name || c.displayName || null;
      const data = {
        isGroup,
        ...(name ? { name } : {}),
        ...(phone ? { phone } : {}),
        ...(c.archived != null ? { archived: c.archived } : {}),
        ...(c.unreadCount != null ? { unreadCount: Math.max(0, c.unreadCount) } : {}),
        ...(lastMessageAt ? { lastMessageAt } : {}),
      };
      return db.waChat.upsert({ where: { jid }, create: { jid, ...data }, update: data });
    });
  }

  async function saveMessages(messages: WAMessage[], updateChats: boolean) {
    const rows: {
      id: string; chatJid: string; fromMe: boolean; senderJid: string | null; senderName: string | null;
      kind: string; text: string | null; timestamp: Date;
    }[] = [];

    for (const m of messages) {
      const chatJid = m.key.remoteJid ? jidNormalizedUser(m.key.remoteJid) : null;
      if (!chatJid || ignoredJid(chatJid) || !m.key.id) continue;
      const desc = describeMessage(m);
      if (!desc) continue;
      rows.push({
        id: `${chatJid}:${m.key.id}`,
        chatJid,
        fromMe: Boolean(m.key.fromMe),
        senderJid: m.key.fromMe ? null : senderOf(m),
        senderName: m.key.fromMe ? null : m.pushName ?? null,
        kind: desc.kind,
        text: desc.text,
        timestamp: tsToDate(m.messageTimestamp) ?? new Date(),
      });
    }

    await runChunks(rows, (r) =>
      db.waMessage.upsert({
        where: { id: r.id },
        create: r,
        // Si el mensaje ya existía (p. ej. al re-vincular), completar quién lo envió
        update: {
          ...(r.senderJid ? { senderJid: r.senderJid } : {}),
          ...(r.senderName ? { senderName: r.senderName } : {}),
        },
      }),
    );

    if (!updateChats) return rows.length;

    // Último mensaje por chat para la vista previa de la lista
    const latest = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const cur = latest.get(r.chatJid);
      if (!cur || r.timestamp > cur.timestamp) latest.set(r.chatJid, r);
    }
    for (const r of latest.values()) {
      const chat = await db.waChat.findUnique({
        where: { jid: r.chatJid },
        select: { lastMessageAt: true, lastMessageText: true },
      });
      const newer = !chat?.lastMessageAt || r.timestamp >= chat.lastMessageAt;
      // Llegó un trozo de historial más viejo que lo que ya mostramos: no pisar la vista previa
      if (!newer && chat?.lastMessageText) continue;
      const data = {
        lastMessageText: (r.fromMe ? "Tú: " : "") + previewText(r.kind, r.text).slice(0, 200),
        ...(newer ? { lastMessageAt: r.timestamp } : {}),
      };
      await db.waChat.upsert({
        where: { jid: r.chatJid },
        create: { jid: r.chatJid, isGroup: isJidGroup(r.chatJid) ?? false, phone: isJidGroup(r.chatJid) ? null : digits(r.chatJid), ...data },
        update: data,
      });
    }

    // Nombre de perfil (pushName) de quien escribe: en grupos es el participante
    const pushNames = new Map<string, string>();
    for (const m of messages) {
      const sender = m.key.fromMe ? null : senderOf(m);
      if (sender && m.pushName && !ignoredJid(sender)) pushNames.set(sender, m.pushName);
      // En v7 el participante viene como @lid y a veces trae su número aparte
      const alt = m.key.participantAlt ?? m.key.remoteJidAlt;
      if (sender && alt && isLidUser(sender) && !isLidUser(alt)) {
        await saveLidMappings([{ lid: sender, pn: alt }]);
      }
    }
    for (const [jid, notify] of pushNames) {
      await db.waContact.upsert({
        where: { jid },
        create: { jid, notify, phone: digits(jid) },
        update: { notify },
      });
    }
    return rows.length;
  }

  // WhatsApp manda el historial en muchos bloques casi a la vez. Si se guardan en paralelo,
  // SQLite se queda bloqueado (P1008 "Socket timeout"). Todo pasa por esta fila, de a uno.
  let queue: Promise<unknown> = Promise.resolve();
  function enqueue(label: string, task: () => Promise<unknown>) {
    queue = queue.then(task).catch((e) => log(`Error guardando ${label}:`, e instanceof Error ? e.message : e));
  }

  function attach(sock: WASocket, onProgress: (p: number | null) => Promise<void>) {
    sock.ev.on("messaging-history.set", ({ chats, contacts, messages, lidPnMappings, progress, isLatest }) =>
      enqueue("historial", async () => {
        await saveContacts(contacts);
        if (lidPnMappings?.length) await saveLidMappings(lidPnMappings);
        await saveChats(chats);
        const n = await saveMessages(messages, true);
        log(`Historial: ${chats.length} chats, ${contacts.length} contactos, ${n} mensajes (${progress ?? "?"}%)`);
        await onProgress(isLatest || progress === 100 ? null : progress ?? null);
      }),
    );

    sock.ev.on("chats.upsert", (chats) => enqueue("chats", () => saveChats(chats)));
    sock.ev.on("chats.update", (chats) => enqueue("chats", () => saveChats(chats)));
    sock.ev.on("contacts.upsert", (c) => enqueue("contactos", () => saveContacts(c)));
    sock.ev.on("contacts.update", (c) => enqueue("contactos", () => saveContacts(c)));
    sock.ev.on("lid-mapping.update", (m) => enqueue("lid", () => saveLidMappings([m])));
    sock.ev.on("messages.upsert", ({ messages }) => enqueue("mensajes", () => saveMessages(messages, true)));
  }

  return { attach };
}
