import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/dal";
import { listGroups } from "@/lib/chats";
import { MessageForm } from "@/components/message-form";

export default async function EditMessagePage({ params }: PageProps<"/mensajes/[id]">) {
  await requireSession();
  const { id } = await params;
  const [msg, groups] = await Promise.all([
    db.scheduledMessage.findUnique({ where: { id } }),
    listGroups(),
  ]);
  if (!msg) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-lg font-semibold">Editar mensaje</h1>
      <MessageForm
        groups={groups}
        initial={{
          id: msg.id,
          to: msg.to,
          toLabel: msg.toLabel,
          text: msg.text,
          type: msg.type,
          sendAt: msg.sendAt?.toISOString() ?? null,
          intervalMinutes: msg.intervalMinutes,
          cron: msg.cron,
        }}
      />
    </div>
  );
}
