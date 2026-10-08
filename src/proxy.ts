import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Chequeo optimista: si no hay cookie válida, al login. La verificación real está en lib/dal.ts
export async function proxy(req: NextRequest) {
  const isLogin = req.nextUrl.pathname === "/login";
  const token = req.cookies.get("session")?.value;

  let valid = false;
  if (token && process.env.SESSION_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET));
      valid = true;
    } catch {}
  }

  if (!valid && !isLogin) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (valid && isLogin) return NextResponse.redirect(new URL("/", req.nextUrl));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:png|svg|ico)$).*)"],
};
