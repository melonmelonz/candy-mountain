import type { Facing } from "./types";

// Dir8 and Facing are the same eight directions; Facing is the canonical type in
// types.ts and Dir8 is kept as an alias for the roster/atlas vocabulary.
export type Dir8 = Facing;

export const DIR_ORDER: Dir8[] = [
  "south",
  "south-east",
  "east",
  "north-east",
  "north",
  "north-west",
  "west",
  "south-west",
];

export interface StateDef {
  file: string;
  frames: number;
  dirs: Dir8[];
}

export interface CharDef {
  slug: string;
  name: string;
  cell: number;
  dirOrder: Dir8[];
  rotations: { file: string; dirs: Dir8[] };
  states: Record<string, StateDef>;
}

export interface RosterManifest {
  characters: CharDef[];
}

export interface GateDef {
  id: string;
  cell: number;
  frames: number;
  file: string;
}

export interface GateManifest {
  gates: GateDef[];
}

/**
 * Return the best available direction for `want`.
 * - Exact match if present.
 * - Otherwise, pick the available dir minimising wrap-aware angular distance
 *   in DIR_ORDER index space: distance = min(|i-j|, 8 - |i-j|).
 * - Ties broken by lower DIR_ORDER index.
 * - Returns null if `available` is empty.
 */
export function resolveDir(want: Dir8, available: Dir8[]): Dir8 | null {
  if (available.length === 0) return null;
  if (available.includes(want)) return want;

  const wantIdx = DIR_ORDER.indexOf(want);
  let best: Dir8 | null = null;
  let bestDist = Infinity;
  let bestIdx = Infinity;

  for (const dir of available) {
    const idx = DIR_ORDER.indexOf(dir);
    const diff = Math.abs(wantIdx - idx);
    const dist = Math.min(diff, 8 - diff);
    if (dist < bestDist || (dist === bestDist && idx < bestIdx)) {
      best = dir;
      bestDist = dist;
      bestIdx = idx;
    }
  }

  return best;
}
