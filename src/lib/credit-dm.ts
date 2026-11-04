// When the admin gives (or removes) credits, the Discord bot tells the user in a DM.
import { db } from "./db";

const site = () => (process.env.NEXT_PUBLIC_APP_URL || "https://kixo.pro").replace(/\/+$/, "");

/** Never throws — a failed DM must not block the credit change. */
export async function dmCreditChange(userId: string, amount: number, balance: number, note?: string) {
  try {
    const u = await db.user.findUnique({ where: { id: userId }, select: { discordId: true, locale: true, name: true } });
    if (!u?.discordId) return;
    const { dmUser, botReady } = await import("./discord-bot");
    if (!botReady()) return;
    const es = u.locale === "es";
    const gift = amount > 0;
    const n = Math.abs(amount);
    const content = gift
      ? es
        ? `⚡ **¡Te regalaron ${n} crédito${n === 1 ? "" : "s"}!**\nEl equipo de KIXO agregó créditos a tu cuenta${note ? ` — _${note}_` : ""}.\n\n💰 Saldo nuevo: **${balance} créditos**`
        : `⚡ **You got ${n} free credit${n === 1 ? "" : "s"}!**\nThe KIXO team added credits to your account${note ? ` — _${note}_` : ""}.\n\n💰 New balance: **${balance} credits**`
      : es
        ? `ℹ️ Se quitaron **${n} crédito${n === 1 ? "" : "s"}** de tu cuenta${note ? ` — _${note}_` : ""}.\n\n💰 Saldo nuevo: **${balance} créditos**`
        : `ℹ️ **${n} credit${n === 1 ? "" : "s"}** were removed from your account${note ? ` — _${note}_` : ""}.\n\n💰 New balance: **${balance} credits**`;
    await dmUser(u.discordId, {
      title: gift ? (es ? "🎁 Créditos recibidos" : "🎁 Credits received") : es ? "Créditos actualizados" : "Credits updated",
      content,
      linkUrl: `${site()}/create`,
      linkLabel: es ? "✨ Crear un póster" : "✨ Make a poster",
    });
  } catch {
    /* ignore */
  }
}
