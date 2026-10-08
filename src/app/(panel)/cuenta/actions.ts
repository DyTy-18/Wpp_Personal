"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/dal";
import { createSession } from "@/lib/session";
import { DEFAULT_PASSWORD } from "@/lib/default-user";

const schema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "El usuario debe tener al menos 3 caracteres")
      .max(32, "Máximo 32 caracteres")
      .regex(/^[a-zA-Z0-9._-]+$/, "Usuario: solo letras, números, punto, guion y guion bajo"),
    currentPassword: z.string().min(1, "Escribe tu contraseña actual"),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .refine((d) => !d.newPassword || d.newPassword.length >= 8, {
    message: "La nueva contraseña debe tener al menos 8 caracteres",
  })
  .refine((d) => !d.newPassword || d.newPassword === d.confirmPassword, {
    message: "Las contraseñas nuevas no coinciden",
  })
  .refine((d) => d.newPassword !== DEFAULT_PASSWORD, {
    message: "No puedes usar la contraseña por defecto",
  });

export type AccountState = { error?: string; ok?: string } | undefined;

export async function updateAccount(_: AccountState, formData: FormData): Promise<AccountState> {
  const session = await requireAuth();

  const raw = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [k, v === "" ? undefined : String(v)]),
  );
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { username, currentPassword, newPassword } = parsed.data;

  if (session.mustChange && !newPassword) {
    return { error: "Tienes que poner una contraseña nueva" };
  }

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return { error: "La contraseña actual no es correcta" };
  }

  if (username !== user.username) {
    const taken = await db.user.findUnique({ where: { username } });
    if (taken) return { error: "Ese usuario ya existe" };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      username,
      ...(newPassword ? { passwordHash: await bcrypt.hash(newPassword, 12) } : {}),
    },
  });

  // Nueva sesión con el usuario actualizado y sin la marca de cambio obligatorio
  await createSession({ userId: user.id, username });
  if (session.mustChange) redirect("/");
  return { ok: "Cuenta actualizada" };
}
