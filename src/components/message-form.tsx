"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveMessage } from "@/app/(panel)/actions";
import { WEEKDAYS, buildCron, parseSimpleCron } from "@/lib/schedule";

export type MessageFormInitial = {
  id?: string;
  to?: string;
  toLabel?: string;
  text?: string;
  type?: string;
  sendAt?: string | null; // ISO
  intervalMinutes?: number | null;
  cron?: string | null;
};

type Group = { jid: string; name: string };

const UNITS = [
  { value: 1, label: "minutos" },
  { value: 60, label: "horas" },
  { value: 1440, label: "días" },
];

/** ISO -> valor para <input type="datetime-local"> en hora local del navegador */
function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function splitInterval(minutes?: number | null) {
  if (!minutes) return { amount: 1, unit: 1440 };
  if (minutes % 1440 === 0) return { amount: minutes / 1440, unit: 1440 };
  if (minutes % 60 === 0) return { amount: minutes / 60, unit: 60 };
  return { amount: minutes, unit: 1 };
}

export function MessageForm({ initial = {}, groups }: { initial?: MessageFormInitial; groups: Group[] }) {
  const [state, action, pending] = useActionState(saveMessage, undefined);

  const isGroup = initial.to?.endsWith("@g.us") ?? false;
  const [targetKind, setTargetKind] = useState<"contact" | "group">(isGroup ? "group" : "contact");
  const [type, setType] = useState(initial.type ?? "once");
  const [text, setText] = useState(initial.text ?? "");
  const [sendAtLocal, setSendAtLocal] = useState(toLocalInput(initial.sendAt));

  const iv = splitInterval(initial.intervalMinutes);
  const [amount, setAmount] = useState(iv.amount);
  const [unit, setUnit] = useState(iv.unit);

  const simple = initial.cron ? parseSimpleCron(initial.cron) : null;
  const [advanced, setAdvanced] = useState(Boolean(initial.cron && !simple));
  const [time, setTime] = useState(simple?.time ?? "09:00");
  const [days, setDays] = useState<number[]>(simple?.days ?? [1, 2, 3, 4, 5]);
  const [rawCron, setRawCron] = useState(initial.cron ?? "0 9 * * 1-5");

  const cron = useMemo(
    () => (advanced ? rawCron : days.length ? buildCron(time, days) : ""),
    [advanced, rawCron, time, days],
  );
  // El servidor recibe la fecha en ISO (UTC) para no depender de su zona horaria
  const sendAtIso = sendAtLocal ? new Date(sendAtLocal).toISOString() : "";

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  return (
    <form action={action} className="space-y-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="targetKind" value={targetKind} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="sendAt" value={type === "cron" ? "" : sendAtIso} />
      <input type="hidden" name="intervalMinutes" value={type === "interval" ? amount * unit : ""} />
      <input type="hidden" name="cron" value={type === "cron" ? cron : ""} />

      {/* Destino */}
      <fieldset className="card space-y-4 p-5">
        <legend className="sr-only">Destino</legend>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">¿A quién?</h2>
          <Segmented
            value={targetKind}
            onChange={(v) => setTargetKind(v as "contact" | "group")}
            options={[
              { value: "contact", label: "Contacto" },
              { value: "group", label: "Grupo" },
            ]}
          />
        </div>

        {targetKind === "contact" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="phone" className="label">Número con lada</label>
              <input
                id="phone"
                name="phone"
                className="input font-mono"
                placeholder="5215512345678"
                inputMode="tel"
                defaultValue={
                  !isGroup && initial.to
                    ? initial.to.endsWith("@lid")
                      ? initial.to // sin número conocido: se envía al ID interno del chat
                      : initial.to.split("@")[0]
                    : ""
                }
                required
              />
              <p className="mt-1 text-xs text-muted">Código de país + número, sin espacios ni “+”.</p>
            </div>
            <div>
              <label htmlFor="contactName" className="label">
                Nombre <span className="font-normal text-muted">(opcional)</span>
              </label>
              <input
                id="contactName"
                name="contactName"
                className="input"
                placeholder="Mamá"
                defaultValue={!isGroup ? initial.toLabel?.replace(/^\+\d+$/, "") : ""}
              />
            </div>
          </div>
        ) : groups.length === 0 ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
            No hay grupos todavía. Conecta WhatsApp y pulsa “Sincronizar grupos” en el panel.
          </p>
        ) : (
          <div>
            <label htmlFor="groupJid" className="label">Grupo</label>
            <select id="groupJid" name="groupJid" className="input" defaultValue={isGroup ? initial.to : ""} required>
              <option value="" disabled>Elige un grupo…</option>
              {groups.map((g) => (
                <option key={g.jid} value={g.jid}>{g.name}</option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      {/* Mensaje */}
      <fieldset className="card p-5">
        <legend className="sr-only">Mensaje</legend>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="text" className="font-semibold">Mensaje</label>
          <span className="text-xs text-muted">{text.length}/4000</span>
        </div>
        <textarea
          id="text"
          name="text"
          className="input min-h-32 resize-y"
          maxLength={4000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe tu mensaje… puedes usar *negritas* y _cursivas_ de WhatsApp"
          required
        />
      </fieldset>

      {/* Horario */}
      <fieldset className="card space-y-4 p-5">
        <legend className="sr-only">Horario</legend>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">¿Cuándo?</h2>
          <Segmented
            value={type}
            onChange={setType}
            options={[
              { value: "once", label: "Una vez" },
              { value: "interval", label: "Cada X tiempo" },
              { value: "cron", label: "Días y hora" },
            ]}
          />
        </div>

        {type === "once" && (
          <div className="max-w-xs">
            <label htmlFor="sendAtLocal" className="label">Fecha y hora</label>
            <input
              id="sendAtLocal"
              type="datetime-local"
              className="input"
              value={sendAtLocal}
              onChange={(e) => setSendAtLocal(e.target.value)}
              required
            />
          </div>
        )}

        {type === "interval" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="label">Repetir cada</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  className="input w-24"
                  value={amount}
                  onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
                  aria-label="Cantidad"
                />
                <select className="input" value={unit} onChange={(e) => setUnit(Number(e.target.value))} aria-label="Unidad">
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
              {amount * unit < 5 && <p className="mt-1 text-xs text-danger">Mínimo 5 minutos.</p>}
            </div>
            <div>
              <label htmlFor="startAt" className="label">
                Empezar el <span className="font-normal text-muted">(vacío = ahora)</span>
              </label>
              <input
                id="startAt"
                type="datetime-local"
                className="input"
                value={sendAtLocal}
                onChange={(e) => setSendAtLocal(e.target.value)}
              />
            </div>
          </div>
        )}

        {type === "cron" && (
          <div className="space-y-4">
            {!advanced ? (
              <>
                <div>
                  <span className="label">Días</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        aria-pressed={days.includes(d)}
                        className={`w-12 rounded-lg border py-1.5 text-sm transition ${
                          days.includes(d)
                            ? "border-accent bg-accent text-accent-text"
                            : "border-border bg-surface text-muted hover:text-text"
                        }`}
                      >
                        {WEEKDAYS[d]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="max-w-40">
                  <label htmlFor="time" className="label">Hora</label>
                  <input id="time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} required />
                </div>
              </>
            ) : (
              <div className="max-w-sm">
                <label htmlFor="rawCron" className="label">Expresión cron</label>
                <input
                  id="rawCron"
                  className="input font-mono"
                  value={rawCron}
                  onChange={(e) => setRawCron(e.target.value)}
                  placeholder="0 9 * * 1-5"
                />
                <p className="mt-1 text-xs text-muted">minuto · hora · día del mes · mes · día de la semana</p>
              </div>
            )}
            <button type="button" className="text-sm text-accent hover:underline" onClick={() => setAdvanced((a) => !a)}>
              {advanced ? "← Usar selector simple" : "Modo avanzado (cron)"}
            </button>
          </div>
        )}
      </fieldset>

      {state?.error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{state.error}</p>
      )}

      <div className="flex justify-end gap-2">
        <Link href="/" className="btn-ghost">Cancelar</Link>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Guardando..." : initial.id ? "Guardar cambios" : "Programar mensaje"}
        </button>
      </div>
    </form>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-sm transition ${
            value === o.value ? "bg-surface font-medium text-text shadow-sm" : "text-muted hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
