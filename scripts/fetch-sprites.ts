#!/usr/bin/env bun
/**
 * fetch-sprites.ts
 *
 * Downloads all 17 character bundles + 6 gate bundles from PixelLab,
 * composes local atlas PNGs and writes manifests.
 *
 * Run: bun run scripts/fetch-sprites.ts
 *
 * Outputs:
 *   public/sprites/roster/<slug>/rotations.png
 *   public/sprites/roster/<slug>/<state>.png
 *   public/sprites/roster/manifest.json
 *   public/sprites/gates/<id>.png
 *   public/sprites/gates/manifest.json
 */

import AdmZip from "adm-zip";
import sharp from "sharp";
import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Configuration - edit these arrays to update the roster / gate list
// ---------------------------------------------------------------------------

const CHARACTERS: Array<{ name: string; id: string }> = [
  { name: "Medusa - Voidborne",  id: "5ee03ea4-c95f-4243-a434-0f31450ae0ed" },
  { name: "Ra - Void Sun",       id: "562dad1d-de6d-4b30-9f4b-3553a6270c12" },
  { name: "Nyx",                 id: "55c22e33-5310-4eec-9a30-1f251feaf425" },
  { name: "Hel",                 id: "abdaf8bc-c36f-43e9-a60b-6ca6fc1eb715" },
  { name: "Chang'e",             id: "4194633e-cc65-4eb3-8f0c-45727b43aec9" },
  { name: "Ammit",               id: "d83dbb58-b624-46bc-b26f-73574935fd27" },
  { name: "Rakshasa",            id: "4602f9c9-57cc-428e-9fdd-792854b16b05" },
  { name: "Zhong Kui",           id: "7d36a4a1-ffb2-406d-ace5-921d466c66d4" },
  { name: "Durga",               id: "03d0f1cf-f037-4472-92a1-a8aae564b176" },
  { name: "Thoth",               id: "77938e01-4d99-44e2-a500-5c792929d407" },
  { name: "Thorn",               id: "5ad98f09-0c8b-47b3-91b0-d59cc4e3c015" },
  { name: "Heavy Armor",         id: "dee205f7-2481-40d0-897c-57f1d84945cb" },
  { name: "Laser Sword",         id: "a436af05-2074-4e98-b723-bbdc2205e0b2" },
  { name: "Lilac Drifter",       id: "109e06d8-67fb-4c79-addc-33f81fa110e4" },
  { name: "Drifter",             id: "6507e911-a823-4333-87a6-d07150548e45" },
  { name: "Red Hair",            id: "e0e0dba8-2feb-45ce-9865-b934db108a11" },
  { name: "Cindra",              id: "96145df5-d103-465b-b93c-82dbcfd3f0e2" },
];

