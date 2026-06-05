import type { Facing } from "./types";
import type { CharDef } from "./roster";
import { DIR_ORDER, facingToDir8, resolveDir } from "./roster";
import type { Assets } from "./assets";

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
