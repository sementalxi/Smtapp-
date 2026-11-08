import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { money, refreshPayLink } from "@/lib/paylinks";
import { PayLinkButton } from "@/components/PayLinkButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pay your order · KIXO", robots: { index: false, follow: false } };

export default async function PayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const { id } = await params;
  const { done } = await searchParams;
  let link = await db.payLink.findUnique({ where: { id } });
  if (!link) notFound();
  if (link.status === "open" && link.providerRef) {
    await refreshPayLink(link);
    link = (await db.payLink.findUnique({ where: { id } }))!;
  }
  const { locale } = await getT();
  const es = locale === "es";
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="card space-y-5 p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted">{es ? "Pedido personalizado" : "Custom order"}</p>
        <h1 className="font-display text-3xl leading-tight">{link.title}</h1>
        {link.customer && <p className="text-sm text-muted">{es ? "Para" : "For"} <span className="font-semibold text-white">{link.customer}</span></p>}
        {link.description && <p className="whitespace-pre-line text-left text-sm text-muted">{link.description}</p>}
        <p className="font-display text-5xl text-lime">{money(link.amountCents)}</p>
        {link.status === "paid" ? (
          <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 font-bold text-green-300">
            ✅ {es ? "Pagado — ¡gracias! Ya estamos con tu pedido." : "Paid — thank you! We're on your order."}
          </div>
        ) : link.status === "canceled" ? (
          <div className="rounded-xl border border-line p-4 text-muted">{es ? "Este enlace ya no está activo. Pide uno nuevo en Discord." : "This link is no longer active. Ask for a new one on Discord."}</div>
        ) : (
          <>
            {done && <p className="text-sm text-amber-200">{es ? "Estamos confirmando tu pago… recarga en unos segundos." : "Confirming your payment… refresh in a few seconds."}</p>}
            <PayLinkButton id={link.id} label={`${es ? "Pagar" : "Pay"} ${money(link.amountCents)}`} es={es} />
            <p className="text-xs text-muted">{es ? "Pago seguro con tarjeta, Apple Pay o Google Pay. No necesitas cuenta." : "Secure checkout by card, Apple Pay or Google Pay. No account needed."}</p>
          </>
        )}
      </div>
    </div>
  );
}
