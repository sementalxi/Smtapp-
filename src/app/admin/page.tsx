import Link from "next/link";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { TxTable } from "@/components/TxTable";
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
    db.user.count({ where: { subscriptionStatus: { in: ["active", "trialing", "canceling"] } } }),
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
      [es ? "TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN (SMS, opcional)" : "TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN (SMS, optional)", process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN, true],
      [es ? "TWILIO_VERIFY_SID (verificar teléfono al registrarse)" : "TWILIO_VERIFY_SID (phone check at sign-up)", process.env.TWILIO_VERIFY_SID, true],
      [es ? "TWILIO_FROM (número que envía los pósters por mensaje)" : "TWILIO_FROM (number that texts the posters)", process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SID, true],
      [es ? "BLOB_READ_WRITE_TOKEN (subir video de fondo)" : "BLOB_READ_WRITE_TOKEN (upload background video)", process.env.BLOB_READ_WRITE_TOKEN, true],
      [es ? "SERPER_API_KEY (búsqueda en Google, opcional)" : "SERPER_API_KEY (Google photo search, optional)", process.env.SERPER_API_KEY, true],
      [es ? "REPLICATE_API_TOKEN (modo rápido antiguo, no se usa)" : "REPLICATE_API_TOKEN (old Quick mode, not used)", process.env.REPLICATE_API_TOKEN, true],
      [es ? "STRIPE_SECRET_KEY (no se usa con Square)" : "STRIPE_SECRET_KEY (not needed with Square)", process.env.STRIPE_SECRET_KEY, true],
    ] as const
  ).map(([name, v, optional]) => [name, ...describe(v), optional] as const);

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
      process.env.NODE_ENV === "production" &&
      (es ? "Las imágenes se guardan en la base de datos (bien para pruebas). Con muchos usuarios, conecta Vercel Blob." : "Images are being stored in the database (fine for testing). For lots of users, connect Vercel Blob storage."),
    failed > 0 && (es ? `${failed} generación(es) fallida(s) en 30 días — mira Banners para ver los errores.` : `${failed} failed generation(s) in the last 30 days — see Banners for errors.`),
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl">{t("admin_overview")}</h1>

      {warnings.length > 0 && (
        <ul className="card space-y-1 border-amber-400/40 p-4 text-sm text-amber-200">
          {warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}

      {hasStripe && !hasWebhook && <ConnectStripeButton es={es} />}
      {hasSquare && <ConnectSquareButton es={es} connected={squareConnected} />}

      <div className="card p-4 text-sm">
        <div className="mb-2 font-bold">{es ? "Revisión de configuración" : "Setup check"}</div>
        <ul className="space-y-1 break-words font-mono text-xs">
          {setup.map(([name, status, ok, optional]) => (
            <li key={name} className={ok ? "text-lime" : optional ? "text-muted" : "text-danger"}>
              {ok ? "✓" : optional ? "–" : "✗"} {name}: {status}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="card p-5">
            <div className="label">{label}</div>
            <div className="font-display text-4xl">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between p-4">
            <h2 className="font-bold">{t("admin_tx")}</h2>
            <Link href="/admin/transactions" className="text-xs text-lime">{t("all")} →</Link>
          </div>
          <TxTable rows={recentTx} locale={locale} showUser />
        </div>
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">{t("admin_users")}</h2>
            <Link href="/admin/users" className="text-xs text-lime">{t("all")} →</Link>
          </div>
          <ul className="space-y-2 text-sm">
            {newUsers.map((u) => (
              <li key={u.id} className="flex justify-between gap-2">
                <Link href={`/admin/users/${u.id}`} className="truncate hover:text-lime">{u.email}</Link>
                <span className="text-muted">⚡{u.credits}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
