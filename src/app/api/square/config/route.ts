import { handle, json } from "@/lib/api";
import { apiUser } from "@/lib/auth";
import { locationId, squareConfigured } from "@/lib/square";

/** Public Square IDs the on-page card form needs. */
export const GET = handle(async () => {
  await apiUser();
  const appId = process.env.SQUARE_APPLICATION_ID?.trim();
  if (!squareConfigured() || !appId) return json({ inline: false });
  return json({ inline: true, appId, locationId: await locationId(), sandbox: process.env.SQUARE_ENV?.trim() === "sandbox" });
});
