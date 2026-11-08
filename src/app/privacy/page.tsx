import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy \u00b7 KIXO" };

const EN = {
  "title": "Privacy Policy",
  "updated": "Last updated: November 8, 2026",
  "intro": "This policy explains what information KIXO (kixo.pro, the KIXO apps and the KIXO Discord bot) collects, why, and the choices you have. We don't sell your personal information.",
  "sections": [
    {
      "h": "What we collect",
      "p": [
        "Account details: your name or username, email address, phone number (to keep one account per person), password (stored encrypted) and, if you connect Discord, your Discord ID, username and profile picture.",
        "What you create: the photos, logos and texts you upload, the designs you make, your saved teams and leagues, and your support messages.",
        "Payments: what you bought and when. Card details are handled by our payment partners (Square, PayPal, Stripe) — we never receive your full card number.",
        "Technical data: IP address, device and browser type, and basic usage logs, used for security, fraud prevention and to keep the site working."
      ]
    },
    {
      "h": "How we use it",
      "p": [
        "To run your account and make your designs; to give and track credits, plans and purchases; to prevent abuse (for example duplicate accounts); to answer support requests; to send account emails such as password resets and receipts; and to improve KIXO."
      ]
    },
    {
      "h": "Who we share it with",
      "p": [
        "Only with the services that help us run KIXO, and only what they need: AI image providers (such as OpenAI, fal.ai and Replicate) receive the prompts and images needed to create your design; our hosting and database providers (Vercel, Neon) store the service; our email provider (Resend) sends emails; Discord, if you connect it or use our bot; and our payment partners for payments.",
        "We may share information if the law requires it, or to protect KIXO and its users from fraud or abuse."
      ]
    },
    {
      "h": "How long we keep it",
      "p": [
        "We keep your account information and designs while your account is open. You can delete designs from your history at any time. When you ask us to delete your account we remove your personal information, except what we must keep for legal, tax or fraud-prevention reasons."
      ]
    },
    {
      "h": "Your choices",
      "p": [
        "You can see and update your profile at any time. To get a copy of your data or delete your account, contact us through Live support on kixo.pro. You can unsubscribe from non-essential emails with the link in the email."
      ]
    },
    {
      "h": "Children",
      "p": [
        "KIXO is not for children under 13. If you believe a child under 13 has given us information, contact us and we'll delete it."
      ]
    },
    {
      "h": "Security",
      "p": [
        "We use encrypted connections (HTTPS), encrypted passwords and access controls to protect your information. No service is 100% secure, so please use a strong password that you don't use anywhere else."
      ]
    },
    {
      "h": "Changes and contact",
      "p": [
        "We may update this policy and will show the new date at the top. Questions about privacy? Contact us through Live support on kixo.pro or in the KIXO Discord server."
      ]
    }
  ]
};
const ES = {
  "title": "Política de privacidad",
  "updated": "Última actualización: 8 de noviembre de 2026",
  "intro": "Esta política explica qué información recoge KIXO (kixo.pro, las apps de KIXO y el bot de Discord de KIXO), para qué y qué opciones tienes. No vendemos tu información personal.",
  "sections": [
    {
      "h": "Qué recogemos",
      "p": [
        "Datos de la cuenta: tu nombre o usuario, correo, número de teléfono (para mantener una cuenta por persona), contraseña (guardada cifrada) y, si conectas Discord, tu ID, usuario y foto de perfil de Discord.",
        "Lo que creas: las fotos, logos y textos que subes, tus diseños, tus equipos y ligas guardados y tus mensajes de soporte.",
        "Pagos: qué compraste y cuándo. Los datos de la tarjeta los manejan nuestros socios de pago (Square, PayPal, Stripe) — nunca recibimos el número completo.",
        "Datos técnicos: dirección IP, tipo de dispositivo y navegador y registros básicos de uso, para seguridad, prevenir fraude y que la web funcione."
      ]
    },
    {
      "h": "Para qué lo usamos",
      "p": [
        "Para operar tu cuenta y hacer tus diseños; dar y llevar la cuenta de créditos, planes y compras; prevenir abusos (por ejemplo cuentas duplicadas); responder al soporte; enviar correos de la cuenta como restablecer contraseña y recibos; y mejorar KIXO."
      ]
    },
    {
      "h": "Con quién lo compartimos",
      "p": [
        "Solo con los servicios que nos ayudan a operar KIXO, y solo lo que necesitan: proveedores de imágenes con IA (como OpenAI, fal.ai y Replicate) reciben las instrucciones e imágenes necesarias para crear tu diseño; nuestro hosting y base de datos (Vercel, Neon) guardan el servicio; nuestro proveedor de correo (Resend) envía los correos; Discord, si lo conectas o usas nuestro bot; y nuestros socios de pago para los pagos.",
        "Podemos compartir información si la ley lo exige, o para proteger a KIXO y a sus usuarios de fraude o abuso."
      ]
    },
    {
      "h": "Cuánto tiempo lo guardamos",
      "p": [
        "Guardamos la información de tu cuenta y tus diseños mientras tu cuenta esté abierta. Puedes borrar diseños de tu historial cuando quieras. Cuando nos pidas borrar tu cuenta eliminamos tu información personal, salvo lo que debamos guardar por motivos legales, fiscales o de prevención de fraude."
      ]
    },
    {
      "h": "Tus opciones",
      "p": [
        "Puedes ver y actualizar tu perfil cuando quieras. Para pedir una copia de tus datos o borrar tu cuenta, escríbenos por el Soporte en vivo de kixo.pro. Puedes darte de baja de correos no esenciales con el enlace del correo."
      ]
    },
    {
      "h": "Menores",
      "p": [
        "KIXO no es para menores de 13 años. Si crees que un menor de 13 nos dio información, contáctanos y la borraremos."
      ]
    },
    {
      "h": "Seguridad",
      "p": [
        "Usamos conexiones cifradas (HTTPS), contraseñas cifradas y controles de acceso para proteger tu información. Ningún servicio es 100% seguro, así que usa una contraseña fuerte que no uses en otro sitio."
      ]
    },
    {
      "h": "Cambios y contacto",
      "p": [
        "Podemos actualizar esta política y mostraremos la nueva fecha arriba. ¿Preguntas sobre privacidad? Escríbenos por el Soporte en vivo de kixo.pro o en el servidor de Discord de KIXO."
      ]
    }
  ]
};

export default async function PrivacyPage() {
  const { locale } = await getT();
  const d = locale === "es" ? ES : EN;
  return <LegalPage {...d} />;
}
