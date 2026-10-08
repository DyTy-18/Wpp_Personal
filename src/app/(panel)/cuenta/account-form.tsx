"use client";

import { useActionState } from "react";
import { updateAccount } from "./actions";

export function AccountForm({ username, mustChange }: { username: string; mustChange: boolean }) {
  const [state, action, pending] = useActionState(updateAccount, undefined);

  return (
    <form action={action} className="card space-y-5 p-5">
      <div>
        <label htmlFor="username" className="label">Usuario</label>
        <input id="username" name="username" className="input" defaultValue={username} autoComplete="username" required />
      </div>

      <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
        <div>
          <label htmlFor="newPassword" className="label">
            Nueva contraseña{" "}
            {!mustChange && <span className="font-normal text-muted">(vacío = no cambiar)</span>}
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            className="input"
            autoComplete="new-password"
            minLength={8}
            required={mustChange}
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="label">Repetir nueva contraseña</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            className="input"
            autoComplete="new-password"
            required={mustChange}
          />
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <label htmlFor="currentPassword" className="label">Contraseña actual</label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          className="input sm:max-w-xs"
          autoComplete="current-password"
          required
        />
        <p className="mt-1 text-xs text-muted">Para confirmar que eres tú.</p>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent" role="status">{state.ok}</p>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}
