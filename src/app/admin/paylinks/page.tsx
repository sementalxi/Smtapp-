import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { paymentProvider } from "@/lib/payments";
import { PayLinksManager, type AdminPayLink } from "@/components/admin/PayLinksManager";

export const dynamic = "force-dynamic";

export default async function AdminPayLinks() {
  await requireAdmin();
  const { locale } = await getT();
  const es = locale === "es";
  const rows = await db.payLink.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const links: AdminPayLink[] = rows.map((l) => ({ id: l.id, title: l.title, description: l.description, amountCents: l.amountCents, customer: l.customer, note: l.note, status: l.status, paidAt: l.paidAt?.toISOString() ?? "", createdAt: l.createdAt.toISOString() }));
  const provider = paymentProvider();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">{es ? "Enlaces de pago" : "Payment links"}</h1>
      <p className="text-sm text-muted">
        {es ? "Para pedidos personalizados: pon qué es y cuánto cuesta, copia el enlace y mándaselo al cliente. Paga sin cuenta y aquí verás ✅ Pagado." : "For custom orders: say what it is and the price, copy the link and send it to the customer. They pay without an account and you'll see ✅ Paid here."}
        {provider ? ` (${provider === "square" ? "Square" : "Stripe"})` : ""}
      </p>
      {!provider && <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">{es ? "No hay pagos configurados (Square o Stripe) — los enlaces no podrán cobrar." : "No payments are set up (Square or Stripe) — links won't be able to charge."}</p>}
      <PayLinksManager initial={links} />
    </div>
  );
}
