"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/dal";
import { computeNextRun, isValidCron, toJid } from "@/lib/schedule";

const schema = z.object({
  id: z.string().optional(),
  targetKind: z.enum(["contact", "group"]),
  phone: z.string().optional(),
  contactName: z.string().optional(),
  groupJid: z.string().optional(),
  text: z.string().trim().min(1, "Escribe el mensaje").max(4000, "Máximo 4000 caracteres"),
  type: z.enum(["once", "interval", "cron"]),
  sendAt: z.string().optional(), // ISO, convertido en el navegador
  intervalMinutes: z.coerce.number().int().optional(),
  cron: z.string().optional(),
});

export type SaveState = { error?: string } | undefined;

export async function saveMessage(_: SaveState, formData: FormData): Promise<SaveState> {
  await requireSession();

  const raw = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [k, v === "" ? undefined : v]),
  );
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  // Destino
  let to: string | null;
  let toLabel: string;
  if (d.targetKind === "group") {
    const group = d.groupJid
      ? ((await db.waGroup.findUnique({ where: { jid: d.groupJid } })) ??
        (await db.waChat.findFirst({ where: { jid: d.groupJid, isGroup: true } })))
      : null;
    if (!group) return { error: "Elige un grupo" };
    to = group.jid;
    toLabel = group.name ?? group.jid;
  } else {
    to = toJid(d.phone ?? "");
    if (!to) return { error: "Número inválido. Inclúyelo con lada del país, ej: 5215512345678" };
    toLabel = d.contactName?.trim() || `+${to.split("@")[0]}`;
  }

  // Horario
  const sendAt = d.sendAt ? new Date(d.sendAt) : null;
  if (sendAt && Number.isNaN(sendAt.getTime())) return { error: "Fecha inválida" };

  if (d.type === "once") {
    if (!sendAt) return { error: "Elige fecha y hora" };
    if (sendAt.getTime() < Date.now() - 60_000) return { error: "La fecha ya pasó" };
  }
  if (d.type === "interval" && (!d.intervalMinutes || d.intervalMinutes < 5)) {
    return { error: "El intervalo mínimo es de 5 minutos" };
  }
  if (d.type === "cron" && (!d.cron || !isValidCron(d.cron))) {
    return { error: "Elige al menos un día y una hora (o un cron válido)" };
  }

  const data = {
    to,
    toLabel,
    text: d.text,
    type: d.type,
    sendAt: d.type === "cron" ? null : sendAt,
    intervalMinutes: d.type === "interval" ? d.intervalMinutes! : null,
    cron: d.type === "cron" ? d.cron!.trim() : null,
  };
  const nextRunAt = computeNextRun(data);

  if (d.id) {
    await db.scheduledMessage.update({
      where: { id: d.id },
      data: { ...data, nextRunAt, active: true, lastError: null },
    });
  } else {
    await db.scheduledMessage.create({ data: { ...data, nextRunAt } });
  }

  revalidatePath("/");
  redirect("/");
}

export async function toggleMessage(id: string) {
  await requireSession();
  const msg = await db.scheduledMessage.findUnique({ where: { id } });
  if (!msg) return;

  if (msg.active) {
    await db.scheduledMessage.update({ where: { id }, data: { active: false } });
  } else {
    let nextRunAt = computeNextRun(msg);
    // Un mensaje de una sola vez cuya fecha ya pasó: al reactivarlo se envía ya
    if (msg.type === "once" && (!nextRunAt || nextRunAt < new Date())) nextRunAt = new Date();
    await db.scheduledMessage.update({ where: { id }, data: { active: true, nextRunAt } });
  }
  revalidatePath("/");
}

export async function sendNow(id: string) {
  await requireSession();
  // El worker lo toma en el próximo ciclo (≤15 s). Los recurrentes siguen su horario después.
  await db.scheduledMessage
    .update({ where: { id }, data: { active: true, nextRunAt: new Date() } })
    .catch(() => {});
  revalidatePath("/");
}

/** Enviar ya desde la vista de chat. El worker lo manda en ≤5 s y luego borra la fila. */
export async function sendChatMessage(jid: string, label: string, text: string) {
  await requireSession();
  const body = text.trim();
  if (!body) return { error: "Escribe un mensaje" };
  if (body.length > 4000) return { error: "Máximo 4000 caracteres" };
  if (!toJid(jid)) return { error: "Chat inválido" };

  await db.scheduledMessage.create({
    data: { to: jid, toLabel: label.slice(0, 120), text: body, type: "now", nextRunAt: new Date() },
  });
  revalidatePath(`/chats/${encodeURIComponent(jid)}`);
  return null;
}

export async function deleteMessage(id: string) {
  await requireSession();
  await db.scheduledMessage.delete({ where: { id } }).catch(() => {});
  revalidatePath("/");
}

export async function waCommand(command: "logout" | "sync-groups") {
  await requireSession();
  await db.waState.upsert({
    where: { id: "main" },
    create: { id: "main", command },
    update: { command },
  });
}
