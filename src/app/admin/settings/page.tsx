import { getT } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { loadPricing } from "@/lib/pricing";
import { PricingEditor } from "@/components/admin/PricingEditor";

export default async function AdminSettings() {
  await requireAdmin();
  const { t } = await getT();
  const settings = await getSettings();
  const pricing = await loadPricing();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">{t("admin_settings")}</h1>
      <SettingsForm initial={settings} />
      <div className="max-w-xl">
        <PricingEditor initial={pricing} />
      </div>
    </div>
  );
}
