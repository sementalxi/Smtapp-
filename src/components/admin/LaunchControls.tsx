"use client";

import { useEffect, useState } from "react";

type D = { comingSoon: boolean; role: string; roles: { id: string; name: string }[]; bot: boolean; linked: number };

/** Admin: "Coming soon" switch + Discord role given to everyone who links their account. */
export function LaunchControls({ es }: { es: boolean }) {
  const [d, setD] = useState<D | null>(null);
  const [soon, setSoon] = useState(false);
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/launch").then((r) => r.json()).then((x: D) => { setD(x); setSoon(x.comingSoon); setRole(x.role); }).catch(() => {});
  }, []);

  async function save(nextSoon = soon, nextRole = role) {
    setBusy("save");
    setMsg("");
    const r = await fetch("/api/admin/launch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", comingSoon: nextSoon, role: nextRole }) });
    setBusy("");
    setMsg(r.ok ? (es ? "✅ Guardado" : "✅ Saved") : es ? "❌ No se pudo guardar" : "❌ Couldn't save");
  }
  async function giveAll() {
    setBusy("all");
    setMsg(es ? "Dando el rol… (puede tardar)" : "Giving the role… (this can take a bit)");
    const r = await fetch("/api/admin/launch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "giveAll" }) }).then((x) => x.json()).catch(() => ({ error: "net" }));
    setBusy("");
    const why = r.error === "no_permission" ? (es ? "el bot necesita “Gestionar roles” y su rol arriba del rol elegido" : "the bot needs “Manage Roles” and its role above the chosen role") : r.error === "no_role" ? (es ? "elige un rol primero y guarda" : "pick a role first and save") : r.error;
    setMsg(`${r.given ? `✅ ${es ? "Rol dado a" : "Role given to"} ${r.given}` : ""}${r.notInServer ? ` · ${r.notInServer} ${es ? "no están en el servidor" : "not in the server"}` : ""}${why ? ` ❌ ${why}` : ""}` || "—");
  }

  if (!d) return <div className="card p-5 text-sm text-muted">…</div>;
  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">🚀 {es ? "Modo “Muy pronto”" : "“Coming soon” mode"}</h2>
          <p className="text-sm text-muted">
            {es
              ? "Encendido: todos (menos tú) ven la página MUY PRONTO / COMING SOON y solo pueden crear su cuenta con Discord."
              : "On: everyone except you sees the COMING SOON / MUY PRONTO page and can only create their account with Discord."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={soon}
          disabled={!!busy}
          onClick={() => { const v = !soon; setSoon(v); save(v); }}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider ${soon ? "border-lime bg-lime/15 text-lime" : "border-line text-muted"}`}
        >
          {soon ? (es ? "Encendido" : "On") : es ? "Apagado" : "Off"}
        </button>
      </div>

      <div className="space-y-2 border-t border-line pt-4">
        <h3 className="font-bold">🎭 {es ? "Rol de Discord al conectar la cuenta" : "Discord role when they link their account"}</h3>
        {!d.bot ? (
          <p className="text-sm text-amber-300">{es ? "Conecta el bot (DISCORD_BOT_TOKEN y DISCORD_GUILD_ID en Vercel) para elegir un rol." : "Connect the bot (DISCORD_BOT_TOKEN and DISCORD_GUILD_ID on Vercel) to pick a role."}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <select className="input min-w-0 flex-1 py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">{es ? "— Sin rol —" : "— No role —"}</option>
                {d.roles.map((r) => (
                  <option key={r.id} value={r.id}>@{r.name}</option>
                ))}
              </select>
              <button type="button" disabled={!!busy} onClick={() => save()} className="btn-primary px-4 py-2 text-sm">{busy === "save" ? "…" : es ? "Guardar" : "Save"}</button>
            </div>
            <p className="text-xs text-muted">
              {es
                ? "Se da al crear cuenta con Discord o al conectar Discord en el perfil. El rol del bot debe estar ARRIBA de este rol (Ajustes del servidor → Roles)."
                : "Given when someone signs up with Discord or connects Discord on their profile. The bot's role must be ABOVE this role (Server Settings → Roles)."}
            </p>
            {d.linked > 0 && (
              <button type="button" disabled={!!busy || !role} onClick={giveAll} className="btn-ghost px-4 py-2 text-xs">
                {busy === "all" ? "…" : es ? `Dar el rol a los ${d.linked} que ya conectaron` : `Give it to the ${d.linked} already linked`}
              </button>
            )}
          </>
        )}
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
