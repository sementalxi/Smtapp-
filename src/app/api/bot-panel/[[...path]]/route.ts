import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Shows your Discord bot's own control panel (running on Railway) inside KIXO admin.
// KIXO logs in to the bot server-side with BOT_DASHBOARD_PASSWORD — the browser never sees it,
// and only KIXO admins can reach this proxy.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const base = () => {
  const u = (process.env.BOT_PANEL_URL ?? "").trim().replace(/\/+$/, "");
  return u && !/^https?:\/\//i.test(u) ? `https://${u}` : u; // accept the address with or without https://
};
let session: { cookie: string; exp: number } | null = null;

async function login(force = false) {
  if (!force && session && session.exp > Date.now() + 60_000) return session.cookie;
  const password = (process.env.BOT_DASHBOARD_PASSWORD ?? "").trim();
  let last = "";
  // Control Center panel uses /api/login; the bot's built-in panel uses /api/admin/login.
  for (const path of ["/api/login", "/api/admin/login"]) {
    const r = await fetch(`${base()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-proto": "https" },
      body: JSON.stringify({ password }),
      signal: AbortSignal.timeout(15000),
    });
    const m = (r.headers.get("set-cookie") ?? "").match(/smt_admin=([^;]+)/);
    if (r.ok && m) {
      session = { cookie: `smt_admin=${m[1]}`, exp: Date.now() + 11 * 60 * 60_000 };
      return session.cookie;
    }
    const said = (await r.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
    last = `login ${r.status} at ${path} — panel said: ${said || "(nothing)"} — KIXO sent a ${password.length}-character password`;
    if (r.status === 429) break; // too many tries: stop
    if (r.status !== 404 && !(r.status === 401 && /Unauthorized/.test(said))) break; // real answer from this panel
  }
  throw new Error(last);
}

const P = "/api/bot-panel";
/** Points the panel's own links at this proxy. */
function rewrite(text: string) {
  return text
    .replace(/(["'`(])\/api\//g, `$1${P}/api/`)
    .replace(/((?:href|src|action)=["'])\/(?!\/|api\/bot-panel)/g, `$1${P}/`)
    .replace(/(["'`])\/admin\/(app\.css|app\.js|assets\/)/g, `$1${P}/admin/$2`)
    .replace(/url\((['"]?)\/(?!\/|api\/bot-panel)/g, `url($1${P}/`);
}

async function proxy(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const me = await getCurrentUser().catch(() => null);
  if (!me || me.role !== "ADMIN") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!base() || !process.env.BOT_DASHBOARD_PASSWORD) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const { path } = await params;
  const sub = (path ?? []).map(encodeURIComponent).join("/");
  // The panel's own login/logout are handled here (we're always logged in for KIXO admins).
  if (["api/admin/login", "api/admin/logout", "api/login", "api/logout"].includes(sub)) return NextResponse.json({ ok: true });
  const target = `${base()}/${sub}${req.nextUrl.search}`;
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text();
  const send = async (cookie: string) =>
    fetch(target, {
      method: req.method,
      headers: { cookie, "content-type": req.headers.get("content-type") ?? "application/json", "x-forwarded-proto": "https" },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(55000),
    });
  let res: Response;
  try {
    res = await send(await login());
    if (res.status === 401) res = await send(await login(true));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "offline";
    return NextResponse.json({ error: /login 401/.test(msg) ? `Bot password doesn't match — ${msg}` : `Bot panel problem — ${msg}` }, { status: 502 });
  }
  const type = res.headers.get("content-type") ?? "";
  const headers = new Headers({ "content-type": type || "application/octet-stream", "cache-control": "no-store" });
  if (/text\/html|javascript|text\/css/.test(type)) {
    let text = rewrite(await res.text());
    if (type.includes("text/html")) text = text.replace("</head>", `<style>#logoutBtn,#logout{display:none!important}</style></head>`);
    return new NextResponse(text, { status: res.status, headers });
  }
  return new NextResponse(res.body, { status: res.status, headers });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE, proxy as PATCH };
