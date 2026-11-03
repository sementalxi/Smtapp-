import type { Metadata } from "next";
import "./globals.css";
import { fontVariables } from "./fonts";
import { getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";
import { Header } from "@/components/Header";
import { RefCapture } from "@/components/RefCapture";
import { LangPrompt } from "@/components/LangPrompt";
import { cookies, headers } from "next/headers";
import { ComingSoon } from "@/components/ComingSoon";
import { SupportChat } from "@/components/SupportChat";
import { SoundEvents } from "@/components/SoundEvents";
import { KeepAwake } from "@/components/KeepAwake";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getTextOverrides } from "@/i18n/overrides";

const site = process.env.NEXT_PUBLIC_SITE_NAME || "KIXO";

/** Title, description and share picture (Admin → Settings → Link preview). Shown in Google, Discord, iMessage, WhatsApp… */
export async function generateMetadata(): Promise<Metadata> {
  let st: Record<string, string> = {};
  try {
    st = await getSettings();
  } catch {}
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");
  const title = st.site_title?.trim() || `${site} — AI sports banners`;
  const description = st.site_description?.trim() || "Create pro sports and eSports banners with AI in seconds.";
  const img = st.share_image?.trim();
  const image = img ? (img.startsWith("http") ? img : `${base}${img.startsWith("/") ? "" : "/"}${img}`) : undefined;
  return {
    metadataBase: new URL(base),
    icons: { apple: "/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: site, statusBarStyle: "black-translucent" },
    title: { default: title, template: `%s · ${site}` },
    description,
    openGraph: { title, description, siteName: site, url: base, type: "website", ...(image ? { images: [{ url: image, width: 1200, height: 630 }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  // Ask once per browser (separate from the language cookie, so people who already had one still see it once).
  const chosen = !!(await cookies()).get("kixo_lang_asked")?.value;
  let notice = "";
  let soon = false;
  let dBonus = 0;
  try {
    const st = await getSettings();
    notice = st.maintenance_message;
    dBonus = Number(st.discord_bonus) || 0;
    if (st.coming_soon === "1") {
      // Coming-soon mode: everyone except admins sees the launch page; sign-up/login pages stay open.
      const path = (await headers()).get("x-kixo-path") ?? "/";
      const open = ["/login", "/register", "/forgot", "/reset", "/admin"].some((p) => path === p || path.startsWith(p + "/"));
      const me = await getCurrentUser().catch(() => null);
      soon = !open && me?.role !== "ADMIN";
    }
  } catch {
    /* DB not ready yet */
  }
  if (soon) {
    const me = await getCurrentUser().catch(() => null);
    return (
      <html lang={locale} className={fontVariables}>
        <body className="antialiased">
          <I18nProvider locale={locale} custom={(await getTextOverrides())[locale]}>
            <div className="kixo-grain" aria-hidden />
            <RefCapture />
            <KeepAwake />
            <ComingSoon bonus={dBonus} user={me ? { name: me.name, discord: !!me.discordId, discordName: me.discordName } : null} />
          </I18nProvider>
        </body>
      </html>
    );
  }
  return (
    <html lang={locale} className={fontVariables}>
      <body className="antialiased">
        <I18nProvider locale={locale} custom={(await getTextOverrides())[locale]}>
          {notice && <div className="bg-lime px-4 py-2 text-center text-sm font-bold text-ink">{notice}</div>}
          <div className="kixo-grain" aria-hidden />
          <div className="kixo-vignette" aria-hidden />
          <RefCapture />
          {!chosen && <LangPrompt suggested={locale} />}
          <Header />
          <SoundEvents />
          <KeepAwake />
          <main>{children}</main>
          {(await getCurrentUser().catch(() => null)) && <SupportChat />}
          <footer className="mt-24 border-t border-line py-8 text-center text-xs text-muted">
            © {new Date().getFullYear()} {site}
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
