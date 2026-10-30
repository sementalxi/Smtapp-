import { requireAdmin } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { DICTS } from "@/i18n/dict";
import { getTextOverrides } from "@/i18n/overrides";
import { TextsEditor } from "@/components/admin/TextsEditor";

export default async function AdminTexts() {
  await requireAdmin();
  const { locale } = await getT();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">{locale === "es" ? "Textos del sitio" : "Site texts"}</h1>
      <TextsEditor defaults={DICTS as unknown as Record<"en" | "es", Record<string, string>>} initial={await getTextOverrides()} />
    </div>
  );
}
