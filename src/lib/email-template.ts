// Email HTML (no server-only imports, so the admin page can preview it).
export const siteUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")).replace(/\/$/, "");

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export type Campaign = { subject: string; heading: string; body: string; imageUrl?: string | null; ctaLabel?: string; ctaUrl?: string };

/** Branded HTML email (dark KIXO look, works in Gmail/Outlook/iPhone Mail). */
export function renderEmail(c: Campaign, opts: { name: string; unsub: string; es: boolean; address?: string }) {
  const site = siteUrl();
  const img = c.imageUrl ? (c.imageUrl.startsWith("http") ? c.imageUrl : site + c.imageUrl) : "";
  const cta = c.ctaUrl ? (c.ctaUrl.startsWith("http") ? c.ctaUrl : site + (c.ctaUrl.startsWith("/") ? c.ctaUrl : "/" + c.ctaUrl)) : site;
  const body = esc(c.body.replace(/\{name\}/g, opts.name.split(" ")[0] || "")).replace(/\n/g, "<br>");
  const heading = esc(c.heading.replace(/\{name\}/g, opts.name.split(" ")[0] || ""));
  return `<!doctype html><html><body style="margin:0;background:#090d0b;font-family:Arial,Helvetica,sans-serif;color:#f1f8f3">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#090d0b;padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111814;border:1px solid #26332b;border-radius:18px;overflow:hidden">
<tr><td align="center" style="padding:22px 20px 10px"><img src="${site}/kixo-wordmark.png" alt="KIXO" height="36" style="height:36px;display:block"></td></tr>
${img ? `<tr><td style="padding:10px 20px"><img src="${esc(img)}" alt="" width="520" style="width:100%;max-width:520px;border-radius:12px;display:block"></td></tr>` : ""}
<tr><td style="padding:16px 26px 6px"><h1 style="margin:0;font-size:26px;line-height:1.15;color:#b7ff45;text-transform:uppercase">${heading}</h1></td></tr>
<tr><td style="padding:8px 26px 18px;font-size:15px;line-height:1.6;color:#d6e2da">${body}</td></tr>
${c.ctaLabel ? `<tr><td align="center" style="padding:0 26px 26px"><a href="${esc(cta)}" style="display:inline-block;background:#b7ff45;color:#090d0b;font-weight:bold;font-size:16px;text-decoration:none;padding:14px 28px;border-radius:10px">${esc(c.ctaLabel)}</a></td></tr>` : ""}
</table>
<p style="max-width:560px;font-size:11px;line-height:1.5;color:#7f8f86;margin:16px auto 0">${opts.es ? "Recibes este correo porque tienes una cuenta en KIXO." : "You're getting this because you have a KIXO account."} <a href="${opts.unsub}" style="color:#9aaba1">${opts.es ? "Darse de baja" : "Unsubscribe"}</a>${opts.address ? ` · ${esc(opts.address)}` : ""}</p>
</td></tr></table></body></html>`;
}

