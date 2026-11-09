// A style's reference image made from a finished KIXO poster: the picture every new poster of that style is
// matched to (look only — the AI never copies its people, names or texts). Always our own posters.
import sharp from "sharp";
import { noReferenceColours } from "./ref-palette";
import { saveFile } from "./storage";

/**
 * Saves a copy of the poster as a reference image (so deleting the poster keeps the reference) and returns its URL.
 * `own`: the poster was made with this very style (the automatic preview round, or the admin's pick in the Style
 * test). The style's brief then stays in charge of the colours: the "the reference's colours win" rules are for
 * styles COPIED from a reference, so this picture is marked to get none of them — before any style points at it.
 */
export async function posterAsStyleRef(bytes: Buffer, own = false): Promise<string> {
  const url = await saveFile("refs", await sharp(bytes).resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer(), "image/jpeg");
  if (own) await noReferenceColours(url);
  return url;
}
