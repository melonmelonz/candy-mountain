import { test, expect } from "bun:test";
import { activePlayerIds, desiredSpotsPerSide, layoutSpots, computeCoverage, allCovered, stepCharge, tick } from "../src/game/reducer";
import { ROOM_CONFIG } from "../src/game/config";
import type { Player, RoomState, Spot } from "../src/game/types";

function mk(id: string, lastInputAt: number): Player {
  return { id, name: id, pos: { x: 0, y: 0 }, facing: "down", moving: false,
    cosmetics: { hue: 0, visorHue: 0, flair: "antenna" }, lastInputAt };
}

test("idle players are excluded from active set", () => {
  const now = 100_000;
  const players = { a: mk("a", now), b: mk("b", now - 5_000), c: mk("c", now - 40_000) };
  const active = activePlayerIds(players, now, ROOM_CONFIG);
  expect(active.sort()).toEqual(["a", "b"]);
});

test("spots per side scale with active count and clamp", () => {
  expect(desiredSpotsPerSide(1, ROOM_CONFIG)).toBe(0); // below minimum
  expect(desiredSpotsPerSide(2, ROOM_CONFIG)).toBe(1);
  expect(desiredSpotsPerSide(7, ROOM_CONFIG)).toBe(3);
  expect(desiredSpotsPerSide(50, ROOM_CONFIG)).toBe(5); // clamped to maxPerSide
});

test("layoutSpots places equal spots per side, left of/right of seam", () => {
  const spots = layoutSpots(2, ROOM_CONFIG);
  expect(spots.length).toBe(4);
  const left = spots.filter((s) => s.side === "left");
  const right = spots.filter((s) => s.side === "right");
  expect(left.length).toBe(2);
  expect(right.length).toBe(2);
  expect(left.every((s) => s.pos.x < ROOM_CONFIG.seamX)).toBe(true);
  expect(right.every((s) => s.pos.x > ROOM_CONFIG.seamX)).toBe(true);
  expect(spots.every((s) => s.covered === false)).toBe(true);
});

test("layoutSpots is deterministic", () => {
  expect(layoutSpots(3, ROOM_CONFIG)).toEqual(layoutSpots(3, ROOM_CONFIG));
});

test("layoutSpots with 0 per side is empty", () => {
  expect(layoutSpots(0, ROOM_CONFIG)).toEqual([]);
});

// --- computeCoverage / allCovered ---

function mkSpot(id: string, x: number, y: number): Spot {
  return { id, side: "left", pos: { x, y }, covered: false };
}

test("player within spotRadius covers spot", () => {
  const spot = mkSpot("s0", 100, 100);
  // player is 30px away — inside radius of 36
  const players = { a: { ...mk("a", 0), pos: { x: 130, y: 100 } } };
  const result = computeCoverage([spot], players, ["a"], ROOM_CONFIG);
  expect(result[0].covered).toBe(true);
});

test("player just outside spotRadius does not cover spot", () => {
  const spot = mkSpot("s0", 100, 100);
  // player is 37px away — outside radius of 36
  const players = { a: { ...mk("a", 0), pos: { x: 137, y: 100 } } };
  const result = computeCoverage([spot], players, ["a"], ROOM_CONFIG);
  expect(result[0].covered).toBe(false);
});

test("player at exactly spotRadius distance covers spot (boundary inclusive)", () => {
  const spot = mkSpot("s0", 100, 100);
  // player is exactly 36px away
  const players = { a: { ...mk("a", 0), pos: { x: 136, y: 100 } } };
  const result = computeCoverage([spot], players, ["a"], ROOM_CONFIG);
  expect(result[0].covered).toBe(true);
});

test("idle player not in activeIds does not cover spot", () => {
  const spot = mkSpot("s0", 100, 100);
  // player is on the spot but is NOT in activeIds
  const players = { idle: { ...mk("idle", 0), pos: { x: 100, y: 100 } } };
  const result = computeCoverage([spot], players, [], ROOM_CONFIG);
  expect(result[0].covered).toBe(false);
});

test("computeCoverage returns new spot objects without mutating originals", () => {
  const spot = mkSpot("s0", 100, 100);
  const players = { a: { ...mk("a", 0), pos: { x: 100, y: 100 } } };
  const result = computeCoverage([spot], players, ["a"], ROOM_CONFIG);
  // result spot should be covered
  expect(result[0].covered).toBe(true);
  // original spot must not be mutated
  expect(spot.covered).toBe(false);
  // different object reference
  expect(result[0]).not.toBe(spot);
});

