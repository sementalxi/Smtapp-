import Link from "next/link";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { TxTable } from "@/components/TxTable";
import { LaunchControls } from "@/components/admin/LaunchControls";
import { aiConfigured } from "@/lib/banners";
import { webhookSecret } from "@/lib/stripe";
import { ConnectStripeButton } from "@/components/admin/ConnectStripeButton";
import { ConnectSquareButton } from "@/components/admin/ConnectSquareButton";
import { squareWebhookConfig } from "@/lib/square";

export default async function AdminHome() {
  await requireAdmin();
  const { t, locale } = await getT();
  const es = locale === "es";
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [users, banners, revenue, subs, gens, credits, recentTx, newUsers, failed] = await Promise.all([
    db.user.count(),
    db.banner.count(),
    db.payment.aggregate({ where: { createdAt: { gte: since } }, _sum: { amountCents: true } }),
    db.user.count({ where: { subscriptionStatus: { in: ["active", "trialing", "canceling", "comp"] } } }),
    db.creditTransaction.count({ where: { type: "GENERATION", createdAt: { gte: since } } }),
    db.user.aggregate({ _sum: { credits: true } }),
    db.creditTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { user: { select: { id: true, email: true } }, admin: { select: { email: true } } },
    }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, email: true, credits: true, createdAt: true } }),
    db.banner.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
  ]);

  // Shows what the server sees for each key — never the key itself.
  const describe = (v: string | undefined): [string, boolean] => {
    if (v === undefined) return [es ? "falta" : "missing", false];
    const trimmed = v.trim();
    if (!trimmed) return [es ? "puesta pero VACÍA" : "set but EMPTY", false];
    const note = trimmed !== v ? (es ? " (tiene espacios extra)" : " (has extra spaces/newline)") : "";
    return [es ? `puesta, ${trimmed.length} caracteres, empieza con "${trimmed.slice(0, 7)}"${note}` : `set, ${trimmed.length} characters, starts with "${trimmed.slice(0, 7)}"${note}`, true];
  };
  const setup = (
    [
      [es ? "OPENAI_API_KEY (IA Pro — necesaria)" : "OPENAI_API_KEY (Pro AI — required)", process.env.OPENAI_API_KEY, false],
      ["DATABASE_URL", process.env.DATABASE_URL, false],
      [es ? "SQUARE_ACCESS_TOKEN (pagos — necesaria para vender créditos)" : "SQUARE_ACCESS_TOKEN (payments — needed to sell credits)", process.env.SQUARE_ACCESS_TOKEN, false],
      [es ? "DISCORD_CLIENT_ID (entrar con Discord — solo números)" : "DISCORD_CLIENT_ID (sign in with Discord — numbers only)", process.env.DISCORD_CLIENT_ID, true],
      [es ? "DISCORD_CLIENT_SECRET (entrar con Discord — 32 caracteres)" : "DISCORD_CLIENT_SECRET (sign in with Discord — 32 characters)", process.env.DISCORD_CLIENT_SECRET, true],
      [es ? "DISCORD_BOT_TOKEN (tu bot — mensajes a usuarios)" : "DISCORD_BOT_TOKEN (your bot — messages to users)", process.env.DISCORD_BOT_TOKEN, true],
      [es ? "DISCORD_GUILD_ID (ID de tu servidor — unirse solo)" : "DISCORD_GUILD_ID (your server ID — auto-join)", process.env.DISCORD_GUILD_ID, true],
      [es ? "PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET (pagar con PayPal)" : "PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET (pay with PayPal)", process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET, true],
      [es ? "RESEND_API_KEY (enviar emails de promoción)" : "RESEND_API_KEY (send promo emails)", process.env.RESEND_API_KEY, true],
      [es ? "SQUARE_APPLICATION_ID (pago en ventana dentro de la página)" : "SQUARE_APPLICATION_ID (pay in a popup on the page)", process.env.SQUARE_APPLICATION_ID, true],
      [es ? "Vercel Blob (imágenes y video — BLOB_STORE_ID o BLOB_READ_WRITE_TOKEN)" : "Vercel Blob (images & video — BLOB_STORE_ID or BLOB_READ_WRITE_TOKEN)", process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID, true],
      [es ? "FAL_KEY (videos con IA — Kling)" : "FAL_KEY (AI videos — Kling)", process.env.FAL_KEY, true],
      [es ? "SERPER_API_KEY (búsqueda en Google, opcional)" : "SERPER_API_KEY (Google photo search, optional)", process.env.SERPER_API_KEY, true],
      [es ? "REPLICATE_API_TOKEN (modo rápido antiguo, no se usa)" : "REPLICATE_API_TOKEN (old Quick mode, not used)", process.env.REPLICATE_API_TOKEN, true],
      [es ? "STRIPE_SECRET_KEY (no se usa con Square)" : "STRIPE_SECRET_KEY (not needed with Square)", process.env.STRIPE_SECRET_KEY, true],
    ] as const
  ).map(([name, v, optional]) => {
    if (name.startsWith("DISCORD_BOT_TOKEN") && v?.trim()) {
      const n = v.trim().length; // never show any part of the token
      return [name, es ? `puesto, ${n} caracteres${v.trim().split(".").length === 3 ? " ✓ (formato de token de bot)" : " — no parece un token de bot"}` : `set, ${n} characters${v.trim().split(".").length === 3 ? " ✓ (bot token format)" : " — doesn't look like a bot token"}`, v.trim().split(".").length === 3, optional] as const;
    }
    if (name.startsWith("DISCORD_CLIENT_SECRET") && v?.trim()) {
      // Never show any part of the secret — only whether it looks right.
      const t2 = v.trim();
      const msg =
        t2.includes(".") || t2.length > 40
          ? es ? `${t2.length} caracteres — esto parece el TOKEN DEL BOT, no el Client Secret` : `${t2.length} characters — this looks like the BOT TOKEN, not the Client Secret`
          : /^[0-9a-f]{64}$/i.test(t2)
            ? es ? "parece la PUBLIC KEY, no el Client Secret" : "looks like the PUBLIC KEY, not the Client Secret"
            : t2.length !== 32
              ? es ? `${t2.length} caracteres — el Client Secret tiene 32` : `${t2.length} characters — a Client Secret has 32`
              : es ? "32 caracteres ✓ (formato correcto)" : "32 characters ✓ (right format)";
      return [name, msg + (t2 !== v ? (es ? " (tiene espacios extra)" : " (has extra spaces)") : ""), t2.length === 32 && !t2.includes("."), optional] as const;
    }
    if (name.startsWith("DISCORD_CLIENT_ID") && v?.trim() && !/^\d{15,22}$/.test(v.trim())) {
      return [name, es ? `no es un Client ID válido (debe ser solo números) — empieza con "${v.trim().slice(0, 6)}"` : `not a valid Client ID (should be numbers only) — starts with "${v.trim().slice(0, 6)}"`, false, optional] as const;
    }
    return [name, ...describe(v), optional] as const;
  });

  const stats = [
    [t("stat_users"), users],
    [t("stat_banners"), banners],
    [t("stat_revenue"), `$${((revenue._sum.amountCents ?? 0) / 100).toFixed(2)}`],
    [t("stat_subs"), subs],
    [t("stat_gens"), gens],
    [t("stat_credits"), credits._sum.credits ?? 0],
  ] as const;

  const hasSquare = !!process.env.SQUARE_ACCESS_TOKEN?.trim();
  const squareConnected = hasSquare && !!(await squareWebhookConfig()).key;
  const hasStripe = !hasSquare && !!process.env.STRIPE_SECRET_KEY;
  const hasWebhook = hasStripe && !!(await webhookSecret());
  const warnings = [
    !aiConfigured() && (es ? "La IA no está configurada (REPLICATE_API_TOKEN / OPENAI_API_KEY) — las generaciones van en modo demo gratis." : "AI is not configured (REPLICATE_API_TOKEN / OPENAI_API_KEY) — generations run in free demo mode."),
    !hasSquare && !process.env.STRIPE_SECRET_KEY && (es ? "Pagos apagados (sin SQUARE_ACCESS_TOKEN). Los botones de compra muestran “Próximamente”; igual puedes dar créditos aquí." : "Payments are off (no SQUARE_ACCESS_TOKEN). Buy buttons show “Coming soon”; you can still add credits to users here."),
    hasSquare && !squareConnected && (es ? "Square no está conectado — toca “Conectar Square” abajo o los créditos pagados no llegarán." : "Square isn't connected yet — click “Connect Square” below, or paid credits won't be delivered."),
    hasStripe && !hasWebhook && (es ? "El webhook de Stripe no está conectado — toca “Conectar Stripe” abajo o los créditos pagados no llegarán." : "Stripe webhook isn't connected yet — click “Connect Stripe” below, or paid credits won't be delivered."),
    process.env.STORAGE_DRIVER !== "s3" &&
      !process.env.BLOB_READ_WRITE_TOKEN &&
      !process.env.BLOB_STORE_ID &&
      process.env.NODE_ENV === "production" &&
      (es ? "Las imágenes se guardan en la base de datos (bien para pruebas). Con muchos usuarios, conecta Vercel Blob." : "Images are being stored in the database (fine for testing). For lots of users, connect Vercel Blob storage."),
    failed > 0 && (es ? `${failed} generación(es) fallida(s) en 30 días — mira Banners para ver los errores.` : `${failed} failed generation(s) in the last 30 days — see Banners for errors.`),
  ].filter(Boolean) as string[];

  const actions = [
    ["/admin/studio", "🎨", es ? "Crear un flyer" : "Make a flyer"],
    ["/admin/discord", "💬", es ? "Mensaje Discord" : "Discord message"],
    ["/admin/email", "✉️", es ? "Enviar email" : "Send email"],
    ["/admin/deals", "🔥", es ? "Ofertas" : "Deals"],
    ["/admin/templates", "🖼️", es ? "Estilos" : "Styles"],
    ["/admin/users", "👥", es ? "Usuarios" : "Users"],
    ["/admin/settings", "💲", es ? "Precios" : "Prices"],
    ["/admin/banners", "🧾", es ? "Pósters creados" : "Posters made"],
  ] as const;
  const missing = setup.filter(([, , ok, optional]) => !ok && !optional).length;

  const okCount = setup.filter(([, , ok]) => ok).length;
  const short = (n: string) => n.split(" (")[0];
  const why = (n: string) => (n.includes(" (") ? n.slice(n.indexOf(" (") + 2, -1) : "");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-display text-4xl">{t("admin_overview")}</h1>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
          {hasSquare && <span className={`rounded-full border px-2.5 py-1 ${squareConnected ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-amber-400/40 bg-amber-400/10 text-amber-200"}`}>💳 Square {squareConnected ? "✓" : "!"}</span>}
          <span className={`rounded-full border px-2.5 py-1 ${missing ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"}`}>⚙️ {missing ? `${missing} ${es ? "falta(n)" : "missing"}` : es ? "Todo bien" : "All good"}</span>
        </div>
      </div>

      {/* Numbers */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-gradient-to-br from-panel-2 to-panel p-3 sm:p-4">
            <div className="line-clamp-1 text-[9px] font-bold uppercase tracking-widest text-muted sm:text-[10px]">{label}</div>
            <div className="font-display mt-1 text-2xl tabular-nums sm:text-4xl">{value}</div>
          </div>
        ))}
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-1.5">
          {warnings.map((w) => (
            <li key={w} className="flex gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-100">
              <span>⚠️</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Quick actions */}
      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">{es ? "Acciones rápidas" : "Quick actions"}</div>
        <div className="grid grid-cols-4 gap-2">
          {actions.map(([href, icon, label]) => (
            <Link key={href} href={href} className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-panel/70 px-1 py-3 text-center transition hover:border-lime/50 active:scale-95">
              <span className="text-2xl">{icon}</span>
              <span className="text-[11px] font-bold leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Launch, Discord role, support — folded so the page stays clean */}
      <details className="group card overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime/15 text-xl">🚀</span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{es ? "Lanzamiento, rol de Discord y soporte" : "Launch, Discord role & support"}</span>
            <span className="block text-xs text-muted">{es ? "Modo Muy pronto · rol al conectar · chat de soporte" : "Coming soon mode · link role · support chat"}</span>
          </span>
          <span className="text-muted transition group-open:rotate-180">▾</span>
        </summary>
        <div className="border-t border-line p-2 sm:p-3">
          <LaunchControls es={es} />
        </div>
      </details>

      {hasStripe && !hasWebhook && <ConnectStripeButton es={es} />}
      {hasSquare && !squareConnected && <ConnectSquareButton es={es} connected={squareConnected} />}

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 pb-2">
            <h2 className="font-bold">{t("admin_tx")}</h2>
            <Link href="/admin/transactions" className="text-xs font-bold text-lime">{t("all")} →</Link>
          </div>
          <div className="md:overflow-x-auto">
            <TxTable rows={recentTx} locale={locale} showUser />
          </div>
        </div>
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">{es ? "Usuarios nuevos" : "New users"}</h2>
            <Link href="/admin/users" className="text-xs font-bold text-lime">{t("all")} →</Link>
          </div>
          <ul className="divide-y divide-line text-sm">
            {newUsers.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="flex items-center justify-between gap-2 py-2 hover:text-lime">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-panel-2 text-xs font-bold">{u.email[0].toUpperCase()}</span>
                    <span className="truncate">{u.email}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">⚡{u.credits}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {hasSquare && squareConnected && <ConnectSquareButton es={es} connected={squareConnected} />}

      {/* Setup check — clear ✓ / ✗ list */}
      <details className="group card overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-panel-2 text-xl">⚙️</span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{es ? "Revisión de configuración" : "Setup check"}</span>
            <span className={`block text-xs ${missing ? "text-amber-200" : "text-emerald-300"}`}>
              {missing ? `${missing} ${es ? "necesaria(s) falta(n)" : "required missing"}` : es ? `Todo bien · ${okCount} conectadas` : `All good · ${okCount} connected`}
            </span>
          </span>
          <span className="text-muted transition group-open:rotate-180">▾</span>
        </summary>
        <ul className="divide-y divide-line border-t border-line">
          {setup.map(([name, status, ok, optional]) => (
            <li key={name} className="flex items-start gap-3 px-4 py-2.5">
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black ${ok ? "bg-emerald-400/15 text-emerald-300" : optional ? "bg-panel-2 text-muted" : "bg-danger/15 text-danger"}`}>{ok ? "✓" : optional ? "–" : "✗"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs font-bold text-white/90">{short(name)}</span>
                <span className="block text-[11px] text-muted">{why(name)}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${ok ? "bg-emerald-400/10 text-emerald-300" : optional ? "bg-panel-2 text-muted" : "bg-danger/10 text-danger"}`} title={status}>
                {ok ? (es ? "Conectada" : "Connected") : optional ? (es ? "Opcional" : "Optional") : es ? "Falta" : "Missing"}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
