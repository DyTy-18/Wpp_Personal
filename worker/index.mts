import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { PrismaClient } from "@prisma/client";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from "baileys";
import { computeNextRun } from "../src/lib/schedule";
import { createHistoryStore } from "./history.mjs";

const AUTH_DIR = path.resolve(process.cwd(), "wa-auth");
const TICK_MS = 5_000;
// Un mensaje "una vez" que se perdió por más de esto (worker apagado) no se envía
const MAX_LATE_MS = 24 * 60 * 60 * 1000;

// Solo un worker a la vez: el más reciente escribe su id aquí y los demás se apagan solos
const LOCK_FILE = path.resolve(process.cwd(), "wa-auth.lock");
const INSTANCE_ID = randomUUID();
// Códigos con los que la sesión ya no sirve y hay que escanear el QR de nuevo
const SESSION_GONE = new Set<number>([
  DisconnectReason.loggedOut,
  DisconnectReason.forbidden,
  DisconnectReason.badSession,
  DisconnectReason.multideviceMismatch,
]);

const db = new PrismaClient();
const logger = pino({ level: "warn" });
const history = createHistoryStore(db, log);

let sock: WASocket | null = null;
let connected = false;
let busy = false;
let currentStatus = "disconnected";
// Cierres seguidos sin llegar a QR ni a conectar: sirve para espaciar los reintentos
let failures = 0;

function scheduleReconnect() {
  failures++;
  const delay = Math.min(60_000, 3_000 * 2 ** (failures - 1));
  if (failures >= 4) log(`${failures} intentos fallidos seguidos. Reintentando en ${delay / 1000} s`);
  setTimeout(() => connect().catch((e) => {
    log("Error reconectando:", e instanceof Error ? e.message : e);
    scheduleReconnect();
  }), delay);
}

function log(...args: unknown[]) {
  console.log(`[${new Date().toLocaleTimeString()}]`, ...args);
}

async function setState(data: {
  status: string;
  qr?: string | null;
  me?: string | null;
  syncProgress?: number | null;
}) {
  currentStatus = data.status;
  await db.waState.upsert({ where: { id: "main" }, create: { id: "main", ...data }, update: data });
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  await setState({ status: "connecting", qr: null });
  sock = makeWASocket({
    auth: state,
    version,
    logger,
    // Ojo: los perfiles "Desktop" (Browsers.macOS("Desktop")) hoy WhatsApp los rechaza con
    // código 428 y nunca llega a dar QR. Con "Chrome" + syncFullHistory se pide el historial completo.
    browser: Browsers.macOS("Chrome"),
    syncFullHistory: true,
    shouldSyncHistoryMessage: () => true,
    // Sin esto el teléfono deja de mostrar notificaciones mientras el worker está conectado
    markOnlineOnConnect: false,
  });
  sock.ev.on("creds.update", saveCreds);
  history.attach(sock, async (syncProgress) => {
    await setState({ status: currentStatus, syncProgress });
  });

  const current = sock;
  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    // Eventos tardíos de un socket anterior no deben pisar el estado del actual
    if (current !== sock) return;
    if (qr) {
      failures = 0;
      log("Nuevo QR disponible, escanéalo desde el panel");
      await setState({ status: "qr", qr });
    }
    if (connection === "open") {
      failures = 0;
      connected = true;
      const me = sock?.user?.id?.split(":")[0].split("@")[0] ?? null;
      log("Conectado como", me);
      await setState({ status: "connected", qr: null, me });
      syncGroups().catch((e) => log("Error sincronizando grupos:", e.message));
    }
    if (connection === "close") {
      connected = false;
      const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      if (code === DisconnectReason.connectionReplaced) {
        // Otro worker abrió la misma sesión: no pelear con él
        log("Otra instancia del worker tomó la sesión. Saliendo.");
        process.exit(0);
      }
      if (code !== undefined && SESSION_GONE.has(code)) {
        log(`Sesión de WhatsApp cerrada (código ${code}). Se generará un QR nuevo.`);
        await rm(AUTH_DIR, { recursive: true, force: true });
      } else {
        log("Conexión cerrada (código", code, "), reconectando...");
      }
      await setState({ status: "disconnected", qr: null, me: null, syncProgress: null });
      scheduleReconnect();
    }
  });
}

async function syncGroups() {
  if (!sock) return;
  const groups = await sock.groupFetchAllParticipating();
  for (const g of Object.values(groups)) {
    await db.waGroup.upsert({
      where: { jid: g.id },
      create: { jid: g.id, name: g.subject },
      update: { name: g.subject },
    });
    await db.waChat.upsert({
      where: { jid: g.id },
      create: { jid: g.id, name: g.subject, isGroup: true },
      update: { name: g.subject, isGroup: true },
    });
  }
  log(`Grupos sincronizados: ${Object.keys(groups).length}`);
}

