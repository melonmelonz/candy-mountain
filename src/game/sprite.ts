import type { Facing } from "./types";
import type { CharDef } from "./roster";
import { DIR_ORDER, facingToDir8, resolveDir } from "./roster";
import type { Assets } from "./assets";

export const CELL = 88;
export const COLS = 7;
const WALK_FRAMES = 6; // cols 1..6
const WALK_FPS = 10;

// sprite sheet rows by facing: south=down, east=right, north=up, west=left
const ROW: Record<Facing, number> = { down: 0, right: 1, up: 2, left: 3 };

const tintCache = new Map<number, HTMLCanvasElement>();

// Returns a hue-tinted copy of the whole drifter sheet, cached by rounded hue.
// "color" composite recolors the suit; "destination-in" restores the original
// alpha so transparent cells stay transparent and the visor highlight survives.
export function tintedSheet(base: HTMLImageElement, hue: number): HTMLCanvasElement {
  const key = Math.round(hue) % 360;
  const hit = tintCache.get(key);
  if (hit) return hit;

  const cv = document.createElement("canvas");
  cv.width = base.width; cv.height = base.height;
  const c = cv.getContext("2d")!;
  c.drawImage(base, 0, 0);
  c.globalCompositeOperation = "color";
  c.fillStyle = `hsl(${key} 70% 55%)`;
  c.fillRect(0, 0, cv.width, cv.height);
  c.globalCompositeOperation = "destination-in";
  c.drawImage(base, 0, 0);
  c.globalCompositeOperation = "source-over";

  tintCache.set(key, cv);
  return cv;
}

// Picks the sheet column for the current motion state.
export function frameCol(moving: boolean, tMs: number): number {
  if (!moving) return 0;
  return 1 + (Math.floor(tMs / (1000 / WALK_FPS)) % WALK_FRAMES);
}

// Blits one drifter cell centered at (px, py) device pixels, scaled by `scale`.
export function drawDrifter(
  ctx: CanvasRenderingContext2D,
  sheet: CanvasImageSource,
  facing: Facing,
  moving: boolean,
  px: number,
  py: number,
  scale: number,
  tMs: number,
) {
  const sxCell = frameCol(moving, tMs) * CELL;
  const syCell = ROW[facing] * CELL;
  const dw = CELL * scale, dh = CELL * scale;
  ctx.drawImage(sheet, sxCell, syCell, CELL, CELL, px - dw / 2, py - dh / 2, dw, dh);
}

// Scratch canvas reused across frames to build the inverted cell once per call.
let shimmerScratch: HTMLCanvasElement | null = null;

// Photo-negative overlay of one drifter cell, blended at `alpha` over whatever
// is already drawn at (px,py). Marks drifters standing in the inverted far half.
// RGB is inverted ("difference" against white) while the sprite's alpha mask is
// preserved ("destination-in"), so transparent cells stay transparent.
export function drawNegativeShimmer(
  ctx: CanvasRenderingContext2D,
  sheet: CanvasImageSource,
  facing: Facing,
  moving: boolean,
  px: number,
  py: number,
  scale: number,
  tMs: number,
  alpha: number,
) {
  if (alpha <= 0.01) return;
  if (!shimmerScratch) {
    shimmerScratch = document.createElement("canvas");
    shimmerScratch.width = CELL;
    shimmerScratch.height = CELL;
  }
  const c = shimmerScratch.getContext("2d")!;
  const sxCell = frameCol(moving, tMs) * CELL;
  const syCell = ROW[facing] * CELL;

  c.globalCompositeOperation = "source-over";
  c.clearRect(0, 0, CELL, CELL);
  c.drawImage(sheet, sxCell, syCell, CELL, CELL, 0, 0, CELL, CELL);
  c.globalCompositeOperation = "difference";
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, CELL, CELL);
  c.globalCompositeOperation = "destination-in";
  c.drawImage(sheet, sxCell, syCell, CELL, CELL, 0, 0, CELL, CELL);
  c.globalCompositeOperation = "source-over";

  const dw = CELL * scale, dh = CELL * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(shimmerScratch, px - dw / 2, py - dh / 2, dw, dh);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Manifest-driven 8-direction character renderer (Task 3)
// ---------------------------------------------------------------------------

/** State names that represent idle animations. First match wins. */
export const IDLE_STATES: string[] = ["breathing-idle", "animating"];
/** State names that represent walk/move animations. First match wins. */
export const MOVE_STATES: string[] = ["walking"];

/**
 * Returns the animation frame index for the given playback parameters.
 * Guard: if `frames` <= 0, returns 0.
 */
export function pickFrame(fps: number, frames: number, tMs: number): number {
  if (frames <= 0) return 0;
  return Math.floor(tMs / (1000 / fps)) % frames;
}

