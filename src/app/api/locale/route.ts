import { NextRequest, NextResponse } from "next/server";
import { LOCALE_COOKIE } from "@/i18n/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const l = req.nextUrl.searchParams.get("l") === "en" ? "en" : "es";
  let next = req.nextUrl.searchParams.get("next") || "/";
  if (!next.startsWith("/") || next.startsWith("//")) next = "/";
  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set(LOCALE_COOKIE, l, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const user = await getCurrentUser().catch(() => null);
  if (user) await db.user.update({ where: { id: user.id }, data: { locale: l } });
  return res;
}
