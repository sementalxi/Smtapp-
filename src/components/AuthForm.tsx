"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/i18n/client";
import type { DictKey } from "@/i18n/dict";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : mode === "register" ? "/create" : "/dashboard";
      window.location.href = dest;
      return;
    }
    const body = await res.json().catch(() => ({}));
    const known: DictKey[] = ["err_invalid", "err_exists", "err_banned"];
    setError(t(known.includes(body.error) ? (body.error as DictKey) : "err_generic"));
    setBusy(false);
  }

  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <h1 className="font-display chrome mb-6 text-4xl">{t(mode === "login" ? "login_title" : "register_title")}</h1>
      <form onSubmit={submit} className="card space-y-4 p-6">
        {mode === "register" && (
          <div>
            <label className="label" htmlFor="name">{t("name")}</label>
            <input id="name" name="name" required maxLength={60} className="input" autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">{t("email")}</label>
          <input id="email" name="email" type="email" required className="input" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">{t("password")}</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 8 : 1}
            className="input"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            placeholder={mode === "register" ? t("pw_hint") : ""}
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button disabled={busy} className="btn-primary w-full">
          {busy ? "…" : t(mode === "login" ? "nav_login" : "nav_register")}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            {t("no_account")} <Link href="/register" className="text-lime">{t("nav_register")}</Link>
          </>
        ) : (
          <>
            {t("have_account")} <Link href="/login" className="text-lime">{t("nav_login")}</Link>
          </>
        )}
      </p>
    </div>
  );
}
