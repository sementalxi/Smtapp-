// Streamer kit: a matching set of professional TikTok LIVE graphics for one streamer — all vertical 9:16
// (1080×1920, the TikTok LIVE Studio portrait canvas). The first piece sets the look; the others get it as a
// reference so the whole kit matches. Overlays are painted with a flat green camera / game window that KIXO
// turns transparent, so they drop straight into TikTok LIVE Studio / OBS as PNGs.
import sharp from "sharp";
import { db } from "./db";
import { generatePoster } from "./ai";
import { loadBytes, saveFile } from "./storage";
import { changeCredits } from "./credits";

export const STREAM_PIECES = ["promo", "starting", "brb", "ending", "camframe", "overlay"] as const;
export type StreamPiece = (typeof STREAM_PIECES)[number];
export const STREAM_VIBES = ["neon", "esports", "fire", "ice", "anime", "luxury", "minimal", "retro"] as const;
export type StreamVibe = (typeof STREAM_VIBES)[number];

export type StreamInputs = {
  name: string; // the streamer's name / handle as it should appear
  content: string; // what they stream (game, IRL, music…)
  vibe: StreamVibe;
  colors: string;
  socials: string; // e.g. "@name on TikTok · IG @name"
  schedule: string; // e.g. "Mon–Fri 8 PM"
  logoUrl: string;
  pieces: StreamPiece[];
};
export type StreamItem = { kind: StreamPiece; status: "queued" | "making" | "ready" | "failed"; url?: string; error?: string };

export const W = 1080;
export const H = 1920;
const GREEN = "#00FF00";

const VIBE: Record<StreamVibe, string> = {
  neon: "NEON GAMER: deep black-violet base, glowing neon tubes and light bars in the colours, synthwave grid floor, scan lines, holographic HUD details, chromatic glow",
  esports: "ESPORTS PRO: sharp angular panels, carbon-fibre and brushed-metal plates, bold diagonal stripes, glowing edge lights, tech HUD brackets — like a pro team's broadcast package",
  fire: "FIRE & EMBERS: black and charcoal base, real flames, lava cracks, glowing embers and smoke, molten metal edges, aggressive and hot",
  ice: "ICE & FROST: dark navy base, cracked ice shards, frost, cold blue glow, crystals and snow particles, frosted-glass panels",
  anime: "ANIME / CEL-SHADED: bold cel-shaded illustration style, speed lines, comic halftone, punchy outlines, sakura petals or energy bursts, bright and fun",
  luxury: "LUXURY GOLD: black marble, polished gold and chrome trims, soft gold particles and bokeh, elegant and premium",
  minimal: "CLEAN MINIMAL: modern flat shapes, generous negative space, soft gradients, thin lines, crisp sans-serif typography, calm and premium",
  retro: "RETRO ARCADE: 80s arcade cabinet vibes, pixel art accents, CRT glow and scan lines, chunky retro type, sunset gradients",
};

const PIECE_NAME: Record<StreamPiece, [string, string]> = {
  promo: ["Going LIVE promo", "Promo de directo"],
  starting: ["Starting soon", "Empezamos pronto"],
  brb: ["Be right back", "Vuelvo enseguida"],
  ending: ["Stream ending", "Fin del directo"],
  camframe: ["Cam frame overlay", "Marco de cámara"],
  overlay: ["Full LIVE overlay", "Overlay completo"],
};
export const pieceName = (k: StreamPiece, es = false) => PIECE_NAME[k][es ? 1 : 0];
export const isOverlay = (k: StreamPiece) => k === "camframe" || k === "overlay";

