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

export function layoutSpots(perSide: number, cfg: RoomConfig): Spot[] {
  if (perSide <= 0) return [];
  const spots: Spot[] = [];
  const marginY = cfg.arenaHeight * 0.18;
  const usableH = cfg.arenaHeight - marginY * 2;
  const leftX = cfg.seamX * 0.45;
  const rightX = cfg.seamX + (cfg.arenaWidth - cfg.seamX) * 0.55;
  for (const side of ["left", "right"] as Side[]) {
    const x = side === "left" ? leftX : rightX;
    for (let i = 0; i < perSide; i++) {
      const t = perSide === 1 ? 0.5 : i / (perSide - 1);
      const y = marginY + usableH * t;
      spots.push({ id: `${side}-${i}`, side, pos: { x, y }, covered: false });
    }
  }
  return spots;
}
