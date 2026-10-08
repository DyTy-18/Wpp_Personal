"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Mensajes" },
  { href: "/chats", label: "Chats" },
  { href: "/historial", label: "Historial" },
  { href: "/cuenta", label: "Cuenta" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {links.map((l) => {
        const active = l.href === "/" ? pathname === "/" || pathname.startsWith("/mensajes") : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-md px-3 py-1.5 text-sm transition ${
              active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-text"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
