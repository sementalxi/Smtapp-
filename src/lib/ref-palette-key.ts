import { createHash } from "crypto";

/**
 * The Setting key under which a style reference's measured colours line is cached (lib/ref-palette). The value "-"
 * means "no colours line for this reference: the style's brief stays in charge of the colours".
 * Kept in its own small file so the seed can mark a reference without loading the image libraries.
 */
export const refPaletteKey = (url: string) => `refpal:${createHash("sha1").update(url).digest("hex").slice(0, 24)}`;
