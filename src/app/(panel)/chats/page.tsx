import { db } from "@/lib/db";
import { requireSession } from "@/lib/dal";
import { Logo } from "@/components/logo";

export default async function ChatsIndexPage() {
  await requireSession();
  const [chats, messages] = await Promise.all([
    db.waChat.count({ where: { lastMessageAt: { not: null } } }),
    db.waMessage.count(),
  ]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-chat-bg px-6 text-center">
      <Logo className="size-14 opacity-80" />
      <h1 className="text-lg font-semibold">WP Persona</h1>
      <p className="max-w-sm text-sm text-muted">
        Elige un chat para ver la conversación, escribir o programar un mensaje.
      </p>
      <p className="text-xs text-muted">
        {chats.toLocaleString("es-MX")} chats · {messages.toLocaleString("es-MX")} mensajes guardados
      </p>
    </div>
  );
}
