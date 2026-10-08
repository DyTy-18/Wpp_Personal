"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ChatListItem } from "@/lib/chats";
import { Avatar } from "./avatar";

const FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "no-leidos", label: "No leídos" },
  { value: "contactos", label: "Contactos" },
  { value: "grupos", label: "Grupos" },
];

export function ChatList({ initial }: { initial: ChatListItem[] }) {
  const params = useParams<{ jid?: string }>();
  const activeJid = params.jid ? decodeURIComponent(params.jid) : null;

  const [chats, setChats] = useState(initial);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("todos");
  const [loading, setLoading] = useState(false);

  // Búsqueda con pequeño retraso + refresco cada 10 s para ver mensajes nuevos
  useEffect(() => {
    let alive = true;
    const load = async (showLoading: boolean) => {
      if (showLoading) setLoading(true);
      try {
        const sp = new URLSearchParams({ q, f: filter });
        const res = await fetch(`/api/chats?${sp}`, { cache: "no-store" });
        if (res.ok && alive) setChats(await res.json());
      } catch {
      } finally {
        if (alive) setLoading(false);
      }
    };
    const t = setTimeout(() => load(true), q ? 250 : 0);
    const i = setInterval(() => load(false), 10_000);
    return () => {
      alive = false;
      clearTimeout(t);
      clearInterval(i);
    };
  }, [q, filter]);

  return (
    <>
      <div className="space-y-2 border-b border-border p-3">
        <div className="relative">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar un chat o número"
            className="input rounded-full border-transparent bg-surface-2 pl-9"
            aria-label="Buscar chats"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === f.value ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted hover:text-text"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ul className={`flex-1 overflow-y-auto transition-opacity ${loading ? "opacity-60" : ""}`}>
        {chats.length === 0 && (
          <li className="px-6 py-12 text-center text-sm text-muted">
            {q ? `Nada coincide con “${q}”.` : "No hay chats todavía. Vincula WhatsApp para recuperar tu historial."}
          </li>
        )}
        {chats.map((c) => {
          const active = c.jid === activeJid;
          return (
            <li key={c.jid}>
              <Link
                href={`/chats/${encodeURIComponent(c.jid)}`}
                className={`flex items-center gap-3 px-3 py-2.5 transition ${active ? "bg-selected" : "hover:bg-surface-2"}`}
                aria-current={active ? "page" : undefined}
              >
                <Avatar name={c.displayName} group={c.isGroup} size="size-12" />
                <div className="min-w-0 flex-1 border-b border-border/60 pb-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate font-medium">{c.displayName}</span>
                    <span className={`ml-auto shrink-0 text-xs ${c.unreadCount > 0 ? "font-medium text-accent" : "text-muted"}`}>
                      {c.time}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="truncate text-sm text-muted">{c.preview}</p>
                    {c.unreadCount > 0 && (
                      <span className="ml-auto min-w-5 shrink-0 rounded-full bg-accent px-1.5 text-center text-xs leading-5 font-semibold text-accent-text">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
