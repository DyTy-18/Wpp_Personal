"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMessage, sendChatMessage } from "@/app/(panel)/actions";

export function ChatComposer({ jid, label }: { jid: string; label: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const send = () => {
    const value = text.trim();
    if (!value || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await sendChatMessage(jid, label, value);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setText("");
      router.refresh();
      ref.current?.focus();
    });
  };

  return (
    <div className="border-t border-border bg-surface px-3 py-2.5">
      {error && <p className="mb-2 text-xs text-danger" role="alert">{error}</p>}
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter envía, Shift+Enter hace salto de línea (como WhatsApp Web)
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Escribe un mensaje"
          aria-label="Mensaje"
          className="input max-h-36 min-h-10 flex-1 resize-none rounded-2xl border-transparent bg-surface-2 [field-sizing:content]"
        />
        <button
          onClick={send}
          disabled={!text.trim() || pending}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-text transition hover:brightness-110 disabled:opacity-40"
          aria-label="Enviar"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
            <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** Quita de la conversación un mensaje que no se pudo enviar */
export function DiscardButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="shrink-0 underline disabled:opacity-50"
      disabled={pending}
      onClick={() => startTransition(() => deleteMessage(id))}
    >
      Descartar
    </button>
  );
}
