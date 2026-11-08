import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service \u00b7 KIXO" };

const EN = {
  "title": "Terms of Service",
  "updated": "Last updated: November 8, 2026",
  "intro": "These terms are the agreement between you and KIXO (kixo.pro) for using the website, the KIXO apps and the KIXO Discord bot. By creating an account or using KIXO you agree to them. If you don't agree, please don't use KIXO.",
  "sections": [
    {
      "h": "1. Your account",
      "p": [
        "You must be at least 13 years old to use KIXO (or the minimum age in your country, if higher). If you are under 18, use KIXO with a parent or guardian's permission.",
        "Give true information when you register. One account per person and per phone number. You are responsible for everything done with your account — keep your password private.",
        "We may suspend or close accounts that break these terms, abuse the service, try to get free credits through multiple accounts, or put other users at risk."
      ]
    },
    {
      "h": "2. Credits, plans and payments",
      "p": [
        "KIXO works with credits. You get some for free (sign-up, daily rewards, invites, promotions) and can buy more as one-time packs or monthly plans. Prices are shown in US dollars before you pay.",
        "Payments are processed by our payment partners (Square, PayPal and/or Stripe). KIXO never sees or stores your full card number.",
        "Credits have no cash value, can't be transferred or exchanged for money, and are only used inside KIXO. Monthly plans renew automatically until you cancel; you can cancel any time and keep your plan until the end of the period you paid for.",
        "Refunds are covered by our Refund Policy."
      ]
    },
    {
      "h": "3. What you upload",
      "p": [
        "You keep ownership of the photos, logos and texts you upload. You give KIXO permission to use them only to make your designs, show them to you, store them in your history and run the service.",
        "Only upload things you have the right to use. Don't upload photos of other people without their permission, and don't upload logos, trademarks or artwork that belong to someone else unless you are allowed to use them.",
        "You are responsible for what you upload and for how you use your designs."
      ]
    },
    {
      "h": "4. AI-made designs",
      "p": [
        "KIXO uses artificial intelligence to create images. Results can vary, may contain mistakes, and similar requests can give similar results to other users. Check your design before you publish it.",
        "Subject to these terms and to the rights of the material you uploaded, you may use the designs you make with KIXO for personal and commercial purposes (for example your team, league, stream or club).",
        "KIXO may show anonymised examples or use designs made with built-in sample content to promote the service. We won't publish your personal photos as examples without your permission."
      ]
    },
    {
      "h": "5. Things you may not do",
      "p": [
        "Don't use KIXO to create content that is illegal, sexual, hateful, harassing, violent, or that impersonates or defames a real person or organization.",
        "Don't try to break, overload, reverse-engineer or get around the limits or safety filters of KIXO, and don't resell access to the service.",
        "Don't use KIXO to infringe anyone's copyright, trademark or likeness rights."
      ]
    },
    {
      "h": "6. The service",
      "p": [
        "We work hard to keep KIXO running, but it is provided \"as is\" and may sometimes be unavailable, slow or changed. Generations that fail are refunded automatically in credits.",
        "We may add, change or remove features, styles and prices. If a change affects a plan you paid for, we'll tell you in advance."
      ]
    },
    {
      "h": "7. Liability",
      "p": [
        "To the extent allowed by law, KIXO is not liable for indirect or consequential damages, lost profits or lost data, and our total liability for any claim is limited to the amount you paid KIXO in the 3 months before the claim."
      ]
    },
    {
      "h": "8. Changes and contact",
      "p": [
        "We may update these terms. If the change is important we'll let you know on the site. Using KIXO after an update means you accept the new terms.",
        "Questions? Contact us through Live support on kixo.pro or in the KIXO Discord server."
      ]
    }
  ]
};
const ES = {
  "title": "Términos del servicio",
  "updated": "Última actualización: 8 de noviembre de 2026",
  "intro": "Estos términos son el acuerdo entre tú y KIXO (kixo.pro) para usar la web, las apps de KIXO y el bot de Discord de KIXO. Al crear una cuenta o usar KIXO los aceptas. Si no estás de acuerdo, por favor no uses KIXO.",
  "sections": [
    {
      "h": "1. Tu cuenta",
      "p": [
        "Debes tener al menos 13 años para usar KIXO (o la edad mínima de tu país, si es mayor). Si eres menor de 18, úsalo con permiso de tu madre, padre o tutor.",
        "Da información real al registrarte. Una cuenta por persona y por número de teléfono. Eres responsable de todo lo que se haga con tu cuenta — guarda tu contraseña en privado.",
        "Podemos suspender o cerrar cuentas que incumplan estos términos, abusen del servicio, intenten conseguir créditos gratis con varias cuentas o pongan en riesgo a otros usuarios."
      ]
    },
    {
      "h": "2. Créditos, planes y pagos",
      "p": [
        "KIXO funciona con créditos. Recibes algunos gratis (registro, recompensas diarias, invitaciones, promociones) y puedes comprar más en paquetes o planes mensuales. Los precios se muestran en dólares estadounidenses antes de pagar.",
        "Los pagos los procesan nuestros socios de pago (Square, PayPal y/o Stripe). KIXO nunca ve ni guarda el número completo de tu tarjeta.",
        "Los créditos no tienen valor en dinero, no se pueden transferir ni cambiar por dinero y solo se usan dentro de KIXO. Los planes mensuales se renuevan solos hasta que los canceles; puedes cancelar cuando quieras y mantienes el plan hasta el final del periodo pagado.",
        "Los reembolsos se rigen por nuestra Política de reembolsos."
      ]
    },
    {
      "h": "3. Lo que subes",
      "p": [
        "Las fotos, logos y textos que subes siguen siendo tuyos. Le das permiso a KIXO para usarlos solo para hacer tus diseños, mostrártelos, guardarlos en tu historial y operar el servicio.",
        "Sube solo cosas que tengas derecho a usar. No subas fotos de otras personas sin su permiso, ni logos, marcas o diseños de otros salvo que puedas usarlos.",
        "Eres responsable de lo que subes y de cómo usas tus diseños."
      ]
    },
    {
      "h": "4. Diseños hechos con IA",
      "p": [
        "KIXO usa inteligencia artificial para crear imágenes. Los resultados pueden variar, pueden tener errores y pedidos parecidos pueden dar resultados parecidos a otros usuarios. Revisa tu diseño antes de publicarlo.",
        "Respetando estos términos y los derechos del material que subiste, puedes usar los diseños que hagas con KIXO para fines personales y comerciales (tu equipo, liga, stream o club).",
        "KIXO puede mostrar ejemplos anónimos o diseños hechos con contenido de muestra para promocionar el servicio. No publicaremos tus fotos personales como ejemplo sin tu permiso."
      ]
    },
    {
      "h": "5. Lo que no puedes hacer",
      "p": [
        "No uses KIXO para crear contenido ilegal, sexual, de odio, acoso o violencia, ni para suplantar o difamar a una persona u organización real.",
        "No intentes romper, sobrecargar, hacer ingeniería inversa o saltarte los límites o filtros de seguridad de KIXO, ni revendas el acceso al servicio.",
        "No uses KIXO para infringir derechos de autor, marcas o la imagen de nadie."
      ]
    },
    {
      "h": "6. El servicio",
      "p": [
        "Trabajamos para que KIXO funcione siempre, pero se ofrece \"tal cual\" y a veces puede no estar disponible, ir lento o cambiar. Las generaciones que fallan se reembolsan solas en créditos.",
        "Podemos agregar, cambiar o quitar funciones, estilos y precios. Si un cambio afecta un plan que pagaste, te avisaremos antes."
      ]
    },
    {
      "h": "7. Responsabilidad",
      "p": [
        "En la medida que permita la ley, KIXO no es responsable de daños indirectos, ganancias o datos perdidos, y nuestra responsabilidad total por cualquier reclamo se limita a lo que pagaste a KIXO en los 3 meses anteriores al reclamo."
      ]
    },
    {
      "h": "8. Cambios y contacto",
      "p": [
        "Podemos actualizar estos términos. Si el cambio es importante te avisaremos en la web. Usar KIXO después de una actualización significa que aceptas los nuevos términos.",
        "¿Preguntas? Escríbenos por el Soporte en vivo de kixo.pro o en el servidor de Discord de KIXO."
      ]
    }
  ]
};

export default async function TermsPage() {
  const { locale } = await getT();
  const d = locale === "es" ? ES : EN;
  return <LegalPage {...d} />;
}
