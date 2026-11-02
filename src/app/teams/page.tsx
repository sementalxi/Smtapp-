import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { AccountHeader, AccountShell } from "@/components/account/AccountShell";
import { TeamsManager } from "@/components/account/TeamsManager";
import { parseRoster } from "@/lib/roster";

export const metadata = { title: "My teams" };

export default async function TeamsPage() {
  const user = await requireUser();
  const { locale } = await getT();
  const es = locale === "es";
  const teams = await db.savedItem.findMany({
    where: { userId: user.id, kind: "team" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, logoUrl: true, players: true },
  });
  return (
    <AccountShell user={user}>
      <AccountHeader
        title={es ? "Mis equipos" : "My teams"}
        sub={es ? "Guarda tus equipos con su plantilla — se rellenan solos en alineaciones y campeones." : "Save your teams and their players — they fill in automatically on lineups and champions."}
      />
      <TeamsManager es={es} initial={teams.map((t) => ({ ...t, players: parseRoster(t.players) }))} />
    </AccountShell>
  );
}
