import { requireUser, makesFree } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { db } from "@/lib/db";
import { getNumberSetting } from "@/lib/settings";
import { RosterForm } from "@/components/wizard/RosterForm";

export const metadata = { title: "Roster banners" };

export default async function RosterPage() {
  const user = await requireUser();
  const { locale } = await getT();
  const es = locale === "es";
  const tpl = await db.template.findUnique({ where: { slug: "player-roster-banner" }, select: { id: true } });
  if (!tpl) return <p className="p-10 text-center text-muted">{es ? "Este estilo aún no está listo." : "This style isn't ready yet."}</p>;
  return (
    <div className="px-4 py-8">
      <RosterForm templateId={tpl.id} credits={user.credits} cost={makesFree(user.role) ? 0 : await getNumberSetting("pro_cost")} es={es} />
    </div>
  );
}
