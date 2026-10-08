"use client";

import { useEffect, useState, useTransition } from "react";
import { waCommand } from "@/app/(panel)/actions";

type Status = {
  status: "offline" | "disconnected" | "connecting" | "qr" | "connected";
  qr: string | null;
  me: string | null;
  syncProgress: number | null;
};

const LABELS: Record<Status["status"], { text: string; tone: string }> = {
  connected: { text: "Conectado", tone: "bg-accent-soft text-accent" },
  qr: { text: "Esperando escaneo", tone: "bg-warn-soft text-warn" },
  connecting: { text: "Conectando...", tone: "bg-warn-soft text-warn" },
  disconnected: { text: "Desconectado", tone: "bg-danger-soft text-danger" },
  offline: { text: "Worker apagado", tone: "bg-danger-soft text-danger" },
};

export function WaStatus() {
  const [data, setData] = useState<Status | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/wa/status", { cache: "no-store" });
        if (res.ok && alive) setData(await res.json());
      } catch {}
    };
    load();
    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const status = data?.status ?? "connecting";
  const label = LABELS[status];

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="font-semibold">WhatsApp</h2>
          <p className="text-sm text-muted">
            {status === "connected" && data?.me ? `Sesión activa: +${data.me}` : "Estado de la conexión"}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${label.tone}`}>
          <span className="size-1.5 rounded-full bg-current" />
          {label.text}
        </span>
        {status === "connected" && (
          <>
            <button
              className="btn-ghost px-3 py-1.5"
              disabled={pending}
              onClick={() => startTransition(() => waCommand("sync-groups"))}
            >
              Sincronizar contactos y grupos
            </button>
            <button
              className="btn-danger px-3 py-1.5"
              disabled={pending}
              onClick={() => {
                if (confirm("¿Cerrar la sesión de WhatsApp? Tendrás que escanear el QR otra vez.")) {
                  startTransition(() => waCommand("logout"));
                }
              }}
            >
              Desvincular
            </button>
          </>
        )}
      </div>

      {status === "connected" && data?.syncProgress != null && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-muted">Recuperando historial de chats…</span>
            <span className="font-medium">{data.syncProgress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${data.syncProgress}%` }} />
          </div>
        </div>
      )}

      {status === "qr" && data?.qr && (
        <div className="mt-5 flex flex-col items-center gap-5 border-t border-border pt-5 sm:flex-row sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.qr} alt="Código QR de WhatsApp" className="size-56 rounded-lg bg-white p-2" />
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
            <li>Abre WhatsApp en tu teléfono</li>
            <li>
              Ve a <b className="text-text">Ajustes → Dispositivos vinculados</b>
            </li>
            <li>
              Toca <b className="text-text">Vincular un dispositivo</b> y escanea este código
            </li>
            <li>El código se renueva solo cada ~20 segundos</li>
          </ol>
        </div>
      )}

      {status === "offline" && (
        <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
          El worker no está corriendo. Inícialo con <code className="font-mono text-text">npm run dev</code> (o{" "}
          <code className="font-mono text-text">npm run worker</code>). Sin él no se envían mensajes.
        </p>
      )}
    </section>
  );
}
