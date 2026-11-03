// Sends every server-side page/API error to Admin → Live log, so crashes show what went wrong.
export async function register() {}

export async function onRequestError(err: unknown, request: { path: string; method: string }, context: { routePath?: string; routeType?: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const e = err as { message?: string; digest?: string; stack?: string };
    const where = `${request.method} ${request.path}${context.routePath ? ` (${context.routePath})` : ""}`;
    const msg = `💥 Server error on ${where}${e.digest ? ` · digest ${e.digest}` : ""}: ${(e.message ?? String(err)).slice(0, 500)} ${(e.stack ?? "").split("\n").slice(1, 4).join(" ").slice(0, 300)}`;
    const { logActivity } = await import("./lib/activity");
    await logActivity("site", "server_error", msg, "error");
  } catch {}
}
