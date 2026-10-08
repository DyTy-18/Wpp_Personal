import type { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { listChats } from "@/lib/chats";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await getSession())) return Response.json({ error: "No autorizado" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const filter = req.nextUrl.searchParams.get("f") ?? "todos";
  return Response.json(await listChats({ q, filter }));
}
