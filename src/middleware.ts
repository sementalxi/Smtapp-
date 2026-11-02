import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PROTECTED = ["/dashboard", "/create", "/banner", "/billing", "/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Visitors on the old *.vercel.app address go to the real domain (so Apple Pay, links and logins all say kixo.pro).
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase();
  const main = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  if (main && !main.endsWith(".vercel.app") && host.endsWith(".vercel.app") && process.env.VERCEL_ENV === "production" && req.method === "GET") {
    return NextResponse.redirect(new URL(pathname + req.nextUrl.search, `https://${main}`), 308);
  }
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  // Role checks happen on the server (requireAdmin) because they need the database.
  return NextResponse.next();
}

export const config = {
  // Every page (not API calls or static files) — needed for the domain redirect.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
