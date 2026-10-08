import { requireSession } from "@/lib/dal";
import { listChats } from "@/lib/chats";
import { ChatShell } from "@/components/chat-shell";
import { ChatList } from "@/components/chat-list";

export default async function ChatsLayout({ children }: LayoutProps<"/chats">) {
  await requireSession();
  const initial = await listChats();

  return <ChatShell sidebar={<ChatList initial={initial} />}>{children}</ChatShell>;
}
