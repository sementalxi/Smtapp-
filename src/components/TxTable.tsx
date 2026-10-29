import Link from "next/link";
import type { CreditTransaction } from "@prisma/client";

const TYPE_STYLE: Record<string, string> = {
  SIGNUP_BONUS: "text-sky-300",
  PURCHASE: "text-lime",
  SUBSCRIPTION: "text-lime",
  GENERATION: "text-muted",
  REFUND: "text-amber-300",
  ADMIN_ADJUST: "text-fuchsia-300",
};

type Row = CreditTransaction & { user?: { id: string; email: string } | null; admin?: { email: string } | null };

export function TxTable({ rows, locale, showUser }: { rows: Row[]; locale: string; showUser?: boolean }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Date</th>
          {showUser && <th>User</th>}
          <th>Type</th>
          <th className="text-right">±</th>
          <th className="text-right">Balance</th>
          <th>Note</th>
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
            <td className={`text-xs font-bold ${TYPE_STYLE[r.type] ?? ""}`}>{r.type.replace("_", " ")}</td>
            <td className={`text-right font-bold ${r.amount > 0 ? "text-lime" : "text-danger"}`}>
              {r.amount > 0 ? "+" : ""}
              {r.amount}
            </td>
            <td className="text-right">{r.balance}</td>
            <td className="text-muted">
              {r.note}
              {r.admin && <span className="text-xs"> · by {r.admin.email}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
