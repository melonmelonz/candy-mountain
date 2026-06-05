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

// How many characters exist in the 17-char roster (see assets.ts). Shared by
// the client (random spawn) and the server (cosmetics sanitization) so an
// out-of-range index from a client can be clamped authoritatively.
export const ROSTER_COUNT = 17;

// How many daily-rotating warpgates exist (see gatepick.ts).
export const GATE_COUNT = 6;

export const ROOM_CONFIG: RoomConfig = {
  arenaWidth: 1280,
  arenaHeight: 720,
  seamX: 640,
  spotRadius: 36,
  maxPerSide: 5,
  idleMs: 30_000,
  chargeRisePerTick: 4,   // ~2.5s of full coverage at 10Hz -> 100
  chargeDecayPerTick: 6,
  minActiveToOpen: 2,
};
