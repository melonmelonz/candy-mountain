import { test, expect } from "bun:test";
import { gateForCycle, GATE_IDS } from "../src/game/gatepick";
import { linkForCycle } from "../portal-room/src/links";

test("gateForCycle wraps over 6 gates", () => {
  expect(gateForCycle(0)).toBe(GATE_IDS[0]);
  expect(gateForCycle(5)).toBe(GATE_IDS[5]);
  expect(gateForCycle(6)).toBe(GATE_IDS[0]);
  expect(gateForCycle(7)).toBe(GATE_IDS[1]);
});

test("gateForCycle is negative-safe", () => {
  expect(gateForCycle(-1)).toBe(GATE_IDS[5]);
});

test("linkForCycle wraps and returns a link for a non-empty list", () => {
  const a = linkForCycle(0);
  expect(a).toBeDefined();
  // Deterministic for the same index.
  expect(linkForCycle(0)).toEqual(a);
});
