import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { paymentProvider } from "@/lib/payments";
import { paymentsOfLinks } from "@/lib/paylinks";
import { PayLinksManager, type AdminPayLink } from "@/components/admin/PayLinksManager";

export const dynamic = "force-dynamic";

export default async function AdminPayLinks() {
  await requireAdmin();
  const { locale } = await getT();
  const es = locale === "es";
  const rows = await db.payLink.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  // open links (many payers): everyone who paid, oldest first
  const paid = await paymentsOfLinks(rows.filter((l) => l.multi).map((l) => l.id));
  const links: AdminPayLink[] = rows.map((l) => ({ id: l.id, title: l.title, description: l.description, amountCents: l.amountCents, customer: l.customer, note: l.note, status: l.status, multi: l.multi, payments: paid[l.id] ?? [], paidAt: l.paidAt?.toISOString() ?? "", createdAt: l.createdAt.toISOString() }));
  const provider = paymentProvider();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">{es ? "Enlaces de pago" : "Payment links"}</h1>
      <p className="text-sm text-muted">
        {es
          ? "Pon qué es y cuánto cuesta, copia el enlace y mándalo. Se paga sin cuenta. Un solo pago: para un pedido de una persona, y aquí verás ✅ Pagado. Abierto para todos: lo pagan muchas personas (inscripciones, torneos) y aquí verás quién pagó."
          : "Say what it is and the price, copy the link and send it. People pay without an account. One payment: for one person's order, and you'll see ✅ Paid here. Open for everyone: many people pay it (entry fees, tournaments) and you'll see who paid here."}
        {provider ? ` (${provider === "square" ? "Square" : "Stripe"})` : ""}
      </p>
      {!provider && <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">{es ? "No hay pagos configurados (Square o Stripe) — los enlaces no podrán cobrar." : "No payments are set up (Square or Stripe) — links won't be able to charge."}</p>}
      <PayLinksManager initial={links} />
    </div>
  );
}
