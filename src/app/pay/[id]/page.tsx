import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { money, refreshPayLink, refreshPending } from "@/lib/paylinks";
import { PayLinkButton } from "@/components/PayLinkButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pay your order · KIXO", robots: { index: false, follow: false } };

/** The short code of a payment (shown on the payer's receipt and in the admin's list, so the two can be matched). */
const code = (id: string) => id.slice(-6).toUpperCase();

export default async function PayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string; p?: string }> }) {
  const { id } = await params;
  const { done, p } = await searchParams;
  let link = await db.payLink.findUnique({ where: { id } });
  if (!link) notFound();
  if (!link.multi && link.status === "open" && link.providerRef) {
    await refreshPayLink(link);
    link = (await db.payLink.findUnique({ where: { id } }))!;
  }
  // Open link (many payers): ?p=<id> is the receipt of ONE payment — the payer lands here after paying.
  let receipt = link.multi && typeof p === "string" && p ? await db.payLinkPayment.findFirst({ where: { id: p.slice(0, 60), linkId: id } }) : null;
  if (receipt?.status === "pending") {
    await refreshPending(receipt); // back from the provider's checkout page before its notice arrived
    receipt = await db.payLinkPayment.findUnique({ where: { id: receipt.id } });
  }
  if (receipt?.status === "removed") receipt = null;
  const { locale } = await getT();
  const es = locale === "es";
  const price = money(link.amountCents);
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="card space-y-5 p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted">{link.multi ? (es ? "Pago" : "Payment") : es ? "Pedido personalizado" : "Custom order"}</p>
        <h1 className="font-display text-3xl leading-tight">{link.title}</h1>
        {link.customer && <p className="text-sm text-muted">{es ? "Para" : "For"} <span className="font-semibold text-white">{link.customer}</span></p>}
        {link.description && <p className="whitespace-pre-line text-left text-sm text-muted">{link.description}</p>}
        <p className="font-display text-5xl text-lime">{price}</p>
        {link.multi ? (
          <>
            {receipt?.status === "paid" && (
              <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-green-300">
                <p className="font-bold">
                  ✅ {es ? "Pagado — ¡gracias" : "Paid — thank you"}
                  {receipt.payer ? `, ${receipt.payer}` : ""}!
                </p>
                <p className="mt-1 text-sm">
                  {money(receipt.amountCents)} · {es ? "Recibo" : "Receipt"} #{code(receipt.id)}
                </p>
                <p className="mt-1 text-xs text-green-200/80">{es ? "Guarda esta página o haz una captura: es tu comprobante." : "Keep this page or take a screenshot: it is your proof of payment."}</p>
              </div>
            )}
            {receipt?.status === "pending" && <p className="text-sm text-amber-200">{es ? "Estamos confirmando tu pago… recarga en unos segundos." : "Confirming your payment… refresh in a few seconds."}</p>}
            {link.status === "open" ? (
              <>
                {receipt?.status === "paid" && <p className="border-t border-line pt-4 text-sm font-semibold">{es ? "¿Vas a pagar por alguien más?" : "Paying for someone else too?"}</p>}
                <PayLinkButton id={link.id} label={`${es ? "Pagar" : "Pay"} ${price}`} title={link.title} price={price} es={es} multi />
                <p className="text-xs text-muted">{es ? "Pago seguro con tarjeta, Apple Pay o Google Pay. No necesitas cuenta." : "Secure checkout by card, Apple Pay or Google Pay. No account needed."}</p>
              </>
            ) : (
              <div className="rounded-xl border border-line p-4 text-muted">{es ? "Este enlace ya está cerrado: no acepta más pagos." : "This link is closed: it no longer takes payments."}</div>
            )}
          </>
        ) : link.status === "paid" ? (
          <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 font-bold text-green-300">
            ✅ {es ? "Pagado — ¡gracias! Ya estamos con tu pedido." : "Paid — thank you! We're on your order."}
          </div>
        ) : link.status === "canceled" ? (
          <div className="rounded-xl border border-line p-4 text-muted">{es ? "Este enlace ya no está activo. Pide uno nuevo en Discord." : "This link is no longer active. Ask for a new one on Discord."}</div>
        ) : (
          <>
            {done && <p className="text-sm text-amber-200">{es ? "Estamos confirmando tu pago… recarga en unos segundos." : "Confirming your payment… refresh in a few seconds."}</p>}
            <PayLinkButton id={link.id} label={`${es ? "Pagar" : "Pay"} ${price}`} title={link.title} price={price} es={es} />
            <p className="text-xs text-muted">{es ? "Pago seguro con tarjeta, Apple Pay o Google Pay. No necesitas cuenta." : "Secure checkout by card, Apple Pay or Google Pay. No account needed."}</p>
          </>
        )}
      </div>
    </div>
  );
}
