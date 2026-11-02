import { requireAdmin } from "@/lib/auth";
import { getT } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminBot() {
  await requireAdmin();
  const { locale } = await getT();
  const es = locale === "es";
  const ready = !!process.env.BOT_PANEL_URL?.trim() && !!process.env.BOT_DASHBOARD_PASSWORD?.trim();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-4xl">{es ? "Bot de Discord" : "Discord bot"}</h1>
        <p className="text-sm text-muted">{es ? "El panel de tu bot (tickets, reglas, verificación, comandos…) dentro de KIXO." : "Your bot's control panel (tickets, rules, verification, commands…) inside KIXO."}</p>
      </div>
      {ready ? (
        <iframe src="/api/bot-panel/" title="Bot panel" className="h-[calc(100dvh-12rem)] min-h-[600px] w-full rounded-2xl border border-line bg-ink" />
      ) : (
        <div className="card space-y-3 p-5 text-sm">
          <p className="font-bold">⚠️ {es ? "El bot aún no está conectado" : "The bot isn't connected yet"}</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-muted">
            <li>{es ? "El bot debe estar encendido en Railway (no puede correr dentro de Vercel)." : "The bot must be running on Railway (it can't run inside Vercel)."}</li>
            <li>{es ? "En Railway, pon DASHBOARD_PASSWORD (una contraseña larga)." : "In Railway, set DASHBOARD_PASSWORD (a long password)."}</li>
            <li>{es ? "En Vercel, añade BOT_PANEL_URL (la dirección del bot en Railway, ej. https://kixo-bot.up.railway.app) y BOT_DASHBOARD_PASSWORD (la misma contraseña)." : "In Vercel, add BOT_PANEL_URL (the bot's Railway address, e.g. https://kixo-bot.up.railway.app) and BOT_DASHBOARD_PASSWORD (the same password)."}</li>
            <li>{es ? "Dime “listo” para volver a publicar." : "Tell Claude “done” to redeploy."}</li>
          </ol>
        </div>
      )}
    </div>
  );
}
