"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/client";

export function CreditAdjust({ userId }: { userId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [amount, setAmount] = useState("10");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function apply(n: number) {
    if (!Number.isInteger(n) || n === 0) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/users/${userId}/credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: n, note: note || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: `${t("saved_ok")} → ${data.balance}` });
      setNote("");
      router.refresh();
    } else setMsg({ ok: false, text: data.error ?? t("err_generic") });
  }

  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-bold">{t("adjust_credits")}</h2>
      <div className="flex flex-wrap gap-2">
        {[5, 10, 25, 50, 100].map((n) => (
          <button key={n} disabled={busy} onClick={() => apply(n)} className="btn-ghost px-3 py-1.5 text-xs">
            +{n}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[120px_1fr_auto]">
        <div>
          <input
            type="number"
            step={1}
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={t("amount")}
          />
        </div>
        <input className="input" placeholder={t("reason")} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        <button disabled={busy} onClick={() => apply(Math.trunc(Number(amount)))} className="btn-primary">
          {t("apply")}
        </button>
      </div>
      <p className="text-xs text-muted">{t("amount_hint")}</p>
      {msg && <p className={`text-sm ${msg.ok ? "text-lime" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}

export function UserFlags({ userId, role, banned, self }: { userId: string; role: string; banned: boolean; self: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else setErr((await res.json().catch(() => ({}))).error ?? t("err_generic"));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        disabled={busy || self}
        onClick={() => patch({ role: role === "ADMIN" ? "USER" : "ADMIN" })}
        className="btn-ghost px-3 py-1.5 text-xs"
      >
        {role === "ADMIN" ? t("remove_admin") : t("make_admin")}
      </button>
      <button
        disabled={busy || self}
        onClick={() => patch({ banned: !banned })}
        className={`${banned ? "btn-ghost" : "btn-danger"} px-3 py-1.5 text-xs`}
      >
        {banned ? t("unban") : t("ban")}
      </button>
      {err && <span className="text-xs text-danger">{err}</span>}
    </div>
  );
}
