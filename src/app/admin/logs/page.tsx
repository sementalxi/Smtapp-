import { requireAdmin } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { LiveLog } from "@/components/admin/LiveLog";

export const dynamic = "force-dynamic";

export default async function AdminLogs() {
  await requireAdmin();
  const { locale } = await getT();
  const es = locale === "es";
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-4xl">{es ? "Registro en vivo" : "Live log"}</h1>
        <p className="text-sm text-muted">{es ? "Todo lo que pasa en la web y en tu bot de Discord, en tiempo real." : "Everything happening on the website and your Discord bot, in real time."}</p>
      </div>
      <LiveLog es={es} />
    </div>
  );
}
