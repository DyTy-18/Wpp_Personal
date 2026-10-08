import { Cron } from "croner";

// Compartido entre el panel (Next) y el worker: no importar nada de Next aquí.

export const TIMEZONE = process.env.APP_TIMEZONE || "America/La_Paz";

export type ScheduleInput = {
  type: string;
  sendAt?: Date | null;
  intervalMinutes?: number | null;
  cron?: string | null;
};

/** Próxima ejecución después de `from`. null = no hay más ejecuciones. */
export function computeNextRun(s: ScheduleInput, from: Date = new Date()): Date | null {
  if (s.type === "once") {
    return s.sendAt ?? null;
  }
  if (s.type === "interval") {
    if (!s.intervalMinutes || s.intervalMinutes < 1) return null;
    // La primera vez arranca en sendAt (si es futuro); después suma el intervalo
    const start = s.sendAt ?? from;
    if (start > from) return start;
    const step = s.intervalMinutes * 60_000;
    const elapsed = from.getTime() - start.getTime();
    return new Date(start.getTime() + (Math.floor(elapsed / step) + 1) * step);
  }
  if (s.type === "cron") {
    if (!s.cron) return null;
    return new Cron(s.cron, { timezone: TIMEZONE, paused: true }).nextRun(from);
  }
  return null;
}

export function isValidCron(pattern: string): boolean {
  try {
    new Cron(pattern, { timezone: TIMEZONE, paused: true });
    return true;
  } catch {
    return false;
  }
}

export const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** "09:30" + [1,2,3] -> "30 9 * * 1,2,3" */
export function buildCron(time: string, days: number[]): string {
  const [h, m] = time.split(":").map(Number);
  const dow = days.length === 0 || days.length === 7 ? "*" : [...days].sort().join(",");
  return `${m} ${h} * * ${dow}`;
}

/** Inverso de buildCron, para editar. null si el cron es "avanzado". */
export function parseSimpleCron(pattern: string): { time: string; days: number[] } | null {
  const m = pattern.trim().match(/^(\d{1,2}) (\d{1,2}) \* \* ([\d,]+|\*)$/);
  if (!m) return null;
  const days = m[3] === "*" ? [0, 1, 2, 3, 4, 5, 6] : m[3].split(",").map(Number);
  return { time: `${m[2].padStart(2, "0")}:${m[1].padStart(2, "0")}`, days };
}

export function describeSchedule(s: ScheduleInput): string {
  if (s.type === "once") return "Una sola vez";
  if (s.type === "interval") {
    const n = s.intervalMinutes ?? 0;
    if (n % 1440 === 0) return `Cada ${n / 1440} día(s)`;
    if (n % 60 === 0) return `Cada ${n / 60} hora(s)`;
    return `Cada ${n} min`;
  }
  if (s.type === "cron" && s.cron) {
    const simple = parseSimpleCron(s.cron);
    if (!simple) return `Cron: ${s.cron}`;
    const days =
      simple.days.length === 7 ? "Todos los días" : simple.days.map((d) => WEEKDAYS[d]).join(", ");
    return `${days} a las ${simple.time}`;
  }
  return "—";
}

/** Número con lada -> JID de WhatsApp. Si ya es JID lo deja igual. */
export function toJid(input: string): string | null {
  const v = input.trim();
  if (/@(g\.us|s\.whatsapp\.net|lid)$/.test(v)) return v;
  const digits = v.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `${digits}@s.whatsapp.net`;
}
