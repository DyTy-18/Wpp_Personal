import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return Response.json({ error: "No autorizado" }, { status: 401 });

  const state = await db.waState.findUnique({ where: { id: "main" } });
  // El worker escribe un latido cada 15 s; si no hay latido, está apagado
  const offline = !state || Date.now() - state.updatedAt.getTime() > 45_000;
  const status = offline ? "offline" : state.status;

  const qr =
    status === "qr" && state?.qr
      ? await QRCode.toDataURL(state.qr, { margin: 1, width: 280 })
      : null;

  return Response.json({
    status,
    qr,
    me: offline ? null : state.me,
    syncProgress: offline ? null : state.syncProgress,
  });
}
