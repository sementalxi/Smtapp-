// Copies the flag SVGs (flag-icons package) into public/flags at build time, so the qualifiers table can draw
// real flags for the flag emojis people type. Never fails the build: without the package there are no flags
// (the table falls back to globe icons).
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const src = join(process.cwd(), "node_modules", "flag-icons", "flags", "4x3");
const dst = join(process.cwd(), "public", "flags");
try {
  if (!existsSync(src)) {
    console.log("copy-flags: flag-icons not installed — no flags copied");
  } else {
    mkdirSync(dst, { recursive: true });
    cpSync(src, dst, { recursive: true });
    console.log(`copy-flags: ${readdirSync(dst).length} flags ready`);
  }
} catch (e) {
  console.log("copy-flags: skipped", e?.message ?? e);
}
