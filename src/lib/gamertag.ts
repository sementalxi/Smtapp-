// Where players play and their in-game name (given at sign-up, editable in Profile).
import { z } from "zod";

export const GAME_PLATFORMS = ["xbox", "psn", "ea"] as const;
export type GamePlatform = (typeof GAME_PLATFORMS)[number];
export const PLATFORM_LABEL: Record<GamePlatform, string> = { xbox: "Xbox", psn: "PlayStation", ea: "EA / PC" };

/** Gamertags: letters, numbers, spaces, - _ . (Xbox allows spaces; PSN / EA use - and _). */
export const gamertagSchema = z
  .string()
  .trim()
  .max(32)
  .regex(/^[\p{L}\p{N} _.\-]*$/u, "gamertag");
export const platformSchema = z.enum(GAME_PLATFORMS);
