"use client";

import { useRouter } from "next/navigation";

import { useEffect, useState } from "react";

type D = { comingSoon: boolean; role: string; adminRole: string; staffRole: string; supportRole2: string; roles: { id: string; name: string }[]; bot: boolean; linked: number; supportOn: boolean; supportRole: string; vipCode: string };

/** Admin: "Coming soon" switch + Discord role given to everyone who links their account. */
export function LaunchControls({ es }: { es: boolean }) {
  const [d, setD] = useState<D | null>(null);
  const router = useRouter();
  const [soon, setSoon] = useState(false);
  const [role, setRole] = useState("");
  const [adminRole, setAdminRole] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [supportRole2, setSupportRole2] = useState("");
  const [adminMsg, setAdminMsg] = useState("");
  async function saveAdminRole(r: string, kind: "admin" | "staff" | "support" = "admin") {
    (kind === "admin" ? setAdminRole : kind === "staff" ? setStaffRole : setSupportRole2)(r);
    setAdminMsg("…");
    const res = await fetch("/api/admin/launch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "adminRole", role: r, kind }) });
    const x = (await res.json().catch(() => ({}))) as { promoted?: number; demoted?: number; checked?: number };
    setAdminMsg(res.ok ? (es ? `✅ Guardado · ${x.checked ?? 0} revisados · ${x.promoted ?? 0} ahora admin · ${x.demoted ?? 0} ya no` : `✅ Saved · ${x.checked ?? 0} checked · ${x.promoted ?? 0} now admin · ${x.demoted ?? 0} no longer`) : es ? "❌ Error" : "❌ Failed");
  }
  async function syncAdmins() {
    setAdminMsg("…");
    const res = await fetch("/api/admin/launch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "syncAdmins" }) });
    const x = (await res.json().catch(() => ({}))) as { promoted?: number; demoted?: number; checked?: number };
    setAdminMsg(res.ok ? (es ? `✅ ${x.checked ?? 0} revisados · ${x.promoted ?? 0} ahora admin · ${x.demoted ?? 0} ya no` : `✅ ${x.checked ?? 0} checked · ${x.promoted ?? 0} now admin · ${x.demoted ?? 0} no longer`) : es ? "❌ Error" : "❌ Failed");
  }
  const [sOn, setSOn] = useState(true);
  const [sRole, setSRole] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [vip, setVip] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/admin/launch").then((r) => r.json()).then((x: D) => { setD(x); setSoon(x.comingSoon); setRole(x.role); setAdminRole(x.adminRole || ""); setStaffRole(x.staffRole || ""); setSupportRole2(x.supportRole2 || ""); setSOn(x.supportOn); setSRole(x.supportRole); setVip(x.vipCode || ""); }).catch(() => {});
  }, []);

  async function save(nextSoon = soon, nextRole = role) {
    setBusy("save");
    setMsg("");
    const r = await fetch("/api/admin/launch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", comingSoon: nextSoon, role: nextRole }) });
    setBusy("");
    setMsg(r.ok ? (es ? "✅ Guardado" : "✅ Saved") : es ? "❌ No se pudo guardar" : "❌ Couldn't save");
    if (r.ok) router.refresh();
  }
  async function vipAction(mode: "new" | "off") {
    setBusy("vip");
    const r = await fetch("/api/admin/launch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "vip", mode }) }).then((x) => x.json()).catch(() => null);
    setBusy("");
    if (r?.ok) setVip(r.vipCode || "");
  }
  const vipLink = vip ? `${typeof window !== "undefined" ? window.location.origin : "https://kixo.pro"}/vip/${vip}` : "";
  async function saveSupport(on = sOn, r = sRole) {
    setBusy("support");
    const res = await fetch("/api/admin/launch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "support", on, role: r }) });
    setBusy("");
    setMsg(res.ok ? (es ? "✅ Soporte guardado" : "✅ Support saved") : es ? "❌ No se pudo guardar" : "❌ Couldn't save");
    if (res.ok) router.refresh();
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
        <h3 className="font-bold">🎟️ {es ? "Link de acceso anticipado" : "Early-access link"}</h3>
        <p className="text-sm text-muted">
          {es
            ? "Quien abra este link ve la web completa como si ya estuviera lanzada (aunque “Muy pronto” esté encendido) y puede crear su cuenta y pósters. Vale un año en ese navegador. “Link nuevo” desactiva el anterior."
            : "Anyone who opens this link sees the full site as if it were launched (even with “Coming soon” on) and can sign up and make posters. It lasts a year in that browser. “New link” turns the old one off."}
        </p>
        {vipLink ? (
          <>
            <div className="flex gap-2">
              <input className="input min-w-0 flex-1 py-2 text-xs" readOnly value={vipLink} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="btn-primary shrink-0 px-3 py-2 text-xs" onClick={() => { navigator.clipboard?.writeText(vipLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}>
                {copied ? "✓" : es ? "Copiar" : "Copy"}
              </button>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={!!busy} className="btn-ghost px-3 py-2 text-xs" onClick={() => vipAction("new")}>🔄 {es ? "Link nuevo" : "New link"}</button>
              <button type="button" disabled={!!busy} className="btn-ghost px-3 py-2 text-xs" onClick={() => vipAction("off")}>⛔ {es ? "Desactivar" : "Turn off"}</button>
            </div>
          </>
        ) : (
          <button type="button" disabled={!!busy} className="btn-primary px-4 py-2 text-sm" onClick={() => vipAction("new")}>🎟️ {es ? "Crear link" : "Create link"}</button>
        )}
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
      {d.bot && (
        <div className="space-y-2 border-t border-line pt-4">
          <h3 className="font-bold">👑 {es ? "Roles de Discord → roles en la web" : "Discord roles → website roles"}</h3>
          {(
            [
              ["admin", adminRole, es ? "👑 Admin (todo)" : "👑 Admin (everything)"],
              ["staff", staffRole, es ? "🎨 Staff (creador + Crear y contenido)" : "🎨 Staff (creator tools + Create & content)"],
              ["support", supportRole2, es ? "🎧 Soporte (Usuarios y Dinero)" : "🎧 Support (People & Money)"],
            ] as const
          ).map(([kind, value, label]) => (
            <div key={kind} className="flex flex-wrap items-center gap-2">
              <span className="w-full text-xs font-bold sm:w-72">{label}</span>
              <select className="input min-w-0 flex-1 py-2 text-sm" value={value} onChange={(e) => saveAdminRole(e.target.value, kind)}>
                <option value="">{es ? "— Ninguno —" : "— None —"}</option>
                {d.roles.map((r) => (
                  <option key={r.id} value={r.id}>@{r.name}</option>
                ))}
              </select>
            </div>
          ))}
          <button type="button" disabled={!adminRole && !staffRole && !supportRole2} onClick={syncAdmins} className="btn-ghost px-4 py-2 text-xs">🔄 {es ? "Sincronizar ahora" : "Sync now"}</button>
          <p className="text-xs text-muted">
            {es
              ? "Quien tenga el rol en Discord recibe ese rol en la web (el más alto gana): se revisa al entrar o conectar Discord y con “Sincronizar ahora”. Si le quitan el rol en Discord, vuelve a usuario normal. Los roles puestos a mano en Usuarios o por correo de admin no cambian."
              : "Whoever has the Discord role gets that role on the website (the highest wins): checked when they sign in or link Discord and with “Sync now”. If the Discord role is taken away they go back to a normal user. Roles set by hand in Users or by admin e-mail are never touched."}
          </p>
          {adminMsg && <p className="text-xs">{adminMsg}</p>}
        </div>
      )}
      {d.bot && (
        <div className="space-y-2 border-t border-line pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold">💬 {es ? "Chat de soporte en vivo" : "Live support chat"}</h3>
            <button type="button" disabled={!!busy} onClick={() => { const v = !sOn; setSOn(v); saveSupport(v); }} className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase ${sOn ? "border-lime bg-lime/15 text-lime" : "border-line text-muted"}`}>
              {sOn ? (es ? "Encendido" : "On") : es ? "Apagado" : "Off"}
            </button>
          </div>
          <p className="text-xs text-muted">
            {es
              ? "“Soporte” en el menú abre un chat. Cada conversación crea un canal privado en la categoría 🎫 KIXO SUPPORT de tu servidor: responde ahí y el usuario lo ve en vivo. Escribe !close para cerrar."
              : "“Support” in the menu opens a chat. Each conversation creates a private channel in your server's 🎫 KIXO SUPPORT category: reply there and the user sees it live. Type !close to close."}
          </p>
          <div className="flex flex-wrap gap-2">
            <select className="input min-w-0 flex-1 py-2 text-sm" value={sRole} onChange={(e) => setSRole(e.target.value)}>
              <option value="">{es ? "— Rol del staff (quién ve los tickets) —" : "— Staff role (who sees tickets) —"}</option>
              {d.roles.map((r) => (
                <option key={r.id} value={r.id}>@{r.name}</option>
              ))}
            </select>
            <button type="button" disabled={!!busy} onClick={() => saveSupport()} className="btn-primary px-4 py-2 text-sm">{busy === "support" ? "…" : es ? "Guardar" : "Save"}</button>
          </div>
          <p className="text-[11px] text-muted">{es ? "Pon el rol antes del primer ticket (la categoría se crea con ese rol). El bot necesita Gestionar canales y Gestionar webhooks." : "Set the role before the first ticket (the category is created with it). The bot needs Manage Channels and Manage Webhooks."}</p>
        </div>
      )}
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
