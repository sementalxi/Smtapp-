import { requireAdmin } from "@/lib/auth";
import { getT } from "@/i18n/server";
import { EmailComposer } from "@/components/admin/EmailComposer";

export const dynamic = "force-dynamic";

export default async function AdminEmail() {
  await requireAdmin();
  const { locale } = await getT();
  const es = locale === "es";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">{es ? "Email a usuarios" : "Email users"}</h1>
        <p className="text-sm text-muted">
          {es
            ? "Envía promociones a todos tus usuarios registrados. Cada correo incluye un enlace para darse de baja."
            : "Send promos to everyone who signed up. Every email includes an unsubscribe link."}
        </p>
      </div>
      <EmailComposer />
    </div>
  );
}
