import { requireAuth } from "@/lib/dal";
import { AccountForm } from "./account-form";

export default async function AccountPage() {
  const session = await requireAuth();
  const mustChange = Boolean(session.mustChange);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-lg font-semibold">Cuenta</h1>
      <p className="mb-6 text-sm text-muted">Cambia tu usuario o contraseña de acceso al panel.</p>

      {mustChange && (
        <div className="mb-5 rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn" role="alert">
          <b>Estás usando la contraseña por defecto.</b> Cámbiala para poder usar el panel.
        </div>
      )}

      <AccountForm username={session.username} mustChange={mustChange} />
    </div>
  );
}
