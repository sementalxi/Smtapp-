import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/i18n/server";
import { AccountHeader, AccountShell, StatTile } from "@/components/account/AccountShell";
import { ProfileForms } from "@/components/account/ProfileForms";
import { DiscordLink } from "@/components/account/DiscordLink";
import { discordAuthReady } from "@/lib/discord-auth";
import { SoundToggle } from "@/components/SoundToggle";

export const metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ discord?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  if (user.discordId && !user.discordUser) {
    const { syncDiscordProfile } = await import("@/lib/discord-bot");
    if (await syncDiscordProfile(user.id, user.discordId).catch(() => false)) {
      const fresh = await db.user.findUnique({ where: { id: user.id }, select: { discordName: true, discordUser: true, discordAvatar: true } });
      if (fresh) Object.assign(user, fresh);
    }
  }
  const { locale } = await getT();
  const es = locale === "es";
  const [arts, spent] = await Promise.all([
    db.banner.count({ where: { userId: user.id, status: "READY" } }),
    db.payment.aggregate({ where: { userId: user.id }, _sum: { amountCents: true } }),
  ]);
  return (
    <AccountShell user={user}>
      <AccountHeader title={es ? "Perfil" : "Profile"} sub={es ? `Miembro desde ${user.createdAt.toLocaleDateString(locale, { month: "long", year: "numeric" })}` : `Member since ${user.createdAt.toLocaleDateString(locale, { month: "long", year: "numeric" })}`} />
      <div className="grid grid-cols-3 gap-3">
        <StatTile label={es ? "Créditos" : "Credits"} value={user.credits} accent />
        <StatTile label={es ? "Artes" : "Arts"} value={arts} />
        <StatTile label={es ? "Gastado" : "Spent"} value={`$${((spent._sum.amountCents ?? 0) / 100).toFixed(2)}`} />
      </div>
      {discordAuthReady() && <DiscordLink linked={!!user.discordId} name={user.discordName ?? null} avatar={user.discordAvatar} handle={user.discordUser} es={es} status={sp.discord} />}
      <SoundToggle es={es} />
      <ProfileForms name={user.name} email={user.email} isAdmin={user.role === "ADMIN"} showcase={!user.showcaseOptOut} />
    </AccountShell>
  );
}
