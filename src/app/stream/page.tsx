import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { getNumberSetting } from "@/lib/settings";
import { isComingSoon } from "@/lib/coming-soon";
import { SoonCard } from "@/components/SoonCard";
import { StreamKitMaker } from "@/components/StreamKitMaker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Streamer kit · KIXO" };

export default async function StreamPage({ searchParams }: { searchParams: Promise<{ kit?: string }> }) {
  const user = await requireUser();
  const { locale } = await getT();
  const { kit } = await searchParams;
  const staff = user.role === "ADMIN" || user.role === "STAFF";
  if (!staff && (await isComingSoon("STREAM_KIT"))) {
    const es = locale === "es";
    return (
      <div className="px-4 py-12">
        <SoonCard es={es} title={es ? "Kit de streamer" : "Streamer kit"} icon="🎥" />
      </div>
    );
  }
  const perPiece = staff ? 0 : await getNumberSetting("stream_piece_cost");
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <StreamKitMaker es={locale === "es"} perPiece={perPiece} credits={user.credits} initialKit={kit ?? ""} />
    </div>
  );
}
