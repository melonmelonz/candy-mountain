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

export function computeCoverage(
  spots: Spot[],
  players: Record<PlayerId, Player>,
  activeIds: PlayerId[],
  cfg: RoomConfig,
): Spot[] {
  const r2 = cfg.spotRadius * cfg.spotRadius;
  return spots.map((spot) => {
    const covered = activeIds.some((id) => {
      const p = players[id];
      if (!p) return false;
      const dx = p.pos.x - spot.pos.x;
      const dy = p.pos.y - spot.pos.y;
      return dx * dx + dy * dy <= r2;
    });
    return { ...spot, covered };
  });
}

export function allCovered(spots: Spot[]): boolean {
  return spots.length > 0 && spots.every((s) => s.covered);
}

export function stepCharge(charge: number, covered: boolean, cfg: RoomConfig): number {
  const next = covered ? charge + cfg.chargeRisePerTick : charge - cfg.chargeDecayPerTick;
  return Math.max(0, Math.min(100, next));
}

export interface TickResult {
  state: RoomState;
  opened: boolean;
}

export function tick(state: RoomState, now: number, cfg: RoomConfig): TickResult {
  const active = activePlayerIds(state.players, now, cfg);
  const perSide = desiredSpotsPerSide(active.length, cfg);

  // Relayout only when the spot count changes (keeps positions stable otherwise).
  // Left-count alone is sufficient: layoutSpots always produces symmetric (equal left/right) counts.
  const currentPerSide = state.spots.filter((s) => s.side === "left").length;
  let spots = perSide === currentPerSide ? state.spots : layoutSpots(perSide, cfg);

  // computeCoverage rewrites every covered flag from scratch, so any stale flags on reused spots are overwritten here.
  spots = computeCoverage(spots, state.players, active, cfg);
  const covered = allCovered(spots);
  let charge = stepCharge(state.charge, covered, cfg);

  let opened = false;
  if (charge >= 100) {
    opened = true;
    charge = 0; // reset so a future crowd can re-open
  }

  return { state: { ...state, spots, charge }, opened };
}
