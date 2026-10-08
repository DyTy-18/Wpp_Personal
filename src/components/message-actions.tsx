"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteMessage, sendNow, toggleMessage } from "@/app/(panel)/actions";

export function MessageActions({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex shrink-0 flex-wrap gap-1.5">
      <button
        className="btn-ghost px-2.5 py-1 text-xs"
        disabled={pending}
        onClick={() => startTransition(() => sendNow(id))}
        title="Se envía en los próximos 15 segundos"
      >
        Enviar ahora
      </button>
      <button
        className="btn-ghost px-2.5 py-1 text-xs"
        disabled={pending}
        onClick={() => startTransition(() => toggleMessage(id))}
      >
        {active ? "Pausar" : "Activar"}
      </button>
      <Link href={`/mensajes/${id}`} className="btn-ghost px-2.5 py-1 text-xs">
        Editar
      </Link>
      <button
        className="btn-danger px-2.5 py-1 text-xs"
        disabled={pending}
        onClick={() => {
          if (confirm("¿Eliminar este mensaje programado?")) startTransition(() => deleteMessage(id));
        }}
      >
        Eliminar
      </button>
    </div>
  );
}
