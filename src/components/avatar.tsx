// Color estable por nombre, como hace WhatsApp con los avatares sin foto
function hue(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function Avatar({ name, group = false, size = "size-10" }: { name: string; group?: boolean; size?: string }) {
  // Por letras completas, no por unidades UTF-16: con w[0] un emoji queda partido a la
  // mitad y el servidor y el navegador lo pintan distinto (error de hydration)
  const letters = name
    .split(/\s+/)
    .map((w) => w.match(/[\p{L}\p{N}]/u)?.[0])
    .filter(Boolean)
    .slice(0, 2);
  const initials = letters.length
    ? letters.join("").toUpperCase()
    : (Array.from(name.trim())[0] ?? "?"); // nombre solo con emojis: mostrar el primero

  return (
    <span
      className={`${size} inline-flex shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white`}
      style={{ backgroundColor: group ? "var(--muted)" : `hsl(${hue(name)} 45% 45%)` }}
      aria-hidden
    >
      {group ? (
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
          <path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2c-2.7 0-6 1.3-6 3.5V19h12v-2.5C14 14.3 10.7 13 8 13Zm8 0c-.4 0-.8 0-1.2.1 1.3.9 2.2 2 2.2 3.4V19h5v-2.5c0-2.2-3.3-3.5-6-3.5Z" />
        </svg>
      ) : (
        initials
      )}
    </span>
  );
}
