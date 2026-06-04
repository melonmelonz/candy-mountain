import type { Cosmetics, Facing, Spot } from "./types";
import type { PlayerWire } from "../protocol";
import { ROOM_CONFIG } from "./config";

export interface RemotePlayer extends PlayerWire { tx: number; ty: number; } // tx/ty = target for lerp

const DEFAULT_COSMETICS: Cosmetics = { hue: 0, visorHue: 190, flair: "emblem" };

export interface ClientWorld {
  selfId: string | null;
  self: { x: number; y: number; facing: Facing; moving: boolean };
  selfCosmetics: Cosmetics;
  remotes: Map<string, RemotePlayer>;
  spots: Spot[];
  charge: number;
}

export function createWorld(): ClientWorld {
  return {
    selfId: null,
    self: { x: ROOM_CONFIG.arenaWidth / 2, y: ROOM_CONFIG.arenaHeight / 2, facing: "down", moving: false },
    selfCosmetics: DEFAULT_COSMETICS,
    remotes: new Map(),
    spots: [],
    charge: 0,
  };
}

export function applyState(world: ClientWorld, players: PlayerWire[], spots: Spot[], charge: number) {
  world.spots = spots;
  world.charge = charge;
  const seen = new Set<string>();
  for (const p of players) {
    seen.add(p.id);
    if (p.id === world.selfId) continue; // self is locally predicted
    const existing = world.remotes.get(p.id);
    if (existing) {
      existing.tx = p.x; existing.ty = p.y; existing.facing = p.facing; existing.moving = p.moving; existing.cosmetics = p.cosmetics;
    } else {
      world.remotes.set(p.id, { ...p, tx: p.x, ty: p.y });
    }
  }
  for (const id of [...world.remotes.keys()]) if (!seen.has(id)) world.remotes.delete(id);
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
  world.self.moving = dx !== 0 || dy !== 0;
  if (world.self.moving) {
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    world.self.x = Math.max(0, Math.min(ROOM_CONFIG.arenaWidth, world.self.x + dx * SPEED * dt));
    world.self.y = Math.max(0, Math.min(ROOM_CONFIG.arenaHeight, world.self.y + dy * SPEED * dt));
    if (Math.abs(dx) > Math.abs(dy)) world.self.facing = dx > 0 ? "right" : "left";
    else world.self.facing = dy > 0 ? "down" : "up";
  }
}
