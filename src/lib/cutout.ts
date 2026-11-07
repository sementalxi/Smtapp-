// Logo cut-outs: turn a crest on a solid background (white / black square…) into a transparent PNG.
// Free and instant for solid backgrounds (flood fill from the edges); complex backgrounds go to the AI
// background remover (Replicate) when it is configured. Results are cached per source URL.
import sharp from "sharp";
import { createHash } from "crypto";
import { db } from "./db";
import { loadBytes, saveFile } from "./storage";
import { canRemoveBackground, removeBackground } from "./ai";

type Method = "alpha" | "flood" | "ai" | "none";

const dist = (a: number[], b: number[]) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

/**
 * A crest that is already transparent outside but sits on a solid backdrop (white sticker, torn-paper disc, plain
 * square): the opaque pixels touching the transparent area all share one colour. Flood that colour inwards from the
 * transparent area and fade its edge. Returns the new RGBA pixels, or null when there is no such backdrop.
 */
function stickerCutout(src: Buffer, W: number, H: number): Buffer | null {
  const data = Buffer.from(src);
  const rgb = (i: number) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  const isClear = (i: number) => data[i * 4 + 3] < 16;
  // The ring: solid pixels right next to the transparent area.
  const ring: number[][] = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (data[i * 4 + 3] < 160) continue;
    if (isClear(i - 1) || isClear(i + 1) || isClear(i - W) || isClear(i + W)) ring.push(rgb(i));
  }
  if (ring.length < 40) return null;
  const med = [0, 1, 2].map((k) => ring.map((c) => c[k]).sort((a, b) => a - b)[ring.length >> 1]);
  const agree = ring.filter((c) => dist(c, med) < 40).length / ring.length;
  if (agree < 0.7) return null; // the logo itself touches the edge: nothing to peel off
  const tol = 46;
  const seen = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let i = 0; i < W * H; i++) if (isClear(i)) { seen[i] = 1; stack.push(i); }
  const clearStart = stack.length;
  let opaque = W * H - clearStart;
  let filled = 0;
  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % W;
    const y = (idx - x) / W;
    for (const n of [x > 0 ? idx - 1 : -1, x < W - 1 ? idx + 1 : -1, y > 0 ? idx - W : -1, y < H - 1 ? idx + W : -1]) {
      if (n < 0 || seen[n]) continue;
      if (dist(rgb(n), med) > tol) continue;
      seen[n] = 1;
      data[n * 4 + 3] = 0;
      filled++;
      stack.push(n);
    }
  }
  if (filled < opaque * 0.05 || filled > opaque * 0.9) return null; // tiny speck, or it would eat the whole logo
  // Soft edge: pixels next to the removed backdrop that are still close to its colour fade out.
  const fade = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (seen[i]) continue;
    const near = (x > 0 && seen[i - 1]) || (x < W - 1 && seen[i + 1]) || (y > 0 && seen[i - W]) || (y < H - 1 && seen[i + W]);
    if (!near) continue;
    const d = dist(rgb(i), med);
    if (d < tol * 1.8) fade[i] = Math.round(Math.min(255, (d / (tol * 1.8)) * data[i * 4 + 3]));
    else fade[i] = 255;
  }
  for (let i = 0; i < W * H; i++) if (fade[i] && fade[i] < 255) data[i * 4 + 3] = Math.min(data[i * 4 + 3], fade[i]);
  return data;
}

