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