test("allCovered returns correct results", () => {
  const covered: Spot = { id: "a", side: "left", pos: { x: 0, y: 0 }, covered: true };
  const uncovered: Spot = { id: "b", side: "right", pos: { x: 0, y: 0 }, covered: false };
  expect(allCovered([covered, covered])).toBe(true);
  expect(allCovered([covered, uncovered])).toBe(false);
  expect(allCovered([])).toBe(false);
});

test("charge rises when all covered, decays otherwise, clamped 0..100", () => {
  const cfg = ROOM_CONFIG;
  expect(stepCharge(0, false, cfg)).toBe(0);
  expect(stepCharge(10, false, cfg)).toBe(10 - cfg.chargeDecayPerTick);
  expect(stepCharge(0, true, cfg)).toBe(cfg.chargeRisePerTick);
  expect(stepCharge(99, true, cfg)).toBe(100);
});

test("tick relayouts spots when active count changes and opens at full charge", () => {
  const cfg = { ...ROOM_CONFIG, chargeRisePerTick: 100 }; // open in one tick when covered
  const base = { players: {}, spots: [], charge: 0, dayId: "2026-06-04" } as RoomState;
  const spots = layoutSpots(1, cfg);
  const L = spots.find((s) => s.side === "left")!;
  const R = spots.find((s) => s.side === "right")!;
  const now = 1000;
  base.players = {
    l: { ...mk("l", now), pos: { ...L.pos } },
    r: { ...mk("r", now), pos: { ...R.pos } },
  };
  const out = tick(base, now, cfg);
  expect(out.state.spots.length).toBe(2);
  expect(out.opened).toBe(true);
  expect(out.state.charge).toBe(0); // reset after open
});

test("tick does not open below minimum active players", () => {
  const cfg = { ...ROOM_CONFIG, chargeRisePerTick: 100 };
  const now = 1000;
  const base: RoomState = {
    players: { solo: { ...mk("solo", now), pos: { x: 0, y: 0 } } },
    spots: [], charge: 0, dayId: "2026-06-04",
  };
  const out = tick(base, now, cfg);
  expect(out.opened).toBe(false);
  expect(out.state.spots.length).toBe(0);
});

test("tick no-relayout: stale covered flags recomputed; charge rises then decays", () => {
  // layoutSpots(1, ROOM_CONFIG) produces left={x:288,y:360}, right={x:992,y:360}
  const initialSpots = layoutSpots(1, ROOM_CONFIG);
  const L = initialSpots.find((s) => s.side === "left")!;
  const R = initialSpots.find((s) => s.side === "right")!;
  const now = 5_000;
  const startCharge = 10;

  // Seed spots with covered:true to prove computeCoverage overwrites stale flags on tick 2
  const staleSpots: typeof initialSpots = initialSpots.map((s) => ({ ...s, covered: true }));

  const base: RoomState = {
    players: {
      l: { ...mk("l", now), pos: { ...L.pos } },
      r: { ...mk("r", now), pos: { ...R.pos } },
    },
    spots: staleSpots,
    charge: startCharge,
    dayId: "2026-06-04",
  };

  // Tick 1: both players standing on their spots — all covered, charge rises, no relayout
  const out1 = tick(base, now, ROOM_CONFIG);
  expect(out1.opened).toBe(false);
  expect(out1.state.charge).toBe(startCharge + ROOM_CONFIG.chargeRisePerTick);
  expect(out1.state.spots.length).toBe(2);
  // Positions must be identical (no relayout occurred)
  expect(out1.state.spots.find((s) => s.side === "left")!.pos).toEqual(L.pos);
  expect(out1.state.spots.find((s) => s.side === "right")!.pos).toEqual(R.pos);

  // Tick 2: move both players far away — spots no longer covered; charge decays
  const chargeAfterTick1 = out1.state.charge;
  const state2: RoomState = {
    ...out1.state,
    players: {
      l: { ...mk("l", now), pos: { x: 0, y: 0 } },
      r: { ...mk("r", now), pos: { x: 0, y: 0 } },
    },
  };
  const out2 = tick(state2, now, ROOM_CONFIG);
  // Stale covered:true flags from tick 1 must have been recomputed to false
  expect(out2.state.spots.every((s) => s.covered === false)).toBe(true);
  // Charge decayed from the tick-1 value (floored at 0)
  expect(out2.state.charge).toBe(Math.max(0, chargeAfterTick1 - ROOM_CONFIG.chargeDecayPerTick));
  expect(out2.opened).toBe(false);
});
