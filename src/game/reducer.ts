import type { Player, PlayerId, RoomState, Spot, Side } from "./types";
import type { RoomConfig } from "./config";

export function activePlayerIds(
  players: Record<PlayerId, Player>,
  now: number,
  cfg: RoomConfig,
): PlayerId[] {
  return Object.values(players)
    .filter((p) => now - p.lastInputAt <= cfg.idleMs)
    .map((p) => p.id);
}

export function desiredSpotsPerSide(activeCount: number, cfg: RoomConfig): number {
  if (activeCount < cfg.minActiveToOpen) return 0;
  return Math.min(Math.floor(activeCount / 2), cfg.maxPerSide);
}
