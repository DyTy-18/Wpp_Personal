import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/dal";
import { describeSchedule } from "@/lib/schedule";
import { formatDate } from "@/lib/format";
import { WaStatus } from "@/components/wa-status";
import { MessageActions } from "@/components/message-actions";

export default async function DashboardPage() {
  await requireSession();
  const messages = await db.scheduledMessage.findMany({
    where: { type: { not: "now" } }, // los enviados desde el chat no son "programados"
    orderBy: [{ active: "desc" }, { nextRunAt: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <WaStatus />

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Mensajes programados</h1>
            <p className="text-sm text-muted">
              {messages.filter((m) => m.active).length} activos de {messages.length}
            </p>
          </div>
          <Link href="/mensajes/nuevo" className="btn-primary">
            + Nuevo mensaje
          </Link>
        </div>

        {messages.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className="font-medium">Aún no tienes mensajes programados</p>
            <p className="max-w-sm text-sm text-muted">
              Programa un mensaje para una fecha concreta, cada cierto tiempo o en días y horas fijos.
            </p>
            <Link href="/mensajes/nuevo" className="btn-primary mt-3">
              Crear el primero
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3">
            {messages.map((m) => (
              <li key={m.id} className={`card p-4 ${m.active ? "" : "opacity-60"}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{m.toLabel}</span>
                      {m.to.endsWith("@g.us") && (
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">Grupo</span>
                      )}
                      <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs text-accent">
                        {describeSchedule(m)}
                      </span>
                      {!m.active && (
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
                          {m.type === "once" && m.sentCount > 0 ? "Enviado" : "Pausado"}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-sm text-muted">{m.text}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      {m.active && <span>Próximo: <b className="font-medium text-text">{formatDate(m.nextRunAt)}</b></span>}
                      <span>Enviados: {m.sentCount}</span>
                      {m.lastSentAt && <span>Último: {formatDate(m.lastSentAt)}</span>}
                    </div>
                    {m.lastError && (
                      <p className="mt-2 rounded-md bg-danger-soft px-2 py-1 text-xs text-danger">
                        Último error: {m.lastError}
                      </p>
                    )}
                  </div>
                  <MessageActions id={m.id} active={m.active} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
