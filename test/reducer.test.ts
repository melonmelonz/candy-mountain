import { test, expect } from "bun:test";
import { activePlayerIds, desiredSpotsPerSide } from "../src/game/reducer";
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
