import { db } from "@/lib/db";
import { requireSession } from "@/lib/dal";
import { formatDate } from "@/lib/format";

const STATUS: Record<string, { text: string; tone: string }> = {
  sent: { text: "Enviado", tone: "bg-accent-soft text-accent" },
  failed: { text: "Falló", tone: "bg-danger-soft text-danger" },
  skipped: { text: "Omitido", tone: "bg-warn-soft text-warn" },
};

export default async function HistoryPage() {
  await requireSession();
  const logs = await db.messageLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div>
      <h1 className="text-lg font-semibold">Historial</h1>
      <p className="mb-4 text-sm text-muted">Últimos 200 envíos</p>

      {logs.length === 0 ? (
        <div className="card px-6 py-14 text-center text-sm text-muted">Todavía no se ha enviado nada.</div>
      ) : (
        <ul className="card divide-y divide-border">
          {logs.map((l) => {
            const s = STATUS[l.status] ?? STATUS.failed;
            return (
              <li key={l.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                <span className="w-40 shrink-0 text-xs text-muted sm:pt-0.5">{formatDate(l.createdAt)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{l.toLabel}</span>
                    <span className={`rounded px-1.5 py-0.5 text-xs ${s.tone}`}>{s.text}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted">{l.text}</p>
                  {l.error && <p className="mt-1 text-xs text-danger">{l.error}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
