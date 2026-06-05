import type { Cosmetics, Facing, Spot } from "./types";
import type { PlayerWire } from "../protocol";
import { ROOM_CONFIG } from "./config";

// A transient spoken line shown as a bubble above the drifter.
export interface ChatBubble { text: string; at: number; }

export interface RemotePlayer extends PlayerWire { tx: number; ty: number; bornAt: number; leftAt?: number; bubble?: ChatBubble; } // tx/ty = lerp target; bornAt = first-seen ms; leftAt = vanish-started ms

const DEFAULT_COSMETICS: Cosmetics = { hue: 0, visorHue: 190, flair: "emblem", sprite: 0 };

export interface ClientWorld {
  selfId: string | null;
  self: { x: number; y: number; facing: Facing; moving: boolean; name: string; bubble?: ChatBubble };
  selfCosmetics: Cosmetics;
  remotes: Map<string, RemotePlayer>;
  spots: Spot[];
  charge: number;
  gateId: string;
}

export function createWorld(): ClientWorld {
  return {
    selfId: null,
    self: { x: ROOM_CONFIG.arenaWidth / 2, y: ROOM_CONFIG.arenaHeight / 2, facing: "south", moving: false, name: "" },
    selfCosmetics: DEFAULT_COSMETICS,
    remotes: new Map(),
    spots: [],
    charge: 0,
    gateId: "d371f1dc-b42f-4028-8cdb-35c6943e666e", // overwritten by server welcome/state (Task 7)
  };
}

export function applyState(world: ClientWorld, players: PlayerWire[], spots: Spot[], charge: number, gateId: string) {
  world.gateId = gateId;
  world.spots = spots;
  world.charge = charge;
  const seen = new Set<string>();
  for (const p of players) {
    seen.add(p.id);
    if (p.id === world.selfId) { world.self.name = p.name; continue; } // self position is locally predicted
    const existing = world.remotes.get(p.id);
    if (existing) {
      existing.name = p.name; existing.tx = p.x; existing.ty = p.y; existing.facing = p.facing; existing.moving = p.moving; existing.cosmetics = p.cosmetics;
      existing.leftAt = undefined; // re-seen: cancel any in-flight dissolve
    } else {
      world.remotes.set(p.id, { ...p, tx: p.x, ty: p.y, bornAt: performance.now() });
    }
  }
  // mark vanished players for a dissolve, then prune once the fade completes
  const now = performance.now();
  for (const [id, r] of world.remotes) {
    if (seen.has(id)) continue;
    if (r.leftAt === undefined) r.leftAt = now;
    else if (now - r.leftAt > 700) world.remotes.delete(id);
  }
}

export function interpolateRemotes(world: ClientWorld, alpha = 0.25) {
  for (const r of world.remotes.values()) {
    r.x += (r.tx - r.x) * alpha;
    r.y += (r.ty - r.y) * alpha;
  }
}

const SPEED = 220; // px/sec

export function stepSelf(world: ClientWorld, input: { up: boolean; down: boolean; left: boolean; right: boolean }, dt: number) {
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  // The far side of the seam is an inverted realm: both control axes flip while
  // the drifter stands there. Facing is derived from dx/dy *after* the flip, so
  // the drifter visibly walks opposite the player's input — the diegetic tell
  // that you have crossed over. The strict ">" keeps a drifter exactly on the
  // seam under normal controls.
  if (world.self.x > ROOM_CONFIG.seamX) { dx = -dx; dy = -dy; }
  world.self.moving = dx !== 0 || dy !== 0;
  if (world.self.moving) {
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    world.self.x = Math.max(0, Math.min(ROOM_CONFIG.arenaWidth, world.self.x + dx * SPEED * dt));
    world.self.y = Math.max(0, Math.min(ROOM_CONFIG.arenaHeight, world.self.y + dy * SPEED * dt));
    world.self.facing = facing8(dx, dy);
  }
}

// Map a movement vector to one of the eight atlas directions. dx>0 is east,
// dy>0 is south (screen down). Signs survive normalization, so this works on the
// normalized vector too. Returns "south" only as a degenerate (0,0) fallback.
function facing8(dx: number, dy: number): Facing {
  const sx = Math.sign(dx), sy = Math.sign(dy);
  if (sx > 0 && sy < 0) return "north-east";
  if (sx > 0 && sy > 0) return "south-east";
  if (sx < 0 && sy < 0) return "north-west";
  if (sx < 0 && sy > 0) return "south-west";
  if (sx > 0) return "east";
  if (sx < 0) return "west";
  if (sy < 0) return "north";
  return "south";
}
