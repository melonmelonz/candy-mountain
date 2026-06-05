import type { Facing } from "./types";

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
