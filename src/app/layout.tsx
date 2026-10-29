import type { Metadata } from "next";
import "./globals.css";
import { fontVariables } from "./fonts";
import { getLocale } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

const site = process.env.NEXT_PUBLIC_SITE_NAME || "KIXO";

export const metadata: Metadata = {
  title: { default: `${site} — Pro Clubs graphics in minutes`, template: `%s · ${site}` },
  description: "Player cards, champions posters, match day and lineups for your club — made by AI from your photo and crest.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const user = await getCurrentUser().catch(() => null);
  let notice = "";
  try {
    notice = (await getSettings()).maintenance_message;
  } catch {
    /* DB not ready yet */
  }
  return (
    <html lang={locale} className={fontVariables}>
      <body className="antialiased">
        <I18nProvider locale={locale}>
          {notice && <div className="bg-lime px-4 py-2 text-center text-sm font-bold text-ink">{notice}</div>}
          <Header />
          <main className={user ? "pb-28 md:pb-0" : ""}>{children}</main>
          <footer className={`mt-24 border-t border-line/60 py-8 text-center text-xs text-muted ${user ? "pb-28 md:pb-8" : ""}`}>
            © {new Date().getFullYear()} {site}
          </footer>
          {user && <BottomNav />}
        </I18nProvider>
      </body>
    </html>
  );
}
