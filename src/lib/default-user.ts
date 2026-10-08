import "server-only";
import bcrypt from "bcryptjs";
import { db } from "./db";

export const DEFAULT_USERNAME = "admin";
export const DEFAULT_PASSWORD = "admin12345";

/** Si no hay ningún usuario, crea admin / admin12345 (se obliga a cambiarla al entrar). */
export async function ensureDefaultUser() {
  if ((await db.user.count()) > 0) return;
  await db.user.create({
    data: { username: DEFAULT_USERNAME, passwordHash: await bcrypt.hash(DEFAULT_PASSWORD, 12) },
  });
}
