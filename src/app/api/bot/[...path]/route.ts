import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { SESSION_COOKIE, signSession } from "@/lib/session";
import { getNumberSetting } from "@/lib/settings";
import { makesFree } from "@/lib/auth";
import { activeTemplates } from "@/lib/queries";
import { thumb } from "@/lib/thumb";

// Private API for your Discord bot (KIXO Studio in Discord). The bot sends the shared secret KIXO_BOT_SECRET.
// It acts as the KIXO account linked to that Discord user — same credits, styles and history as the website.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const site = () => (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");
const j = (d: unknown, status = 200) => NextResponse.json(d, { status });

function authorized(req: NextRequest) {
  const s = process.env.KIXO_BOT_SECRET?.trim();
  const got = req.headers.get("x-kixo-bot") ?? "";
  if (!s || got.length !== s.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(s));
}

async function userFor(discordId: string | null) {
  if (!discordId || !/^\d{15,22}$/.test(discordId)) return null;
  return db.user.findFirst({ where: { discordId, banned: false } });
}

/** Calls one of the website's own API routes as that user (same rules, charging and history as the site). */
async function asUser(userId: string, path: string, init: RequestInit = {}) {
  const cookie = `${SESSION_COOKIE}=${await signSession(userId)}`;
  return fetch(`${site()}${path}`, { ...init, headers: { ...(init.headers ?? {}), cookie }, signal: AbortSignal.timeout(55000) });
}

/** Image hosts the bot may send: Discord's CDN and any public https site (league / team logos) — never an IP or local name. */
function publicHost(host: string) {
  const h = host.toLowerCase();
  if (/(^|\.)discordapp\.(com|net)$/.test(h)) return true;
  if (!h.includes(".") || /^[\d.]+$/.test(h) || h.includes(":") || /(^|\.)(localhost|local|internal|lan)$/.test(h)) return false;
  return true;
}

