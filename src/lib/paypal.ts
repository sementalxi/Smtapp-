// PayPal one-time payments (Orders v2). OFF until PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET are set.
export const paypalReady = () => !!(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim());
export const paypalSandbox = () => process.env.PAYPAL_ENV?.trim() === "sandbox";
const base = () => (paypalSandbox() ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com");

async function token() {
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID?.trim()}:${process.env.PAYPAL_CLIENT_SECRET?.trim()}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const d = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!res.ok || !d.access_token) throw new Error(`PayPal auth failed: ${d.error_description ?? res.status}`);
  return d.access_token;
}

export async function pp<T = Record<string, unknown>>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(base() + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const d = (await res.json().catch(() => ({}))) as T & { message?: string; details?: { issue?: string; description?: string }[] };
  if (!res.ok) throw new Error(`PayPal ${res.status}: ${d.details?.[0]?.issue ?? ""} ${d.details?.[0]?.description ?? d.message ?? ""}`.trim());
  return d;
}
