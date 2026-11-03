import { getT } from "@/i18n/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { loadPricing } from "@/lib/pricing";
import { PricingEditor } from "@/components/admin/PricingEditor";
import { HeroBackground } from "@/components/admin/HeroBackground";
import { MigrateFiles } from "@/components/admin/MigrateFiles";
import { AdminSection } from "@/components/admin/AdminSection";

export default async function AdminSettings() {
  await requireAdmin();
  const { t, locale } = await getT();
  const es = locale === "es";
  const settings = await getSettings();
  const pricing = await loadPricing();
  return (
    <div className="space-y-3">
      <h1 className="font-display text-4xl">{t("admin_settings")}</h1>
      <SettingsForm initial={settings} />
      <div className="max-w-xl space-y-3 pt-2">
        <AdminSection icon="💲" title={es ? "Precios y planes" : "Prices & plans"} sub={es ? "Planes mensuales, paquetes, calidad IA por plan" : "Monthly plans, packs, AI quality per plan"}>
          <PricingEditor initial={pricing} />
        </AdminSection>
        <AdminSection icon="🎬" title={es ? "Fondo animado de la página principal" : "Home page animated background"} sub={es ? "Imagen, video o efectos detrás del título" : "Picture, video or effects behind the title"}>
          <HeroBackground initial={{ mode: settings.hero_bg_mode, video: settings.hero_video, opacity: Number(settings.hero_video_opacity) || 70, effect: settings.hero_effect }} blobReady={!!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)} />
        </AdminSection>
        <AdminSection icon="🧰" title={es ? "Herramientas" : "Tools"} sub={es ? "Mover archivos viejos a Blob" : "Move old files to Blob storage"}>
          <MigrateFiles />
        </AdminSection>
      </div>
    </div>
  );
}
