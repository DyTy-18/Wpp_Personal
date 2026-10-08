"use client";

import { useSelectedLayoutSegment } from "next/navigation";

/** Dos columnas como WhatsApp Web. En móvil: lista o conversación, una a la vez. */
export function ChatShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  const chatOpen = useSelectedLayoutSegment() !== null;

  return (
    <div className="card flex h-[calc(100dvh-7rem)] min-h-[28rem] overflow-hidden sm:h-[calc(100dvh-8.5rem)]">
      <aside
        className={`w-full flex-col border-r border-border md:flex md:w-[340px] md:shrink-0 lg:w-[380px] ${
          chatOpen ? "hidden" : "flex"
        }`}
      >
        {sidebar}
      </aside>
      <section className={`min-w-0 flex-1 flex-col md:flex ${chatOpen ? "flex" : "hidden"}`}>{children}</section>
    </div>
  );
}
