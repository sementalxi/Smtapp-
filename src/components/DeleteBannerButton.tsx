"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/i18n/client";

export function DeleteBannerButton({ id, className }: { id: string; className?: string }) {
  const { t } = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      className={className ?? "text-xs text-danger hover:underline"}
      onClick={async () => {
        if (!confirm(t("confirm_delete"))) return;
        setBusy(true);
        await fetch(`/api/banners/${id}`, { method: "DELETE" });
        router.refresh();
      }}
    >
      {busy ? "…" : t("delete")}
    </button>
  );
}