async function handleCommand() {
  const state = await db.waState.findUnique({ where: { id: "main" } });
  if (!state?.command) return;
  await db.waState.update({ where: { id: "main" }, data: { command: null } });

  if (state.command === "logout") {
    log("Cerrando sesión por petición del panel");
    try {
      await sock?.logout(); // dispara connection.close con loggedOut -> QR nuevo
    } catch {
      await rm(AUTH_DIR, { recursive: true, force: true });
      process.exit(1); // sin sesión válida: reinicia limpio
    }
  }
  if (state.command === "sync-groups" && sock) {
    await syncGroups();
    // Vuelve a descargar la agenda (nombres de contactos) desde cero
    log("Pidiendo la agenda de contactos a WhatsApp...");
    await sock.resyncAppState(["critical_block", "critical_unblock_low"], true);
    log("Agenda sincronizada");
  }
}

async function resolveRecipient(to: string): Promise<string> {
  if (to.endsWith("@g.us") || to.endsWith("@lid") || !sock) return to;
  const [result] = (await sock.onWhatsApp(to)) ?? [];
  if (!result?.exists) throw new Error("Ese número no tiene WhatsApp");
  return result.jid;
}

async function processDue() {
  const now = new Date();
  const due = await db.scheduledMessage.findMany({
    where: { active: true, nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
    take: 20,
  });

  for (const msg of due) {
    const late = now.getTime() - (msg.nextRunAt?.getTime() ?? now.getTime());

    // Primero se "reclama" el mensaje moviendo nextRunAt, así nunca se envía dos veces
    const next = msg.type === "once" ? null : computeNextRun(msg, now);
    await db.scheduledMessage.update({
      where: { id: msg.id },
      data: { nextRunAt: next, active: next !== null },
    });

    if (msg.type === "once" && late > MAX_LATE_MS) {
      await db.messageLog.create({
        data: {
          messageId: msg.id, to: msg.to, toLabel: msg.toLabel, text: msg.text,
          status: "skipped", error: "Se pasó la hora por más de 24 h (worker apagado)",
        },
      });
      continue;
    }

    try {
      const jid = await resolveRecipient(msg.to);
      await sock!.sendMessage(jid, { text: msg.text });
      await db.scheduledMessage.update({
        where: { id: msg.id },
        data: { sentCount: { increment: 1 }, lastSentAt: new Date(), lastError: null },
      });
      await db.messageLog.create({
        data: { messageId: msg.id, to: msg.to, toLabel: msg.toLabel, text: msg.text, status: "sent" },
      });
      log(`Enviado a ${msg.toLabel}`);
      // Los escritos desde la vista de chat no se quedan en la lista de programados
      if (msg.type === "now") await db.scheduledMessage.delete({ where: { id: msg.id } });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await db.scheduledMessage.update({ where: { id: msg.id }, data: { lastError: error } });
      await db.messageLog.create({
        data: { messageId: msg.id, to: msg.to, toLabel: msg.toLabel, text: msg.text, status: "failed", error },
      });
      log(`Error enviando a ${msg.toLabel}:`, error);
    }

    // Pequeña pausa entre mensajes para no parecer bot
    await new Promise((r) => setTimeout(r, 1_500 + Math.random() * 1_500));
  }
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    const owner = await readFile(LOCK_FILE, "utf8").catch(() => INSTANCE_ID);
    if (owner.trim() !== INSTANCE_ID) {
      log("Se inició otro worker más nuevo. Este se apaga.");
      sock?.end(undefined);
      await db.$disconnect();
      process.exit(0);
    }

    // Si WhatsApp cortó sin avisar, forzar el cierre: dispara "close" y la reconexión
    if (connected && !sock?.ws.isOpen) {
      log("La conexión se cayó sin aviso, reconectando...");
      connected = false;
      sock?.end(new Boom("Conexión perdida", { statusCode: DisconnectReason.connectionLost }));
      return;
    }

    // Latido: el panel considera el worker apagado si updatedAt tiene más de 45 s
    await setState({ status: currentStatus });
    await handleCommand();
    if (connected) await processDue();
  } catch (e) {
    log("Error en el ciclo:", e);
  } finally {
    busy = false;
  }
}

async function shutdown() {
  log("Apagando worker...");
  await setState({ status: "disconnected", qr: null }).catch(() => {});
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

log("Worker iniciado");
await writeFile(LOCK_FILE, INSTANCE_ID);
await connect();
setInterval(tick, TICK_MS);
