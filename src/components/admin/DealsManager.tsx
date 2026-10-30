"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";
import { ImageDrop } from "../ImageDrop";

export interface AdminDeal {
  id?: string;
  title: string;
  subtitle: string;
  price: string;
  tags: string;
  included: string;
  imageUrl: string | null;
  ctaLabel: string;
  ctaHref: string;
  endsAt: string; // ISO from the server; while editing: yyyy-mm-ddThh:mm in local time
  active: boolean;
  sort: number;
}

const toLocalInput = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EMPTY: AdminDeal = { title: "", subtitle: "", price: "", tags: "", included: "", imageUrl: null, ctaLabel: "", ctaHref: "/pricing", endsAt: "", active: true, sort: 0 };

/** Admin: create and edit the home page deals. */
export function DealsManager({ initial }: { initial: AdminDeal[] }) {
  const { locale } = useT();
  const es = locale === "es";
  const router = useRouter();
  const [deals, setDeals] = useState(initial);
  const [edit, setEdit] = useState<AdminDeal | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    if (!edit?.title.trim()) return;
    setBusy(true);
    setMsg("");
    const body = { ...edit, endsAt: edit.endsAt ? new Date(edit.endsAt).toISOString() : null };
    delete (body as { id?: string }).id;
    const res = await fetch(edit.id ? `/api/admin/deals/${edit.id}` : "/api/admin/deals", {
      method: edit.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.deal) {
      const d = { ...edit, id: data.deal.id, endsAt: body.endsAt ?? "" };
      setDeals((x) => (edit.id ? x.map((y) => (y.id === edit.id ? d : y)) : [d, ...x]));
      setEdit(null);
      router.refresh();
    } else setMsg(data.details?.[0] ?? (es ? "No se pudo guardar" : "Couldn't save"));
  }

  async function remove(id: string) {
    setDeals((x) => x.filter((d) => d.id !== id));
    await fetch(`/api/admin/deals/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function toggle(d: AdminDeal) {
    setDeals((x) => x.map((y) => (y.id === d.id ? { ...y, active: !y.active } : y)));
    await fetch(`/api/admin/deals/${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !d.active }) });
    router.refresh();
  }

  const f = (k: keyof AdminDeal, label: string, ph = "", type = "text") => (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        placeholder={ph}
        value={String(edit?.[k] ?? "")}
        onChange={(e) => setEdit((x) => (x ? { ...x, [k]: type === "number" ? Number(e.target.value) : e.target.value } : x))}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        {es
          ? "Las ofertas activas aparecen en la página principal en “No te pierdas estas ofertas”. Si pones fecha de fin, se muestra una cuenta regresiva y la oferta se oculta sola al terminar."
          : "Active deals show on the home page under “Don't miss these deals”. Add an end date to show a live countdown — the deal hides itself when it ends."}
      </p>

      {!edit && (
        <button type="button" className="btn-primary" onClick={() => setEdit({ ...EMPTY })}>
          ＋ {es ? "Nueva oferta" : "New deal"}
        </button>
      )}

      {edit && (
        <div className="card space-y-4 p-5">
          <div className="font-bold">{edit.id ? (es ? "Editar oferta" : "Edit deal") : es ? "Nueva oferta" : "New deal"}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {f("title", es ? "Título *" : "Title *", es ? "Paquete Equipo — 15% menos" : "Team Pack — 15% OFF")}
            {f("price", es ? "Precio" : "Price", "$9.99")}
          </div>
          {f("subtitle", es ? "Descripción corta" : "Short description", es ? "30 créditos para todo tu equipo…" : "30 credits for your whole squad…")}
          {f("tags", es ? "Etiquetas (separadas por coma)" : "Tags (comma-separated)", es ? "Tiempo limitado, Mejor valor" : "Limited time, Best value")}
          <div>
            <label className="label">{es ? "Qué incluye (uno por línea)" : "What's included (one per line)"}</label>
            <textarea
              className="input min-h-28"
              value={edit.included}
              placeholder={es ? "30 créditos\nTodos los estilos\nDescargas en todos los tamaños" : "30 credits\nAll styles\nDownloads in every size"}
              onChange={(e) => setEdit((x) => (x ? { ...x, included: e.target.value } : x))}
            />
          </div>
          <ImageDrop noSearch kind="photo" label={es ? "Imagen (opcional)" : "Image (optional)"} value={edit.imageUrl} onChange={(u) => setEdit((x) => (x ? { ...x, imageUrl: u } : x))} />
          <div className="grid gap-3 sm:grid-cols-2">
            {f("ctaLabel", es ? "Texto del botón" : "Button text", es ? "Lo quiero" : "Get it now")}
            {f("ctaHref", es ? "Enlace del botón" : "Button link", "/pricing")}
            {f("endsAt", es ? "Termina (opcional)" : "Ends (optional)", "", "datetime-local")}
            {f("sort", es ? "Orden" : "Order", "0", "number")}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={edit.active} onChange={(e) => setEdit((x) => (x ? { ...x, active: e.target.checked } : x))} />
            {es ? "Activa (se muestra en la página)" : "Active (shown on the site)"}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" disabled={busy || !edit.title.trim()} onClick={save}>
              {busy ? "…" : es ? "Guardar" : "Save"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setEdit(null)}>
              {es ? "Cancelar" : "Cancel"}
            </button>
            {msg && <span className="text-sm text-danger">{msg}</span>}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {deals.map((d) => (
          <div key={d.id} className={`card flex gap-3 p-3 ${d.active ? "" : "opacity-50"}`}>
            {d.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.imageUrl} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-lime/15 text-2xl">🏷️</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{d.title}</div>
              <div className="text-xs text-muted">
                {d.price} {d.endsAt ? `· ${es ? "termina" : "ends"} ${new Date(d.endsAt).toLocaleString(locale)}` : ""}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <button type="button" className="text-lime hover:underline" onClick={() => setEdit({ ...d, endsAt: toLocalInput(d.endsAt) })}>
                  {es ? "Editar" : "Edit"}
                </button>
                <button type="button" className="text-muted hover:underline" onClick={() => toggle(d)}>
                  {d.active ? (es ? "Ocultar" : "Hide") : es ? "Mostrar" : "Show"}
                </button>
                <button type="button" className="text-danger hover:underline" onClick={() => d.id && remove(d.id)}>
                  {es ? "Eliminar" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
