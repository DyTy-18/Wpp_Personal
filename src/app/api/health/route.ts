import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Para el healthcheck de Docker/Dokploy. Público: no expone datos, solo si responde. */
export async function GET() {
  try {
    const state = await db.waState.findUnique({ where: { id: "main" }, select: { updatedAt: true } });
    const workerAlive = Boolean(state && Date.now() - state.updatedAt.getTime() < 45_000);
    return Response.json({ ok: true, worker: workerAlive });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