/** Flood-fills the outside background (if it is one solid colour) to transparent. */
async function floodCutout(bytes: Buffer): Promise<{ png: Buffer; method: Method }> {
  const img = sharp(bytes).ensureAlpha().resize(640, 640, { fit: "inside", withoutEnlargement: true });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  // Already transparent somewhere? Then it is a real PNG cut-out — keep it.
  let clear = 0;
  for (let i = 3; i < data.length; i += 4 * 7) if (data[i] < 16) clear++;
  if (clear > (data.length / 28) * 0.02) {
    // Transparent outside — but many "PNG" crests sit on a white (or other solid) sticker/disc. Remove that too.
    const sticker = stickerCutout(data, W, H);
    if (sticker) return { png: await sharp(sticker, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(), method: "flood" };
    return { png: await sharp(bytes).png().toBuffer(), method: "alpha" };
  }
  // The background colour: the four corners must agree.
  const block = (cx: number, cy: number) => {
    const c = [0, 0, 0];
    let n = 0;
    for (let y = cy; y < cy + 4; y++) for (let x = cx; x < cx + 4; x++) {
      const p = px(Math.min(W - 1, x), Math.min(H - 1, y));
      c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; n++;
    }
    return c.map((v) => v / n);
  };
  const corners = [block(0, 0), block(W - 4, 0), block(0, H - 4), block(W - 4, H - 4)];
  let spread = 0;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) spread = Math.max(spread, dist(corners[i], corners[j]));
  if (spread > 60) return { png: bytes, method: "none" }; // not a solid background
  const bg = [0, 1, 2].map((k) => corners.reduce((s, c) => s + c[k], 0) / 4);
  const tol = 52;
  const seen = new Uint8Array(W * H);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const idx = y * W + x;
    if (seen[idx]) return;
    const p = px(x, y);
    if (dist(p, bg) > tol) return;
    seen[idx] = 1;
    stack.push(idx);
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  let filled = 0;
  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % W;
    const y = (idx - x) / W;
    data[idx * 4 + 3] = 0;
    filled++;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }
  if (filled < W * H * 0.03) return { png: bytes, method: "none" }; // nothing to remove
  // Soften the edge: pixels next to removed ones that are close to the background colour fade out.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (seen[i]) continue;
    const near = (x > 0 && seen[i - 1]) || (x < W - 1 && seen[i + 1]) || (y > 0 && seen[i - W]) || (y < H - 1 && seen[i + W]);
    if (!near) continue;
    const d = dist(px(x, y), bg);
    if (d < tol * 1.8) data[i * 4 + 3] = Math.round(Math.min(255, (d / (tol * 1.8)) * 255));
  }
  const png = await sharp(Buffer.from(data.buffer, data.byteOffset, data.length), { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  return { png, method: "flood" };
}

/** The crest as a transparent PNG (trimmed). Solid backgrounds are removed locally; others by the AI remover when available. */
export async function cutoutLogo(bytes: Buffer, contentType = "image/png"): Promise<{ png: Buffer; method: Method }> {
  let r = await floodCutout(bytes).catch(() => ({ png: bytes, method: "none" as Method }));
  if (r.method === "none" && canRemoveBackground()) {
    try {
      r = { png: await removeBackground(bytes, contentType), method: "ai" };
    } catch {
      /* keep the original */
    }
  }
  if (r.method === "none") return r;
  const trimmed = await sharp(r.png).trim({ threshold: 10 }).png().toBuffer().catch(() => r.png);
  return { png: trimmed, method: r.method };
}

const key = (url: string) => `cutout:${createHash("sha1").update(url).digest("hex").slice(0, 24)}`;

/** Cached cut-out for a stored crest URL — made once, reused by every poster. Falls back to the original bytes. */
export async function cutoutCached(url: string): Promise<Buffer> {
  const k = key(url);
  const hit = await db.setting.findUnique({ where: { key: k } }).catch(() => null);
  if (hit?.value) {
    if (hit.value === "same") return loadBytes(url);
    try {
      return await loadBytes(hit.value);
    } catch {
      /* re-make it */
    }
  }
  const bytes = await loadBytes(url);
  const { png, method } = await cutoutLogo(bytes);
  if (method === "none") {
    await db.setting.upsert({ where: { key: k }, create: { key: k, value: "same" }, update: { value: "same" } }).catch(() => {});
    return bytes;
  }
  const saved = await saveFile("logos", png, "image/png").catch(() => "");
  if (saved) await db.setting.upsert({ where: { key: k }, create: { key: k, value: saved }, update: { value: saved } }).catch(() => {});
  return png;
}
