import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { appUrl } from "@/lib/stripe";
import { ensureRefCode } from "@/lib/referral";
import { getNumberSetting } from "@/lib/settings";
import { AccountHeader, AccountShell, StatTile } from "@/components/account/AccountShell";
import { CopyLink } from "@/components/account/CopyLink";

export const metadata = { title: "Invite & earn" };

const mask = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.map((p, i) => (i === 0 ? p : `${p[0] ?? ""}.`)).join(" ");
};

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const user = await requireUser();
  const { locale } = await getT();
  const es = locale === "es";
  const { f } = await searchParams;
  const [code, reward] = await Promise.all([ensureRefCode(user.id), getNumberSetting("referral_reward")]);
  const link = `${appUrl()}/?ref=${code}`;
  const [refs, earned] = await Promise.all([
    db.user.findMany({ where: { referredById: user.id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, name: true, createdAt: true } }),
    db.creditTransaction.aggregate({ where: { userId: user.id, type: "REFERRAL" }, _sum: { amount: true } }),
  ]);
  const paidRefs = new Set(
    (await db.creditTransaction.findMany({ where: { externalRef: { in: refs.map((r) => `ref_${r.id}`) } }, select: { externalRef: true } })).map((x) => x.externalRef!.slice(4)),
  );
  const pending = refs.filter((r) => !paidRefs.has(r.id)).length;
  const shown = f === "paid" ? refs.filter((r) => paidRefs.has(r.id)) : f === "pending" ? refs.filter((r) => !paidRefs.has(r.id)) : refs;
  const tab = (key: string | undefined, label: string) => (
    <Link href={key ? `/invite?f=${key}` : "/invite"} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${f === key || (!f && !key) ? "bg-lime text-ink" : "text-muted"}`}>
      {label}
    </Link>
  );

  return (
    <AccountShell user={user}>
      <AccountHeader title={es ? "Invita y gana" : "Invite & earn"} sub={es ? "Comparte KIXO y gana créditos gratis" : "Share KIXO and earn free credits"} />

      <div className="relative overflow-hidden rounded-2xl border border-lime/40 bg-gradient-to-br from-lime/10 via-panel to-panel p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -bottom-16 h-52 w-52 rounded-full bg-teal/20 blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-lime text-2xl text-ink">🎁</span>
            <div>
              <div className="text-lg font-extrabold">
                {es ? `Gana ${reward} créditos por cada amigo` : `Earn ${reward} credits for every friend`}
              </div>
              <p className="text-sm text-muted">
                {es
                  ? "Tu amigo se registra con tu enlace y, cuando hace su primera compra o suscripción, recibes los créditos automáticamente."
                  : "Your friend signs up with your link and, when they make their first purchase or subscribe, you get the credits automatically."}
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(es ? ["1 · Comparte tu enlace", "2 · Tu amigo se registra", "3 · Paga y tú ganas"] : ["1 · Share your link", "2 · Friend signs up", "3 · They pay, you earn"]).map((s) => (
              <div key={s} className="rounded-xl border border-line bg-ink/40 px-3 py-2 text-xs font-bold text-teal">{s}</div>
            ))}
          </div>
          <CopyLink link={link} es={es} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label={es ? "Ganados" : "Earned"} value={earned._sum.amount ?? 0} accent />
        <StatTile label={es ? "Registrados" : "Signed up"} value={refs.length} />
        <StatTile label={es ? "Pendientes" : "Pending"} value={pending} />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
          <div>
            <div className="font-bold">{es ? "Tus invitados" : "Your referrals"}</div>
            <div className="text-xs text-muted">{refs.length} {es ? "registrados" : "signed up"} · {paidRefs.size} {es ? "pagaron" : "paid"}</div>
          </div>
          <div className="flex gap-1 rounded-xl border border-line p-1">
            {tab(undefined, es ? "Todos" : "All")}
            {tab("paid", es ? "Pagaron" : "Paid")}
            {tab("pending", es ? "Pendientes" : "Pending")}
          </div>
        </div>
        {shown.length ? (
          <ul className="divide-y divide-line">
            {shown.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-panel-2 text-sm font-bold">{r.name.trim()[0]?.toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{mask(r.name)}</span>
                  <span className="block text-[11px] text-muted">{r.createdAt.toLocaleDateString(locale)}</span>
                </span>
                {paidRefs.has(r.id) ? (
                  <span className="rounded-full bg-lime/15 px-2.5 py-1 text-[11px] font-bold text-lime">+{reward} ✓</span>
                ) : (
                  <span className="rounded-full border border-line px-2.5 py-1 text-[11px] font-bold text-muted">{es ? "Pendiente" : "Pending"}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-10 text-center text-sm text-muted">
            <div className="mb-2 text-3xl">🤝</div>
            {es ? "Aún no hay invitados. Comparte tu enlace para empezar a ganar." : "No referrals yet. Share your link to start earning."}
          </div>
        )}
      </div>
    </AccountShell>
  );
}
