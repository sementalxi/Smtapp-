// Apple Pay domain verification: serves Square's verification file from our own domain.
export const revalidate = 86400;

export async function GET() {
  const sandbox = process.env.SQUARE_ENV?.trim() === "sandbox";
  const src = sandbox
    ? "https://app.squareupsandbox.com/digital-wallets/apple-pay/apple-developer-merchantid-domain-association"
    : "https://app.squareup.com/digital-wallets/apple-pay/apple-developer-merchantid-domain-association";
  const res = await fetch(src, { next: { revalidate: 86400 } });
  if (!res.ok) return new Response("not available", { status: 502 });
  return new Response(await res.text(), { headers: { "Content-Type": "text/plain" } });
}
