import { apiAdmin, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api";
import { connectSquareWebhook, squareConfigured } from "@/lib/square";

// Admin → "Connect Square": finds the location, creates the monthly plans and registers the webhook.
export const POST = handle(async () => {
  await apiAdmin();
  if (!squareConfigured()) throw new HttpError(400, "Add SQUARE_ACCESS_TOKEN in Vercel first");
  try {
    const url = await connectSquareWebhook();
    return json({ ok: true, url });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Square connect failed" }, 400);
  }
});
