import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Refund Policy \u00b7 KIXO" };

const EN = {
  "title": "Refund Policy",
  "updated": "Last updated: November 8, 2026",
  "intro": "We want you to be happy with KIXO. This is how refunds work.",
  "sections": [
    {
      "h": "Failed designs",
      "p": [
        "If a design fails to generate, the credits are returned to your balance automatically — you don't need to ask."
      ]
    },
    {
      "h": "Credit packs",
      "p": [
        "Credit packs are digital and delivered instantly. Unused packs can be refunded within 7 days of purchase if none of the pack's credits have been used. Contact Live support with your account email and the purchase date."
      ]
    },
    {
      "h": "Monthly plans",
      "p": [
        "You can cancel a plan at any time from your account; it stays active until the end of the period you paid for and won't renew. We don't refund partial months, except where the law requires it or if you were charged by mistake."
      ]
    },
    {
      "h": "Custom orders",
      "p": [
        "Custom designs paid through a KIXO payment link can be refunded before work starts. Once we've started or delivered the design, refunds are decided case by case."
      ]
    },
    {
      "h": "Charged by mistake?",
      "p": [
        "If you were charged twice or by mistake, contact Live support on kixo.pro and we'll fix it. Approved refunds go back to the original payment method and can take 5–10 business days to appear."
      ]
    }
  ]
};
const ES = {
  "title": "Política de reembolsos",
  "updated": "Última actualización: 8 de noviembre de 2026",
  "intro": "Queremos que estés contento con KIXO. Así funcionan los reembolsos.",
  "sections": [
    {
      "h": "Diseños que fallan",
      "p": [
        "Si un diseño falla al generarse, los créditos vuelven a tu saldo automáticamente — no necesitas pedirlo."
      ]
    },
    {
      "h": "Paquetes de créditos",
      "p": [
        "Los paquetes de créditos son digitales y se entregan al instante. Un paquete se puede reembolsar dentro de 7 días después de la compra si no se usó ninguno de sus créditos. Escribe al Soporte en vivo con el correo de tu cuenta y la fecha de compra."
      ]
    },
    {
      "h": "Planes mensuales",
      "p": [
        "Puedes cancelar un plan cuando quieras desde tu cuenta; sigue activo hasta el final del periodo pagado y no se renueva. No reembolsamos meses parciales, salvo cuando la ley lo exija o si se te cobró por error."
      ]
    },
    {
      "h": "Pedidos personalizados",
      "p": [
        "Los diseños personalizados pagados con un enlace de pago de KIXO se pueden reembolsar antes de empezar el trabajo. Si ya empezamos o entregamos el diseño, se decide caso por caso."
      ]
    },
    {
      "h": "¿Te cobramos por error?",
      "p": [
        "Si se te cobró dos veces o por error, escribe al Soporte en vivo en kixo.pro y lo arreglamos. Los reembolsos aprobados vuelven al método de pago original y pueden tardar 5–10 días hábiles."
      ]
    }
  ]
};

export default async function RefundsPage() {
  const { locale } = await getT();
  const d = locale === "es" ? ES : EN;
  return <LegalPage {...d} />;
}
