import Link from "next/link";
import type { CreditTransaction } from "@prisma/client";

const TYPE_STYLE: Record<string, string> = {
  SIGNUP_BONUS: "text-sky-300",
  PURCHASE: "text-lime",
  SUBSCRIPTION: "text-lime",
  GENERATION: "text-muted",
  REFUND: "text-amber-300",
  ADMIN_ADJUST: "text-fuchsia-300",
  REFERRAL: "text-teal",
};

const TYPE_LABEL: Record<string, [string, string]> = {
  SIGNUP_BONUS: ["Welcome bonus", "Bono de bienvenida"],
  PURCHASE: ["Purchase", "Compra"],
  SUBSCRIPTION: ["Subscription", "Suscripción"],
  GENERATION: ["Generation", "Generación"],
  REFUND: ["Refund", "Reembolso"],
  ADMIN_ADJUST: ["Admin adjustment", "Ajuste del admin"],
  REFERRAL: ["Invite reward", "Premio por invitar"],
};

// Notes the system writes, translated for Spanish readers.
const NOTE_ES: Record<string, string> = {
  "Welcome bonus": "Bono de bienvenida",
  "Banner generation": "Generación de banner",
  "New background": "Nuevo fondo",
  "Pro AI poster": "Póster IA Pro",
  "Pro AI — new version": "IA Pro — nueva versión",
  "Automatic refund — generation failed": "Reembolso automático — la generación falló",
  "Automatic refund — Pro AI failed": "Reembolso automático — la IA Pro falló",
  "Automatic refund — generation timed out": "Reembolso automático — tiempo agotado",
  "Added by admin": "Agregado por el admin",
  "Removed by admin": "Quitado por el admin",
};

type Row = CreditTransaction & { user?: { id: string; email: string } | null; admin?: { email: string } | null };

export function TxTable({ rows, locale, showUser }: { rows: Row[]; locale: string; showUser?: boolean }) {
  const es = locale === "es";
  return (
    <table className="table">
      <thead>
        <tr>
          <th>{es ? "Fecha" : "Date"}</th>
          {showUser && <th>{es ? "Usuario" : "User"}</th>}
          <th>{es ? "Tipo" : "Type"}</th>
          <th className="text-right">±</th>
          <th className="text-right">{es ? "Saldo" : "Balance"}</th>
          <th>{es ? "Nota" : "Note"}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="whitespace-nowrap text-muted">{r.createdAt.toLocaleString(locale)}</td>
            {showUser && (
              <td>
                {r.user ? (
                  <Link href={`/admin/users/${r.user.id}`} className="hover:text-lime">{r.user.email}</Link>
                ) : (
                  "—"
                )}
              </td>
            )}
            <td className={`text-xs font-bold ${TYPE_STYLE[r.type] ?? ""}`}>{(TYPE_LABEL[r.type] ?? [r.type, r.type])[es ? 1 : 0]}</td>
            <td className={`text-right font-bold ${r.amount > 0 ? "text-lime" : "text-danger"}`}>
              {r.amount > 0 ? "+" : ""}
              {r.amount}
            </td>
            <td className="text-right">{r.balance}</td>
            <td className="text-muted">
              {es ? (r.note && NOTE_ES[r.note]) || (r.note?.startsWith("Credit pack") ? r.note.replace("Credit pack", "Paquete de créditos") : r.note?.startsWith("Monthly credits") ? r.note.replace("Monthly credits", "Créditos mensuales") : r.note) : r.note}
              {r.admin && <span className="text-xs"> · {es ? "por" : "by"} {r.admin.email}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