/** Discord attachment → stored on KIXO as that user (the AI and saved teams only take our own files). */
async function rehostFor(userId: string, src: string | undefined, kind: "photo" | "logo") {
  if (!src) return null;
  // Already on KIXO (saved team / league logo) — use as is.
  if (src.startsWith(site() + "/")) return src.slice(site().length);
  if (src.startsWith("/") || /\.blob\.vercel-storage\.com\//.test(src)) return src;
  const s = new URL(src);
  if (s.protocol !== "https:" || !publicHost(s.hostname)) throw new Error("bad_image_host");
  const img = await fetch(s, { signal: AbortSignal.timeout(15000), redirect: "error" });
  if (!img.ok) throw new Error("image_download_failed");
  const type = img.headers.get("content-type") ?? "image/jpeg";
  if (!/^image\/(png|jpe?g|webp|gif)/i.test(type)) throw new Error("not_an_image");
  if (Number(img.headers.get("content-length") ?? 0) > 8 * 1024 * 1024) throw new Error("image_too_large");
  const fd = new FormData();
  fd.append("file", new Blob([await img.arrayBuffer()], { type }), `discord.${type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg"}`);
  fd.append("kind", kind);
  const up = await asUser(userId, "/api/upload", { method: "POST", body: fd });
  const d = await up.json().catch(() => ({}));
  if (!d.url) throw new Error(d.error ?? "upload_failed");
  return d.url as string;
}

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!authorized(req)) return j({ error: "unauthorized" }, 401);
  const action = (await params).path.join("/");
  const url = req.nextUrl;

  // Log lines sent by the Discord bot (batched).
  if (action === "log" && req.method === "POST") {
    const b = (await req.json().catch(() => ({}))) as { lines?: { level?: string; kind?: string; message?: string }[] };
    const { logActivity } = await import("@/lib/activity");
    for (const l of (b.lines ?? []).slice(0, 50)) {
      const level = l.level === "error" || l.level === "warn" ? l.level : "info";
      await logActivity("bot", String(l.kind ?? "log"), String(l.message ?? ""), level);
    }
    return j({ ok: true });
  }

  // Who is this Discord user on KIXO?
  if (action === "user") {
    const u = await userFor(url.searchParams.get("discordId"));
    const cost = await getNumberSetting("pro_cost");
    if (!u) {
      // Not on KIXO yet: nothing is created and no credits are given until they sign up on the website.
      const bonus = (await getNumberSetting("signup_credits").catch(() => 0)) + (await getNumberSetting("discord_bonus").catch(() => 0));
      return j({ linked: false, cost, bonus, signup: `${site()}/api/auth/discord` });
    }
    return j({ linked: true, name: u.name, credits: u.credits, cost: makesFree(u.role) ? 0 : cost }); // admins never use credits
  }

  // Styles this user may use for a type.
  if (action === "styles") {
    const u = await userFor(url.searchParams.get("discordId"));
    if (!u) return j({ error: "not_linked" }, 404);
    const type = (url.searchParams.get("type") ?? "").toUpperCase();
    const list = (await activeTemplates(u)).filter((t) => t.layout === type).slice(0, 25);
    return j({ styles: list.map((t) => ({ id: t.id, name: t.name, nameEs: t.nameEs, thumb: t.thumbUrl ? ((u) => (u.startsWith("/") ? site() + u : u))(thumb(t.thumbUrl, 480)) : null, badge: t.badge })) });
  }

  // Teams & competitions they can pick: their saved ones (My teams) + your league library.
  if (action === "teams") {
    const u = await userFor(url.searchParams.get("discordId"));
    if (!u) return j({ error: "not_linked" }, 404);
    const abs = (x: string | null) => (x ? (x.startsWith("/") ? site() + x : x) : null);
    const [mine, lib] = await Promise.all([
      db.savedItem.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.libraryItem.findMany({ where: { kind: { in: ["team", "championship"] } }, orderBy: [{ sort: "asc" }, { name: "asc" }], take: 100 }),
    ]);
    const pack = (kind: string) => [
      ...mine.filter((m) => m.kind === kind).map((m) => ({ id: `s:${m.id}`, name: m.name, logoUrl: abs(m.logoUrl), source: "mine", players: (() => { try { return m.players ? JSON.parse(m.players) : []; } catch { return []; } })() })),
      ...lib.filter((m) => m.kind === kind).map((m) => ({ id: `l:${m.id}`, name: m.name, logoUrl: abs(m.logoUrl), source: "league", players: [] })),
    ];
    return j({ teams: pack("team"), competitions: pack("championship") });
  }

  // Save a new team (name + optional logo sent in Discord) to the user's "My teams" — reused on the site and in the bot.
  if (action === "teams/create" && req.method === "POST") {
    const b = (await req.json().catch(() => ({}))) as { discordId?: string; name?: string; logoUrl?: string; kind?: string };
    const u = await userFor(b.discordId ?? null);
    if (!u) return j({ error: "not_linked" }, 404);
    const name = String(b.name ?? "").trim().slice(0, 40);
    if (!name) return j({ error: "name_required" }, 400);
    const kind = b.kind === "championship" ? "championship" : "team";
    let logoUrl: string | null = null;
    try {
      logoUrl = await rehostFor(u.id, b.logoUrl, "logo");
    } catch (e) {
      return j({ error: e instanceof Error ? e.message : "upload_failed" }, 400);
    }
    // Same name already saved? Update its logo instead of making a twin.
    const existing = await db.savedItem.findFirst({ where: { userId: u.id, kind, name: { equals: name, mode: "insensitive" } } });
    const item = existing
      ? await db.savedItem.update({ where: { id: existing.id }, data: { ...(logoUrl ? { logoUrl } : {}) } })
      : await db.savedItem.create({ data: { userId: u.id, kind, name, logoUrl } });
    const abs = (x: string | null) => (x ? (x.startsWith("/") ? site() + x : x) : null);
    return j({ team: { id: `s:${item.id}`, name: item.name, logoUrl: abs(item.logoUrl), source: "mine", players: [] }, updated: !!existing });
  }

  // Make a poster.
  if (action === "generate" && req.method === "POST") {
    const b = (await req.json().catch(() => ({}))) as { discordId?: string; templateId?: string; inputs?: Record<string, unknown>; photoUrl?: string; logoUrl?: string; season?: boolean };
    const u = await userFor(b.discordId ?? null);
    if (!u) return j({ error: "not_linked" }, 404);
    let photoUrl: string | null = null;
    let logoUrl: string | null = null;
    try {
      [photoUrl, logoUrl] = await Promise.all([rehostFor(u.id, b.photoUrl, "photo"), rehostFor(u.id, b.logoUrl, "logo")]);
    } catch (e) {
      return j({ error: e instanceof Error ? e.message : "upload_failed" }, 400);
    }
    const inputs = { ...(b.inputs ?? {}) } as Record<string, unknown>;
    // Crest / league logo links from the bot are stored on KIXO first (the AI only takes our own files).
    // The same picture is uploaded once; a logo that can't be fetched is simply left out.
    const cache = new Map<string, Promise<string | null>>();
    const own = (v: unknown): Promise<string> => {
      if (typeof v !== "string" || !v) return Promise.resolve("");
      if (!cache.has(v)) cache.set(v, rehostFor(u.id, v, "logo").catch(() => null));
      return cache.get(v)!.then((x) => x ?? "");
    };
    for (const k of ["homeLogoUrl", "awayLogoUrl", "champLogoUrl"]) inputs[k] = await own(inputs[k]);
    if (Array.isArray(inputs.tableLogos)) {
      const list = inputs.tableLogos.slice(0, 32);
      const out: string[] = [];
      for (let k = 0; k < list.length; k += 6) out.push(...(await Promise.all(list.slice(k, k + 6).map(own))));
      inputs.tableLogos = out;
    }
    const r = await asUser(u.id, "/api/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: b.templateId, inputs, photoUrl, logoUrl, mode: "PRO", ...(b.season ? { season: true } : {}) }),
    });
    const d = await r.json().catch(() => ({}));
    return j(d, r.status);
  }

  // Is it ready?
  if (action.startsWith("banner/")) {
    const u = await userFor(url.searchParams.get("discordId"));
    if (!u) return j({ error: "not_linked" }, 404);
    const r = await asUser(u.id, `/api/banners/${encodeURIComponent(action.slice(7))}`);
    const d = await r.json().catch(() => ({}));
    if (d.finalUrl && String(d.finalUrl).startsWith("/")) d.finalUrl = site() + d.finalUrl;
    return j({ ...d, page: `${site()}/banner/${action.slice(7)}` }, r.status);
  }

  return j({ error: "not_found" }, 404);
}

export { handler as GET, handler as POST };