/**
 * Returns the state name to use for the given character and motion state,
 * or null if no suitable state is available (fall back to rotation still).
 *
 * Rules:
 * - moving: check MOVE_STATES first; if none found, fall through to idle.
 * - not moving (or no move state found): check IDLE_STATES.
 * - NEVER returns a state outside IDLE_STATES / MOVE_STATES.
 */
export function selectState(char: CharDef, moving: boolean): string | null {
  if (moving) {
    for (const name of MOVE_STATES) {
      if (name in char.states) return name;
    }
    // no walk state — fall through to idle
  }
  for (const name of IDLE_STATES) {
    if (name in char.states) return name;
  }
  return null;
}

/** On-screen footprint baseline: target pixel height for all characters. */
export const TARGET_PX = 72;

/** Scratch canvas for the new shimmer implementation (char-sized). */
let charShimmerScratch: HTMLCanvasElement | null = null;

// ---------------------------------------------------------------------------
// Private helper: shared cell resolution
// ---------------------------------------------------------------------------

interface ResolvedCell {
  img: HTMLImageElement;
  sx: number;
  sy: number;
  cell: number;
}

/**
 * Resolves the atlas image and source rect for a given character, facing, and
 * motion state. Returns null if the character is undefined or has no usable
 * image loaded.
 *
 * Resolution order:
 * 1. selectState -> facingToDir8 -> resolveDir against the state atlas.
 * 2. Fallback: resolveDir against rotations.dirs (still frame, fps irrelevant).
 *
 * fps is chosen here (10 for walk, 4 for idle) so callers never need to
 * re-examine MOVE_STATES.
 */
function resolveCell(
  assets: Assets,
  charIndex: number,
  facing: Facing,
  moving: boolean,
  tMs: number,
): ResolvedCell | null {
  const char = assets.roster.characters[charIndex];
  if (!char) return null;

  const want = facingToDir8(facing);
  const stateName = selectState(char, moving);
  const cell = char.cell;

  if (stateName !== null) {
    const st = char.states[stateName];
    const dir = resolveDir(want, st.dirs);
    if (dir !== null) {
      const img = assets.images.get(st.file);
      if (img) {
        const fps = MOVE_STATES.includes(stateName) ? 10 : 4;
        const col = pickFrame(fps, st.frames, tMs);
        const row = DIR_ORDER.indexOf(dir);
        return { img, sx: col * cell, sy: row * cell, cell };
      }
    }
  }

  // Fallback: rotation still
  const dir = resolveDir(want, char.rotations.dirs);
  if (dir === null) return null;
  const img = assets.images.get(char.rotations.file);
  if (!img) return null;
  const col = DIR_ORDER.indexOf(dir);
  return { img, sx: col * cell, sy: 0, cell };
}

/**
 * Draw a manifest-driven character at (px, py) in world-space device pixels.
 * The character's native `cell` px is scaled to TARGET_PX * worldScale.
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  charIndex: number,
  facing: Facing,
  moving: boolean,
  px: number,
  py: number,
  worldScale: number,
  tMs: number,
): void {
  const resolved = resolveCell(assets, charIndex, facing, moving, tMs);
  if (!resolved) return;

  const { img, sx, sy, cell } = resolved;
  const drawScale = (TARGET_PX / cell) * worldScale;
  const dw = cell * drawScale;
  const dh = cell * drawScale;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, cell, cell, px - dw / 2, py - dh / 2, dw, dh);
}

/**
 * Photo-negative overlay for the far-side shimmer effect, using the same
 * atlas cell selection as drawCharacter. Skipped when alpha <= 0.01.
 */
export function drawNegativeShimmerChar(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  charIndex: number,
  facing: Facing,
  moving: boolean,
  px: number,
  py: number,
  worldScale: number,
  tMs: number,
  alpha: number,
): void {
  if (alpha <= 0.01) return;

  const resolved = resolveCell(assets, charIndex, facing, moving, tMs);
  if (!resolved) return;

  const { img, sx, sy, cell } = resolved;

  // Build/resize the scratch canvas to match this character's cell size.
  if (!charShimmerScratch) {
    charShimmerScratch = document.createElement("canvas");
  }
  if (charShimmerScratch.width !== cell || charShimmerScratch.height !== cell) {
    charShimmerScratch.width = cell;
    charShimmerScratch.height = cell;
  }

  const c = charShimmerScratch.getContext("2d")!;

  c.globalCompositeOperation = "source-over";
  c.clearRect(0, 0, cell, cell);
  c.drawImage(img, sx, sy, cell, cell, 0, 0, cell, cell);
  c.globalCompositeOperation = "difference";
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, cell, cell);
  c.globalCompositeOperation = "destination-in";
  c.drawImage(img, sx, sy, cell, cell, 0, 0, cell, cell);
  c.globalCompositeOperation = "source-over";

  const drawScale = (TARGET_PX / cell) * worldScale;
  const dw = cell * drawScale;
  const dh = cell * drawScale;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.drawImage(charShimmerScratch, px - dw / 2, py - dh / 2, dw, dh);
  ctx.restore();
}
