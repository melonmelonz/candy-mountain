import { ROOM_CONFIG } from "./config";

export interface Camera { locked: boolean; t: number; last: number; } // t: 0 spawn .. 1 ritual; last = prev tMs
export function createCamera(): Camera { return { locked: false, t: 0, last: 0 }; }

const SPAWN_ZOOM = 1.3;
const SPAWN_FOCUS_X_FRAC = 0.266; // arena focus x as fraction of arenaWidth (~340/1280)
const LOCK_DIST = 170;            // arena units from gate that trigger the lock
const LOCK_MS = 1000;             // ease duration once latched

function easeInOut(x: number): number { return x < 0.5 ? 2*x*x : 1 - Math.pow(-2*x + 2, 2)/2; }

// Latch + ease. Call once per frame BEFORE drawing. selfX/selfY in ARENA coords.
export function updateCamera(cam: Camera, selfX: number, selfY: number, tMs: number): void {
  const dt = cam.last === 0 ? 0 : tMs - cam.last;
  cam.last = tMs;
  const gx = ROOM_CONFIG.seamX, gy = ROOM_CONFIG.arenaHeight / 2;
  if (!cam.locked && Math.hypot(selfX - gx, selfY - gy) <= LOCK_DIST) cam.locked = true;
  if (cam.locked) cam.t = Math.min(1, cam.t + dt / LOCK_MS);
}

// Exposed for testing; pushCamera uses this so the test covers the real math.
export function cameraParams(cam: Camera, vw: number, vh: number): { Z: number; fsx: number; fsy: number } {
  const aw = ROOM_CONFIG.arenaWidth, ah = ROOM_CONFIG.arenaHeight;
  const sx = vw / aw, sy = vh / ah;
  const e = easeInOut(cam.t);
  const Z = SPAWN_ZOOM + (1 - SPAWN_ZOOM) * e;                                   // 1.3 -> 1.0
  const fxArena = SPAWN_FOCUS_X_FRAC * aw + (aw / 2 - SPAWN_FOCUS_X_FRAC * aw) * e; // -> aw/2
  const fyArena = ah / 2;                                                        // vertical stays centered
  return { Z, fsx: fxArena * sx, fsy: fyArena * sy };
}

// Push the camera transform (composes on top of the current/DPR transform).
// Caller MUST ctx.restore() after drawing the in-world scene.
export function pushCamera(ctx: CanvasRenderingContext2D, cam: Camera, vw: number, vh: number): void {
  const { Z, fsx, fsy } = cameraParams(cam, vw, vh);
  ctx.save();
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(Z, Z);
  ctx.translate(-fsx, -fsy);
}
