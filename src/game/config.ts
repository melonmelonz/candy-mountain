export interface RoomConfig {
  arenaWidth: number;
  arenaHeight: number;
  seamX: number;
  spotRadius: number;
  maxPerSide: number;
  idleMs: number;
  chargeRisePerTick: number;
  chargeDecayPerTick: number;
  minActiveToOpen: number;
}

// How many characters exist in the roster (see assets.ts / roster manifest).
// Shared by the client (random spawn) and the server (cosmetics sanitization)
// so an out-of-range index from a client can be clamped authoritatively.
export const ROSTER_COUNT = 16;

// How many daily-rotating warpgates exist (see gatepick.ts).
export const GATE_COUNT = 6;

export const ROOM_CONFIG: RoomConfig = {
  arenaWidth: 1920,
  arenaHeight: 1080,
  seamX: 960,
  spotRadius: 36,
  maxPerSide: 5,
  idleMs: 30_000,
  chargeRisePerTick: 4,   // ~2.5s of full coverage at 10Hz -> 100
  chargeDecayPerTick: 6,
  minActiveToOpen: 2,
};
