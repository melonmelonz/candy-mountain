import { test, expect } from "bun:test";
import { activePlayerIds, desiredSpotsPerSide, layoutSpots } from "../src/game/reducer";
import { ROOM_CONFIG } from "../src/game/config";
import type { Player } from "../src/game/types";

function mk(id: string, lastInputAt: number): Player {
  return { id, pos: { x: 0, y: 0 }, facing: "down", moving: false,
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
