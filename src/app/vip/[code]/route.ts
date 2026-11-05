import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

/** Early-access link: a valid code unlocks the full site in this browser for a year (while "coming soon" is on). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const st = await getSettings();
  const res = NextResponse.redirect(new URL("/", req.url));
  if (st.vip_code && code === st.vip_code) {
    res.cookies.set("kixo_vip", code, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 365 * 24 * 60 * 60 });
  }
  return res;
}
