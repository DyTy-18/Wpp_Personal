import { requireSession } from "@/lib/dal";
import { listGroups } from "@/lib/chats";
import { MessageForm } from "@/components/message-form";

export default async function NewMessagePage({ searchParams }: PageProps<"/mensajes/nuevo">) {
  await requireSession();
  const sp = await searchParams;
  // Desde un chat: /mensajes/nuevo?to=<jid>&label=<nombre>
  const to = typeof sp.to === "string" ? sp.to : undefined;
  const label = typeof sp.label === "string" ? sp.label : undefined;

  const groups = await listGroups();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-lg font-semibold">Nuevo mensaje programado</h1>
      <MessageForm groups={groups} initial={to ? { to, toLabel: label } : undefined} />
    </div>
  );
}

