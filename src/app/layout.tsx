import type { Metadata } from "next";
import "./globals.css";
import { fontVariables } from "./fonts";
import { getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";
import { Header } from "@/components/Header";
import { RefCapture } from "@/components/RefCapture";
import { LangPrompt } from "@/components/LangPrompt";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/settings";
import { getTextOverrides } from "@/i18n/overrides";

const site = process.env.NEXT_PUBLIC_SITE_NAME || "KIXO";

export const metadata: Metadata = {
  title: { default: `${site} — AI sports banners`, template: `%s · ${site}` },
  description: "Create pro sports and eSports banners with AI in seconds.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  // Ask once per browser (separate from the language cookie, so people who already had one still see it once).
  const chosen = !!(await cookies()).get("kixo_lang_asked")?.value;
  let notice = "";
  try {
    notice = (await getSettings()).maintenance_message;
  } catch {
    /* DB not ready yet */
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
          <main>{children}</main>
          <footer className="mt-24 border-t border-line py-8 text-center text-xs text-muted">
            © {new Date().getFullYear()} {site}
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