const GATES: Array<{ id: string; look: string }> = [
  { id: "d371f1dc-b42f-4028-8cdb-35c6943e666e", look: "blue spiral galaxy in stone ring" },
  { id: "219a17cd-640b-46da-9c9e-0bbebcf170b5", look: "red eldritch maw" },
  { id: "00556895-076a-4ca7-9c7f-1fda8fc0fcb5", look: "gothic blue arched gate" },
  { id: "0c074dde-67c6-4907-8ae7-cc927e2a453a", look: "teal cosmic swirl" },
  { id: "cde806b2-abef-4854-aaea-605fa7347dec", look: "deep-purple void eye" },
  { id: "cb9c27af-7a4f-4c87-ad25-4a8267ed15a8", look: "green nebula sphere" },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.pixellab.ai/mcp";
const OUT_ROOT = path.resolve(import.meta.dir, "../public/sprites");
const ROSTER_DIR = path.join(OUT_ROOT, "roster");
const GATES_DIR = path.join(OUT_ROOT, "gates");

const DIR_ORDER = [
  "south",
  "south-east",
  "east",
  "north-east",
  "north",
  "north-west",
  "west",
  "south-west",
] as const;
type Dir8 = (typeof DIR_ORDER)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a display name to a URL/file-system slug. */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Derive a clean state slug from a PixelLab animation key.
 * Keys look like "walking-8463e3bf" or
 * "leaning_forward_unleashing_a_petrifying_gaze_eyes-67655cde".
 * Strip the trailing -<8hexchars> hash, then slugify.
 */
function stateSlug(animKey: string): string {
  const noHash = animKey.replace(/-[0-9a-f]{8}$/, "");
  return noHash
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Download a URL and return a Buffer. */
async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Make a transparent PNG of size w x h using sharp. */
async function transparentCell(w: number, h: number): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();
}

/** Read a PNG from a zip entry and return its Buffer. */
function zipEntryBuf(zip: AdmZip, entryName: string): Buffer | null {
  const entry = zip.getEntry(entryName);
  if (!entry) return null;
  return entry.getData();
}

// ---------------------------------------------------------------------------
// PixelLab metadata types
// ---------------------------------------------------------------------------

interface PixelMetadata {
  states: Array<{
    character?: {
      size?: { width: number; height: number };
    };
    frames: {
      rotations: Partial<Record<string, string>>;
      animations: Record<string, Partial<Record<string, string[]>>>;
    };
  }>;
}

// ---------------------------------------------------------------------------
// Character processing
// ---------------------------------------------------------------------------

interface CharManifestEntry {
  slug: string;
  name: string;
  cell: number;
  dirOrder: readonly string[];
  rotations: { file: string; dirs: string[] };
  states: Record<string, { file: string; frames: number; dirs: string[] }>;
}

async function processCharacter(
  char: { name: string; id: string }
): Promise<CharManifestEntry> {
  const slug = toSlug(char.name);
  console.log(`  [char] ${char.name} (${slug}) ...`);

  const zipBuf = await download(`${BASE_URL}/characters/${char.id}/download`);
  const zip = new AdmZip(zipBuf);

  // Parse metadata.json
  const metaBuf = zipEntryBuf(zip, "metadata.json");
  if (!metaBuf) throw new Error(`No metadata.json in bundle for ${char.name}`);
  const meta: PixelMetadata = JSON.parse(metaBuf.toString("utf8"));

  const state0 = meta.states[0];
  if (!state0) throw new Error(`Empty states in metadata for ${char.name}`);

  // Determine cell size from metadata or by reading a rotation PNG
  let cell: number;
  if (state0.character?.size?.width) {
    cell = state0.character.size.width;
  } else {
    // Fall back: read first available rotation PNG
    const firstRotPath = Object.values(state0.frames.rotations)[0];
    if (!firstRotPath) throw new Error(`No rotations in bundle for ${char.name}`);
    const buf = zipEntryBuf(zip, firstRotPath);
    if (!buf) throw new Error(`Missing file ${firstRotPath} in bundle for ${char.name}`);
    const info = await sharp(buf).metadata();
    cell = info.width ?? 64;
  }

  const charDir = path.join(ROSTER_DIR, slug);
  await mkdir(charDir, { recursive: true });

  // ---- Rotations atlas (single row, 8 cells) ----
  const rotFrames = state0.frames.rotations;
  const rotComposites: sharp.OverlayOptions[] = [];
  const presentRotDirs: string[] = [];

  for (let di = 0; di < DIR_ORDER.length; di++) {
    const dir = DIR_ORDER[di];
    const entryPath = rotFrames[dir];
    if (entryPath) {
      const buf = zipEntryBuf(zip, entryPath);
      if (buf) {
        rotComposites.push({ input: buf, left: di * cell, top: 0 });
        presentRotDirs.push(dir);
      }
    }
  }

  const rotAtlasW = DIR_ORDER.length * cell;
  const rotAtlasH = cell;
  const rotOut = path.join(charDir, "rotations.png");
  await sharp({
    create: { width: rotAtlasW, height: rotAtlasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(rotComposites)
    .png()
    .toFile(rotOut);

  console.log(`    rotations: ${presentRotDirs.length}/8 dirs  (${rotAtlasW}x${rotAtlasH})`);

  // ---- Animation state atlases ----
  const statesManifest: CharManifestEntry["states"] = {};
  // Track how many times each slug appears so we can suffix duplicates
  const slugCount: Record<string, number> = {};

  for (const [animKey, dirMap] of Object.entries(state0.frames.animations)) {
    const baseSlug = stateSlug(animKey);

    // Collect all frame counts per direction to find max
    let maxFrames = 0;
    const dirFramePaths: Partial<Record<string, string[]>> = {};
    for (const [dirRaw, framePaths] of Object.entries(dirMap)) {
      if (framePaths && framePaths.length > 0) {
        dirFramePaths[dirRaw] = framePaths;
        maxFrames = Math.max(maxFrames, framePaths.length);
      }
    }
    if (maxFrames === 0) continue;

    // Count present directions for this anim
    const candidateDirs = Object.keys(dirFramePaths);

    // Resolve state name: if this slug already used, check if new one is better
    // (more directions) - if so replace; otherwise suffix with _2, _3, ...
    let stateName = baseSlug;
    if (statesManifest[stateName]) {
      const existing = statesManifest[stateName];
      if (candidateDirs.length > existing.dirs.length) {
        // New version is better - drop old, use same key (will overwrite)
        console.log(`    replacing state "${stateName}" with better version (${candidateDirs.length} dirs > ${existing.dirs.length} dirs)`);
      } else {
        // Suffix it
        slugCount[baseSlug] = (slugCount[baseSlug] ?? 1) + 1;
        stateName = `${baseSlug}-${slugCount[baseSlug]}`;
      }
    }
    slugCount[baseSlug] = slugCount[baseSlug] ?? 1;

    const presentDirs: string[] = [];
    const composites: sharp.OverlayOptions[] = [];

    for (let di = 0; di < DIR_ORDER.length; di++) {
      const dir = DIR_ORDER[di];
      const framePaths = dirFramePaths[dir];
      if (!framePaths) continue;
      presentDirs.push(dir);

      for (let fi = 0; fi < maxFrames; fi++) {
        const entryPath = framePaths[fi] ?? framePaths[framePaths.length - 1]; // repeat last frame if short
        const buf = zipEntryBuf(zip, entryPath);
        if (buf) {
          composites.push({ input: buf, left: fi * cell, top: di * cell });
        }
      }
    }

    const atlasW = maxFrames * cell;
    const atlasH = DIR_ORDER.length * cell;
    const atlasFile = `${slug}/${stateName}.png`;
    const atlasOut = path.join(charDir, `${stateName}.png`);

    await sharp({
      create: { width: atlasW, height: atlasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite(composites)
      .png()
      .toFile(atlasOut);

    statesManifest[stateName] = {
      file: atlasFile,
      frames: maxFrames,
      dirs: presentDirs,
    };
    console.log(`    state "${stateName}": ${presentDirs.length} dirs x ${maxFrames} frames  (${atlasW}x${atlasH})`);
  }

  if (Object.keys(statesManifest).length === 0) {
    console.warn(`    WARNING: ${char.name} has NO animation states (stills only)`);
  }

  return {
    slug,
    name: char.name,
    cell,
    dirOrder: DIR_ORDER,
    rotations: {
      file: `${slug}/rotations.png`,
      dirs: presentRotDirs,
    },
    states: statesManifest,
  };
}

// ---------------------------------------------------------------------------
// Gate processing
// ---------------------------------------------------------------------------

interface GateManifestEntry {
  id: string;
  cell: number;
  frames: number;
  file: string;
}

async function processGate(gate: { id: string; look: string }): Promise<GateManifestEntry> {
  console.log(`  [gate] ${gate.id} (${gate.look}) ...`);

  const zipBuf = await download(`${BASE_URL}/objects/${gate.id}/download`);
  const zip = new AdmZip(zipBuf);

  const entries = zip.getEntries().map((e) => e.entryName);

  // Find animation frames: animations/<group>/unknown/frame_NNN.png
  const frameEntries = entries
    .filter((e) => e.startsWith("animations/") && e.endsWith(".png"))
    .sort();

  let frameBufs: Buffer[] = [];
  let cell = 64;

  if (frameEntries.length > 0) {
    for (const entryName of frameEntries) {
      const buf = zipEntryBuf(zip, entryName);
      if (buf) {
        if (frameBufs.length === 0) {
          // Detect cell size from first frame
          const info = await sharp(buf).metadata();
          cell = info.width ?? 64;
        }
        frameBufs.push(buf);
      }
    }
    console.log(`    animation: ${frameBufs.length} frames, cell=${cell}`);
  } else {
    // Fall back to static rotation
    const rotBuf = zipEntryBuf(zip, "rotations/unknown.png");
    if (!rotBuf) throw new Error(`No animation frames AND no rotations/unknown.png for gate ${gate.id}`);
    const info = await sharp(rotBuf).metadata();
    cell = info.width ?? 64;
    frameBufs = [rotBuf];
    console.warn(`    WARNING: gate ${gate.id} has NO animation frames - falling back to static rotation (1 frame)`);
  }

  const frames = frameBufs.length;
  const stripW = frames * cell;
  const stripH = cell;

  const composites: sharp.OverlayOptions[] = frameBufs.map((buf, fi) => ({
    input: buf,
    left: fi * cell,
    top: 0,
  }));

  const outFile = `${gate.id}.png`;
  const outPath = path.join(GATES_DIR, outFile);

  await sharp({
    create: { width: stripW, height: stripH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png()
    .toFile(outPath);

  console.log(`    strip: ${stripW}x${stripH}  (${frames} frames)`);

  return { id: gate.id, cell, frames, file: outFile };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await mkdir(ROSTER_DIR, { recursive: true });
  await mkdir(GATES_DIR, { recursive: true });

  // --- Characters ---
  console.log(`\nProcessing ${CHARACTERS.length} characters...`);
  const charManifest: CharManifestEntry[] = [];
  const noAnimChars: string[] = [];

  for (const char of CHARACTERS) {
    const entry = await processCharacter(char);
    charManifest.push(entry);
    if (Object.keys(entry.states).length === 0) {
      noAnimChars.push(entry.name);
    }
  }

  await writeFile(
    path.join(ROSTER_DIR, "manifest.json"),
    JSON.stringify({ characters: charManifest }, null, 2) + "\n",
    "utf8"
  );
  console.log(`\nWrote roster manifest: ${charManifest.length} characters`);

  // --- Gates ---
  console.log(`\nProcessing ${GATES.length} gates...`);
  const gateManifest: GateManifestEntry[] = [];
  const staticGates: string[] = [];

  for (const gate of GATES) {
    const entry = await processGate(gate);
    gateManifest.push(entry);
    if (entry.frames === 1) {
      staticGates.push(gate.id);
    }
  }

  await writeFile(
    path.join(GATES_DIR, "manifest.json"),
    JSON.stringify({ gates: gateManifest }, null, 2) + "\n",
    "utf8"
  );
  console.log(`\nWrote gates manifest: ${gateManifest.length} gates`);

  // --- Summary ---
  console.log("\n=== SUMMARY ===");
  console.log(`  Characters: ${charManifest.length}/17`);
  console.log(`  Gates:      ${gateManifest.length}/6`);

  if (noAnimChars.length > 0) {
    console.warn(`  WARN: Characters with NO animation states (stills only):`);
    for (const n of noAnimChars) console.warn(`    - ${n}`);
  }

  if (staticGates.length > 0) {
    console.warn(`  WARN: Gates that fell back to static (animation not ready):`);
    for (const id of staticGates) console.warn(`    - ${id}`);
  }

  // --- Spot-check 3 atlases ---
  console.log("\n=== SPOT CHECK ===");
  const checks = [charManifest[0], charManifest[8], charManifest[15]];
  for (const c of checks) {
    const rotPath = path.join(ROSTER_DIR, c.rotations.file);
    const info = await sharp(rotPath).metadata();
    console.log(`  ${c.name}: rotations.png = ${info.width}x${info.height}  cell=${c.cell}`);
    for (const [st, sd] of Object.entries(c.states)) {
      const sp = path.join(ROSTER_DIR, sd.file);
      const si = await sharp(sp).metadata();
      console.log(`    state "${st}": ${si.width}x${si.height}  (${sd.dirs.length} dirs x ${sd.frames} frames)`);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
