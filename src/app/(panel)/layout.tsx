import Link from "next/link";
import { requireAuth } from "@/lib/dal";
import { logout } from "../login/actions";
import { Logo } from "@/components/logo";
import { NavLinks } from "@/components/nav-links";

export default async function PanelLayout({ children }: LayoutProps<"/">) {
  // requireAuth (no requireSession) para que /cuenta cargue aunque falte cambiar la contraseña
  const session = await requireAuth();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Logo className="size-7" />
            <span className="hidden sm:inline">WP Persona</span>
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-3">
            <Link href="/cuenta" className="hidden text-sm text-muted hover:text-text sm:inline">
              {session.username}
            </Link>
            <form action={logout}>
              <button className="btn-ghost px-3 py-1.5">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
