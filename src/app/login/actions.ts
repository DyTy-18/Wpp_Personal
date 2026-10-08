"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";
import { DEFAULT_PASSWORD, ensureDefaultUser } from "@/lib/default-user";

// Bloqueo simple contra fuerza bruta: 5 intentos fallidos -> 10 minutos bloqueado
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;

export type LoginState = { error?: string } | undefined;

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Escribe usuario y contraseña" };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  const key = `${ip}:${username}`;
  const entry = attempts.get(key);
  if (entry && entry.until > Date.now()) {
    return { error: "Demasiados intentos. Espera unos minutos." };
  }

  await ensureDefaultUser();
  const user = await db.user.findUnique({ where: { username } });
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !ok) {
    const count = (entry?.count ?? 0) + 1;
    attempts.set(key, { count, until: count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0 });
    return { error: "Usuario o contraseña incorrectos" };
  }

  attempts.delete(key);
  const mustChange = password === DEFAULT_PASSWORD;
  await createSession({ userId: user.id, username: user.username, mustChange });
  redirect(mustChange ? "/cuenta" : "/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
