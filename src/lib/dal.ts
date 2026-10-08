import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "./session";

/** Sesión válida, aunque todavía tenga que cambiar la contraseña por defecto. */
export const requireAuth = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
});

/** Verificación real de sesión. Úsala en cada página y server action protegida. */
export const requireSession = cache(async () => {
  const session = await requireAuth();
  if (session.mustChange) redirect("/cuenta");
  return session;
});
