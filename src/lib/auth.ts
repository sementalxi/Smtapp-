import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

/** The logged-in user (memoized per render, so the header and the page share one lookup). */
export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const userId = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.banned) return null;
  // Emails in ADMIN_EMAILS become admin however they logged in (password, Discord or reset link).
  if (user.role !== "ADMIN" && isAdminEmail(user.email)) {
    await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } }).catch(() => {});
    user.role = "ADMIN";
  }
  // Free (gift) plans: add this month's credits on the first visit of the month; expire when the end date passes.
  if (user.subscriptionStatus === "comp") {
    const { topUpComp, isCompActive } = await import("./comp-plan");
    if (isCompActive(user)) {
      if (await topUpComp(user).catch(() => false)) {
        const fresh = await db.user.findUnique({ where: { id: user.id }, select: { credits: true } });
        if (fresh) user.credits = fresh.credits;
      }
    } else {
      await db.user.update({ where: { id: user.id }, data: { subscriptionStatus: "canceled" } }).catch(() => {});
      user.subscriptionStatus = "canceled";
    }
  }
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** For pages: redirect to login when signed out — and to the phone step when a new account still has no number. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { phoneMissing } = await import("./phone");
  if (phoneMissing(user)) redirect("/register/phone");
  return user;
}

/**
 * Website roles: ADMIN does everything. STAFF (content staff) gets the creator's admin tools and the
 * "Create & content" part of the admin panel. SUPPORT gets the "People" and "Money" parts (users, posters
 * made, e-mail, transactions, payments). Settings, Discord, bot and daily reward stay ADMIN only.
 */
export type Role = "USER" | "ADMIN" | "STAFF" | "SUPPORT";
/** Content staff: the creator's admin-only tools, free tests, styles / style test / texts. */
export const isStaff = (role: string | null | undefined) => role === "ADMIN" || role === "STAFF";
/** Admins never use credits: everything an admin makes (posters, edits, new versions, videos) is free. */
export const makesFree = (role: string | null | undefined) => role === "ADMIN";
/** Support staff: users, posters made, transactions, payments, e-mail. */
export const isSupport = (role: string | null | undefined) => role === "ADMIN" || role === "SUPPORT";
/** Any role that may open the admin panel. */
export const isAnyStaff = (role: string | null | undefined) => role === "ADMIN" || role === "STAFF" || role === "SUPPORT";

/** Which roles may use an admin page / API path. Unknown admin paths stay ADMIN only. */
export function rolesForAdminPath(path: string): Role[] {
  const p = path.replace(/\/+$/, "") || "/";
  const content = ["/admin/studio", "/admin/templates", "/admin/style-test", "/admin/leagues", "/admin/deals", "/admin/texts", "/api/admin/templates", "/api/admin/style-test", "/api/admin/texts", "/api/admin/hero", "/api/admin/hero-video", "/api/admin/type-pics", "/api/admin/studio", "/api/admin/library", "/api/admin/deals", "/api/admin/season", "/api/admin/leagues"];
  const people = ["/admin/users", "/admin/banners", "/admin/email", "/admin/transactions", "/admin/payments", "/admin/paylinks", "/api/admin/paylinks", "/api/admin/users", "/api/admin/email", "/api/admin/discord-dm", "/api/admin/welcome-dm", "/api/admin/banners", "/api/admin/transactions", "/api/admin/payments"];
  const everyone = ["/admin", "/admin/logs", "/api/admin/logs"];
  const hit = (list: string[]) => list.some((x) => p === x || p.startsWith(`${x}/`));
  if (p === "/admin" || hit(everyone)) return ["ADMIN", "STAFF", "SUPPORT"];
  if (hit(content)) return ["ADMIN", "STAFF"];
  if (hit(people)) return ["ADMIN", "SUPPORT"];
  return ["ADMIN"];
}

async function currentPath(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    return (await headers()).get("x-kixo-path") ?? "";
  } catch {
    return "";
  }
}

/** For pages: redirect away everyone who may not open this admin page (staff see only their areas). */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role === "ADMIN") return user;
  const path = await currentPath();
  if (!isAnyStaff(user.role) || !rolesForAdminPath(path).includes(user.role as Role)) redirect("/dashboard");
  return user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** For API routes: throw 401/403 instead of redirecting. */
export async function apiUser() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "unauthorized");
  return user;
}

/** For admin API routes: ADMIN always; STAFF / SUPPORT only on the routes of their area. */
export async function apiAdmin() {
  const user = await apiUser();
  if (user.role === "ADMIN") return user;
  const path = await currentPath();
  if (!isAnyStaff(user.role) || !rolesForAdminPath(path).includes(user.role as Role)) throw new HttpError(403, "forbidden");
  return user;
}

export function isAdminEmail(email: string) {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
