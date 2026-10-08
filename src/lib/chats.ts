import "server-only";
import type { Prisma, WaChat, WaContact } from "@prisma/client";
import { db } from "./db";
import { formatListTime } from "./format";

export type ChatView = WaChat & { displayName: string; phoneLabel: string | null; hasName: boolean };

const pnJid = (phone: string) => `${phone}@s.whatsapp.net`;

/**
 * Elige el mejor nombre para un chat. WhatsApp identifica muchos chats con un @lid
 * (ID interno) y la agenda con el número, así que se cruzan: chat @lid -> número -> contacto.
 */
function toChatView(chat: WaChat, candidates: (WaContact | undefined)[]): ChatView {
  const found = candidates.filter((c): c is WaContact => Boolean(c));
  const phone = chat.phone ?? found.find((c) => c.phone)?.phone ?? null;
  const phoneLabel = phone ? `+${phone}` : null;

  const name = chat.isGroup
    ? chat.name
    : found.find((c) => c.name)?.name || chat.name || found.find((c) => c.notify)?.notify;

  return {
    ...chat,
    phone,
    phoneLabel,
    hasName: Boolean(name),
    displayName: name || phoneLabel || (chat.isGroup ? "Grupo sin nombre" : "Número oculto"),
  };
}

export async function withContacts(chats: WaChat[]): Promise<ChatView[]> {
  const individual = chats.filter((c) => !c.isGroup);
  const jids = individual.map((c) => c.jid);
  const phones = individual.flatMap((c) => (c.phone ? [pnJid(c.phone)] : []));

  const contacts = jids.length
    ? await db.waContact.findMany({
        where: { OR: [{ jid: { in: [...jids, ...phones] } }, { lid: { in: jids } }] },
      })
    : [];

  const byJid = new Map(contacts.map((c) => [c.jid, c]));
  const byLid = new Map(contacts.filter((c) => c.lid).map((c) => [c.lid!, c]));

  // Si el contacto @lid trae número pero el chat no, buscar también ese contacto por número
  const extraPhones = contacts
    .filter((c) => c.jid.endsWith("@lid") && c.phone && !byJid.has(pnJid(c.phone)))
    .map((c) => pnJid(c.phone!));
  if (extraPhones.length) {
    for (const c of await db.waContact.findMany({ where: { jid: { in: extraPhones } } })) byJid.set(c.jid, c);
  }

  return chats.map((chat) => {
    if (chat.isGroup) return toChatView(chat, []);
    const own = byJid.get(chat.jid);
    const phone = chat.phone ?? own?.phone ?? byLid.get(chat.jid)?.phone;
    return toChatView(chat, [byLid.get(chat.jid), phone ? byJid.get(pnJid(phone)) : undefined, own]);
  });
}

export type Person = { name: string | null; notify: string | null; phone: string | null };

/**
 * Nombre de cada participante (para grupos). Mismo cruce que los chats:
 * @lid -> número -> contacto de la agenda.
 */
export async function resolvePeople(jids: string[]): Promise<Map<string, Person>> {
  const unique = [...new Set(jids)];
  const result = new Map<string, Person>();
  if (!unique.length) return result;

  const direct = await db.waContact.findMany({
    where: { OR: [{ jid: { in: unique } }, { lid: { in: unique } }] },
  });
  const byJid = new Map(direct.map((c) => [c.jid, c]));
  const byLid = new Map(direct.filter((c) => c.lid).map((c) => [c.lid!, c]));

  const phoneOf = (jid: string) =>
    byJid.get(jid)?.phone ?? byLid.get(jid)?.phone ?? (jid.endsWith("@s.whatsapp.net") ? jid.split("@")[0] : null);
  const phones = unique.map(phoneOf).filter((p): p is string => Boolean(p)).map(pnJid);
  const byPhone = new Map(
    (await db.waContact.findMany({ where: { jid: { in: phones } } })).map((c) => [c.jid, c]),
  );

  for (const jid of unique) {
    const phone = phoneOf(jid);
    const found = [byJid.get(jid), byLid.get(jid), phone ? byPhone.get(pnJid(phone)) : undefined].filter(
      (c): c is WaContact => Boolean(c),
    );
    result.set(jid, {
      name: found.find((c) => c.name)?.name ?? null,
      notify: found.find((c) => c.notify)?.notify ?? null,
      phone,
    });
  }
  return result;
}

/** JIDs de chats cuyo nombre (de la agenda, del chat o del perfil) o número coincide con `q`. */
export async function searchChatJids(q: string): Promise<{ jids: string[]; phones: string[] }> {
  const contacts = await db.waContact.findMany({
    where: { OR: [{ name: { contains: q } }, { notify: { contains: q } }, { phone: { contains: q } }] },
    select: { jid: true, lid: true, phone: true },
    take: 500,
  });
  const jids = new Set<string>();
  const phones = new Set<string>();
  for (const c of contacts) {
    jids.add(c.jid);
    if (c.lid) jids.add(c.lid);
    if (c.phone) phones.add(c.phone);
  }
  return { jids: [...jids], phones: [...phones] };
}

export type ChatListItem = {
  jid: string;
  displayName: string;
  isGroup: boolean;
  preview: string;
  time: string;
  unreadCount: number;
};

/** Lista para la barra lateral. Sin búsqueda, solo chats con mensajes (como WhatsApp). */
export async function listChats({ q = "", filter = "todos", take = 150 } = {}): Promise<ChatListItem[]> {
  const where: Prisma.WaChatWhereInput = {};
  if (filter === "grupos") where.isGroup = true;
  if (filter === "contactos") where.isGroup = false;
  if (filter === "no-leidos") where.unreadCount = { gt: 0 };

  if (q) {
    const { jids, phones } = await searchChatJids(q);
    where.OR = [{ name: { contains: q } }, { phone: { contains: q } }, { jid: { in: jids } }, { phone: { in: phones } }];
  } else {
    where.lastMessageAt = { not: null };
  }

  const rows = await db.waChat.findMany({
    where,
    orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }],
    take,
  });
  const views = await withContacts(rows);
  return views.map((c) => ({
    jid: c.jid,
    displayName: c.displayName,
    isGroup: c.isGroup,
    preview: c.lastMessageText ?? (c.hasName && c.phoneLabel ? c.phoneLabel : ""),
    time: formatListTime(c.lastMessageAt),
    unreadCount: c.unreadCount,
  }));
}

/** JID para enviar: si conocemos el número usamos ese, si no el @lid tal cual. */
export function sendableJid(chat: ChatView): string {
  if (chat.isGroup || chat.jid.endsWith("@s.whatsapp.net")) return chat.jid;
  return chat.phone ? pnJid(chat.phone) : chat.jid;
}

/** Grupos sincronizados + grupos que salieron del historial de chats */
export async function listGroups() {
  const [groups, chatGroups] = await Promise.all([
    db.waGroup.findMany(),
    db.waChat.findMany({ where: { isGroup: true }, select: { jid: true, name: true } }),
  ]);
  const map = new Map<string, string>();
  for (const g of chatGroups) map.set(g.jid, g.name ?? g.jid);
  for (const g of groups) map.set(g.jid, g.name);
  return [...map].map(([jid, name]) => ({ jid, name })).sort((a, b) => a.name.localeCompare(b.name));
}
