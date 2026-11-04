import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { AccountHeader, AccountShell } from "@/components/account/AccountShell";
import { LeaguesManager, type League } from "@/components/account/LeaguesManager";

export const metadata = { title: "My leagues" };
export const dynamic = "force-dynamic";

/** Organizations / league admins: every league with its standings table, kept on the site — update, save, generate. */
export default async function LeaguesPage() {
  const user = await requireUser();
  const { locale } = await getT();
  const es = locale === "es";
  const [mine, official, tables] = await Promise.all([
    db.savedItem.findMany({ where: { userId: user.id, kind: "championship" }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, logoUrl: true } }),
    db.libraryItem.findMany({ where: { kind: "championship" }, orderBy: [{ sort: "asc" }, { name: "asc" }], select: { id: true, name: true, logoUrl: true } }),
    db.setting.findMany({ where: { key: { startsWith: `standings:${user.id}:` } } }),
  ]);
  const saved = new Map<string, { rows: League["rows"]; headline: string; date: string; savedAt: string }>();
  for (const t of tables) {
    try {
      saved.set(t.key.slice(`standings:${user.id}:`.length), JSON.parse(t.value));
    } catch {
      /* skip */
    }
  }
  // The user's own leagues, plus official ones they already keep a table for.
  const list = [...mine.map((l) => ({ ...l, official: false })), ...official.filter((o) => saved.has(o.id)).map((o) => ({ ...o, official: true }))];
  const leagues: League[] = list.map((l) => {
    const t = saved.get(l.id);
    return { id: l.id, name: l.name, logoUrl: l.logoUrl, official: l.official, rows: t?.rows ?? [], headline: t?.headline ?? "", date: t?.date ?? "", savedAt: t?.savedAt ?? null };
  });
  const officialChoices = official.filter((o) => !saved.has(o.id)).map((o) => ({ id: o.id, name: o.name, logoUrl: o.logoUrl }));

  return (
    <AccountShell user={user}>
      <AccountHeader
        title={es ? "Mis ligas" : "My leagues"}
        sub={es ? "Para organizaciones y admins de liga: tu tabla vive aquí. Actualízala después de cada jornada y genera el póster — sin volver a escribirla." : "For organizations and league admins: your standings live here. Update them after each matchday and generate the poster — never retype the table."}
      />
      <LeaguesManager es={es} initial={leagues} officialChoices={officialChoices} />
    </AccountShell>
  );
}