/** The brief for one piece of the kit. */
export function streamPrompt(inp: StreamInputs, kind: StreamPiece, matchRef: boolean, hasLogo: boolean): string {
  const name = inp.name.trim().slice(0, 30);
  const texts: string[] = [`the streamer name "${name}"`];
  const piece: Record<StreamPiece, string> = {
    promo: `A "GOING LIVE" promo graphic to post before a stream: the streamer name huge as a premium 3D lettering piece in the centre, a big glowing "LIVE NOW" badge with a red dot, ${inp.content ? `visual hints of what they stream (${inp.content}) — props, icons, the game's genre feel, no copyrighted characters or logos — ` : ""}a dramatic scene behind; designed to stop the scroll on TikTok.`,
    starting: `A "STARTING SOON" screen shown before the stream begins: the words "STARTING SOON" big and bold in the centre, the streamer name above them, a calm loop-friendly background (nothing in the middle third that would distract), ${inp.schedule ? "the schedule on a sleek plate near the bottom, " : ""}${inp.socials ? "the socials on a slim bar at the bottom, " : ""}lots of breathing room.`,
    brb: `A "BE RIGHT BACK" screen for breaks: the words "BE RIGHT BACK" big and bold in the centre, the streamer name small above them, a relaxed background (coffee-break / pause vibe in the chosen style), ${inp.socials ? "the socials on a slim bar at the bottom, " : ""}clean and readable.`,
    ending: `A "THANKS FOR WATCHING" end screen: "THANKS FOR WATCHING" big in the centre, "STREAM ENDED" smaller above, the streamer name, ${inp.schedule ? "\"NEXT STREAM\" with the schedule on a plate, " : ""}${inp.socials ? "the socials on a slim bar, " : ""}a warm celebratory background.`,
    camframe: `A WEBCAM FRAME OVERLAY (transparent PNG for TikTok LIVE Studio): a camera window in the UPPER part (about 86% of the width, roughly 4:3, centred, top edge at ~8% of the height) framed by a thick, premium designed border in the chosen style (corners, glow, accents), with a name plate under it holding the streamer name${inp.socials ? " and the socials" : ""}. EVERYTHING ELSE — the inside of the camera window AND the whole rest of the canvas outside the frame and plate — is flat pure ${GREEN} green, perfectly uniform (it will be made transparent). No scene, no texture, no shadow on the green. Never use pure green anywhere in the design itself (use lime / neon green with some yellow in it if green is wanted).`,
    overlay: `A FULL LIVE OVERLAY (transparent PNG for TikTok LIVE Studio, portrait): a slim designed TOP BAR with the streamer name and a small "LIVE" badge; a slim designed BOTTOM BAR${inp.socials ? " with the socials" : ""}; thin designed side accents along both edges (corner brackets, light lines). The big centre area (between the bars, about 75% of the height) is flat pure ${GREEN} green — uniform, no texture, no shadow (it will be made transparent so the game / camera shows through). Keep the bars slim so they never cover the content. Never use pure green anywhere in the design itself.`,
  };
  if (kind === "starting") texts.push(`"STARTING SOON"`);
  if (kind === "brb") texts.push(`"BE RIGHT BACK"`);
  if (kind === "ending") texts.push(`"STREAM ENDED"`, `"THANKS FOR WATCHING"`);
  if (kind === "promo") texts.push(`"LIVE NOW"`);
  if (kind === "overlay") texts.push(`"LIVE"`);
  if (kind === "ending" && inp.schedule) texts.push(`"NEXT STREAM"`);
  if (inp.schedule && (kind === "starting" || kind === "ending")) texts.push(`the schedule "${inp.schedule.trim().slice(0, 40)}"`);
  if (inp.socials && kind !== "promo") texts.push(`the socials "${inp.socials.trim().slice(0, 60)}"`);
  return [
    `Design ONE professional TikTok LIVE graphic for the streamer "${name}" — vertical 9:16 portrait. It must look made by a top streamer-branding studio (the level of pro Twitch / TikTok overlay packs): crisp, bold, premium, never a generic AI image.`,
    `PIECE: ${piece[kind]}`,
    `LOOK: ${VIBE[inp.vibe]}.`,
    inp.colors.trim() ? `COLOURS: ${inp.colors.trim().slice(0, 100)} — the whole piece is built from these colours.` : "COLOURS: a strong 2–3 colour palette that fits the look.",
    matchRef ? `KIT MATCH: the reference image is another piece of the SAME kit — use exactly its colours, materials, lettering style, shapes, border details and effects so every piece looks like one matching set. Do not copy its layout or its words.` : "",
    hasLogo ? `LOGO: the streamer's logo (reference image) appears crisp and faithful (same shape, letters and colours), as a clean emblem${isOverlay(kind) ? " on the plate / bar" : " near the name"}.` : "",
    `TEXT: the only text is ${texts.join(", ")} — spelled exactly. No other words, no fake usernames, no follower counts, no chat messages, no platform logos, no watermarks.`,
    `PHONE-SAFE: keep text away from the top 8% and bottom 12% edges${isOverlay(kind) ? " (except the slim bars described)" : ""} and from the right edge, where TikTok shows its own buttons. Lettering razor-sharp and readable on a phone.`,
    isOverlay(kind) ? "" : "Fill the frame edge to edge with the designed background — depth, light, particles — no borders around the image.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Pure-green areas → transparent (soft edge + green spill removed), for the overlays. */
export async function keyGreen(img: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(img).resize(W, H, { fit: "cover" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const greenness = g - Math.max(r, b); // how much greener than the other channels
    // only the pure key green — neon / lime greens in the design (with some red in them) are kept
    if (g > 160 && r < 95 && b < 95 && greenness > 100) {
      data[i * 4 + 3] = 0;
    } else if (greenness > 60 && r < 150 && b < 150) {
      // edge: partly transparent, and the green spill pulled out
      const a = 1 - (greenness - 60) / 60;
      data[i * 4 + 3] = Math.round(data[i * 4 + 3] * Math.max(0, Math.min(1, a)));
      data[i * 4 + 1] = Math.max(r, b);
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/** Makes every piece of a kit: the first one sets the look, the rest follow it in parallel. Refunds failed pieces. */
export async function runStreamKit(id: string) {
  const kit = await db.streamKit.findUnique({ where: { id } });
  if (!kit) return;
  const inp = kit.inputs as unknown as StreamInputs;
  const items = (kit.items as unknown as StreamItem[]).map((x) => ({ ...x }));
  const save = () => db.streamKit.update({ where: { id }, data: { items: items as never } });
  let logo: { bytes: Buffer; type: string } | null = null;
  if (inp.logoUrl) {
    try {
      logo = { bytes: await sharp(await loadBytes(inp.logoUrl)).resize(768, 768, { fit: "inside" }).png().toBuffer(), type: "image/png" };
    } catch {
      logo = null;
    }
  }
  let match: { bytes: Buffer; type: string } | null = null;
  const make = async (n: number) => {
    const it = items[n];
    it.status = "making";
    await save();
    try {
      const refs = [...(match ? [match] : []), ...(logo ? [logo] : [])];
      const raw = await generatePoster(streamPrompt(inp, it.kind, !!match, !!logo), refs, "medium", ["1152x2048", "1024x1536"], 300_000);
      const out = isOverlay(it.kind) ? await keyGreen(raw) : await sharp(raw).resize(W, H, { fit: "cover" }).png().toBuffer();
      it.url = await saveFile("stream-kits", out, "image/png");
      it.status = "ready";
      if (!match && !isOverlay(it.kind)) match = { bytes: await sharp(out).resize(576, 1024).png().toBuffer(), type: "image/png" };
    } catch (e) {
      it.status = "failed";
      it.error = String(e instanceof Error ? e.message : e).slice(0, 200);
    }
    await save();
  };
  // the first full-screen piece sets the look for the kit
  const firstIdx = items.findIndex((x) => !isOverlay(x.kind));
  if (firstIdx >= 0) await make(firstIdx);
  await Promise.all(items.map((_, n) => (n === firstIdx ? null : make(n))));
  const failed = items.filter((x) => x.status === "failed").length;
  if (failed && kit.cost > 0) {
    const back = Math.round((kit.cost * failed) / items.length);
    if (back > 0) await changeCredits({ userId: kit.userId, amount: back, type: "REFUND", note: `Streamer kit: ${failed} piece(s) failed` }).catch(() => {});
  }
  await db.streamKit.update({ where: { id }, data: { items: items as never, status: "DONE" } });
}
