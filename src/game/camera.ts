import { ROOM_CONFIG } from "./config";

// selfX/selfY: the local drifter's last known ARENA position, captured each
// updateCamera so cameraParams can frame on the player during exploration.
export interface Camera { locked: boolean; t: number; last: number; selfX: number; selfY: number; } // t: 0 spawn .. 1 ritual; last = prev tMs
export function createCamera(): Camera { return { locked: false, t: 0, last: 0, selfX: ROOM_CONFIG.arenaWidth / 2, selfY: ROOM_CONFIG.arenaHeight / 2 }; }

// Tight enough that the gate (arena center) is never in frame from any legal
// spawn: the closest a drifter can spawn is MIN_PORTAL_DIST from the gate, and
// at this zoom that distance always falls outside the visible rectangle.
const SPAWN_ZOOM = 2.5;
// Arena units of gate body+glow reach. The lock fires the instant the portal's
// edge crosses into the visible rectangle, so the zoom-out begins exactly as the
// gate comes into view rather than after the player walks closer.
const GATE_REVEAL_MARGIN = 110;
const LOCK_MS = 1000;             // ease duration once latched

function easeInOut(x: number): number { return x < 0.5 ? 2*x*x : 1 - Math.pow(-2*x + 2, 2)/2; }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

// Latch + ease. Call once per frame BEFORE drawing. selfX/selfY in ARENA coords.
export function updateCamera(cam: Camera, selfX: number, selfY: number, tMs: number): void {
  const dt = cam.last === 0 ? 0 : tMs - cam.last;
  cam.last = tMs;
  cam.selfX = selfX;
  cam.selfY = selfY;
  const gx = ROOM_CONFIG.seamX, gy = ROOM_CONFIG.arenaHeight / 2;
  // Visible half-extents (arena units) of the spawn framing, padded by the gate's
  // own size: when the gate falls inside this rectangle it has come into view.
  const hw = ROOM_CONFIG.arenaWidth / (2 * SPAWN_ZOOM) + GATE_REVEAL_MARGIN;
  const hh = ROOM_CONFIG.arenaHeight / (2 * SPAWN_ZOOM) + GATE_REVEAL_MARGIN;
  if (!cam.locked && Math.abs(selfX - gx) <= hw && Math.abs(selfY - gy) <= hh) cam.locked = true;
  if (cam.locked) cam.t = Math.min(1, cam.t + dt / LOCK_MS);
}

// Current eased camera focus in ARENA coords (player during exploration ->
// arena center at the ritual lock). Used to drive background parallax so the
// cosmos shifts as the local drifter moves.
export function cameraFocusArena(cam: Camera): { x: number; y: number } {
  const e = easeInOut(cam.t);
  return {
    x: lerp(cam.selfX, ROOM_CONFIG.arenaWidth / 2, e),
    y: lerp(cam.selfY, ROOM_CONFIG.arenaHeight / 2, e),
  };
}

// Exposed for testing; pushCamera uses this so the test covers the real math.
// Spawn framing (t=0) follows the player zoomed in; ritual framing (t=1) is the
// whole arena centered (identity). We ease focus + zoom together so locking near
// the gate dollies out to reveal the full ritual.
export function cameraParams(cam: Camera, vw: number, vh: number): { Z: number; fsx: number; fsy: number } {
  const aw = ROOM_CONFIG.arenaWidth, ah = ROOM_CONFIG.arenaHeight;
  const sx = vw / aw, sy = vh / ah;
  const e = easeInOut(cam.t);
  const Z = SPAWN_ZOOM + (1 - SPAWN_ZOOM) * e;        // 2.5 -> 1.0
  const fxArena = lerp(cam.selfX, aw / 2, e);          // player -> arena center
  const fyArena = lerp(cam.selfY, ah / 2, e);          // player -> arena center
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
