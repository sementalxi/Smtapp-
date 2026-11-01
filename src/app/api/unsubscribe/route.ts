import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { unsubToken } from "@/lib/email";

async function unsub(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  const ok = !!u && t === unsubToken(u) && (await db.user.updateMany({ where: { id: u }, data: { emailOptOut: true } })).count > 0;
  return ok;
}

/** One-click unsubscribe (email apps POST here). */
export async function POST(req: NextRequest) {
  await unsub(req);
  return new NextResponse("ok");
}

/** Link in the email footer. */
export async function GET(req: NextRequest) {
  const ok = await unsub(req);
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#090d0b;color:#f1f8f3;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center;padding:20px">
<div><img src="/kixo-wordmark.png" alt="KIXO" style="height:40px"><h1 style="color:#b7ff45">${ok ? "You're unsubscribed · Te diste de baja" : "Link not valid · Enlace no válido"}</h1>
<p style="color:#9aaba1">${ok ? "You won't get promo emails anymore. · Ya no recibirás correos de promociones." : ""}</p><a href="/" style="color:#46d5ae">kixo.pro</a></div></body>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
