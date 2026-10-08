import { TIMEZONE } from "./schedule";

export function formatDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-10-07" en la zona horaria de la app, para agrupar por día */
export function dayKey(d: Date) {
  return dayKeyFmt.format(d);
}

export function formatTime(d: Date) {
  return new Intl.DateTimeFormat("es-BO", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(d);
}

function daysAgo(d: Date) {
  const today = new Date(dayKey(new Date()));
  return Math.round((today.getTime() - new Date(dayKey(d)).getTime()) / 86_400_000);
}

/** Como en la lista de WhatsApp: hora si es hoy, "Ayer", día de la semana o fecha corta */
export function formatListTime(d: Date | null | undefined) {
  if (!d) return "";
  const diff = daysAgo(d);
  if (diff <= 0) return formatTime(d);
  if (diff === 1) return "Ayer";
  if (diff < 7) return new Intl.DateTimeFormat("es-BO", { timeZone: TIMEZONE, weekday: "long" }).format(d);
  return new Intl.DateTimeFormat("es-BO", { timeZone: TIMEZONE, dateStyle: "short" }).format(d);
}

/** Separador de día dentro de una conversación */
export function formatDayLabel(d: Date) {
  const diff = daysAgo(d);
  if (diff <= 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: TIMEZONE,
    weekday: diff < 7 ? "long" : undefined,
    day: "numeric",
    month: "long",
    year: diff > 300 ? "numeric" : undefined,
  }).format(d);
}
