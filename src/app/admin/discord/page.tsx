import { requireAdmin } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { DiscordComposer } from "@/components/admin/DiscordComposer";

export const dynamic = "force-dynamic";

export default async function AdminDiscord() {
  await requireAdmin();
  const { locale } = await getT();
  const es = locale === "es";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">{es ? "Mensaje por Discord" : "Discord message"}</h1>
        <p className="text-sm text-muted">
          {es
            ? "Tu bot envía un mensaje directo a cada usuario que entró o conectó su cuenta con Discord."
            : "Your bot sends a direct message to every user who signed up with or connected Discord."}
        </p>
      </div>
      <DiscordComposer es={es} />
    </div>
  );
}
