import { describe, it, expect } from "bun:test";
import { pickFrame, selectState, IDLE_STATES, MOVE_STATES } from "../src/game/sprite";
import type { CharDef } from "../src/game/roster";

// ---------------------------------------------------------------------------
// Helpers to build minimal CharDef fixtures
// ---------------------------------------------------------------------------

function makeChar(overrides: Partial<CharDef> & { stateNames?: string[] } = {}): CharDef {
  const { stateNames = [], ...rest } = overrides;
  const states: CharDef["states"] = {};
  for (const name of stateNames) {
    states[name] = { file: `${name}.png`, frames: 4, dirs: ["south", "east", "west"] };
  }
  return {
    slug: "test-char",
    name: "Test Char",
    cell: 64,
    dirOrder: ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"],
    rotations: { file: "rotations.png", dirs: ["south", "east", "north", "west"] },
    states,
    ...rest,
  };
}

// ---------------------------------------------------------------------------
// pickFrame
// ---------------------------------------------------------------------------

describe("pickFrame", () => {
  it("returns 0 when frames <= 0", () => {
    expect(pickFrame(10, 0, 500)).toBe(0);
    expect(pickFrame(10, -1, 500)).toBe(0);
  });

  it("returns 0 at tMs=0", () => {
    expect(pickFrame(10, 6, 0)).toBe(0);
    expect(pickFrame(4, 4, 0)).toBe(0);
  });

  it("advances frame based on fps math: floor(tMs/(1000/fps)) % frames", () => {
    // fps=10 -> 100ms per frame
    expect(pickFrame(10, 6, 100)).toBe(1);
    expect(pickFrame(10, 6, 250)).toBe(2);
    expect(pickFrame(10, 6, 599)).toBe(5);
  });

  it("wraps around at frames boundary", () => {
    // fps=10, frames=6 -> wraps at 600ms
    expect(pickFrame(10, 6, 600)).toBe(0);
    expect(pickFrame(10, 6, 700)).toBe(1);
  });

  it("handles fps=4 idle cadence", () => {
    // fps=4 -> 250ms per frame
    expect(pickFrame(4, 4, 0)).toBe(0);
    expect(pickFrame(4, 4, 250)).toBe(1);
    expect(pickFrame(4, 4, 999)).toBe(3);
    // wraps at 1000ms
    expect(pickFrame(4, 4, 1000)).toBe(0);
  });

  it("single frame always returns 0 regardless of tMs", () => {
    expect(pickFrame(10, 1, 9999)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// selectState
// ---------------------------------------------------------------------------

describe("selectState", () => {
  // --- deity-like: has "animating" + an attack state ---
  const deityChar = makeChar({ stateNames: ["animating", "casting-a-fireball"] });

  it("deity idle: returns 'animating' (first IDLE_STATES match)", () => {
    expect(selectState(deityChar, false)).toBe("animating");
  });

  it("deity moving: returns 'animating' (no walk; falls through to idle)", () => {
    expect(selectState(deityChar, true)).toBe("animating");
  });

  it("deity moving: never returns attack state name", () => {
    const result = selectState(deityChar, true);
    expect(result).not.toBe("casting-a-fireball");
  });

  it("deity idle: never returns attack state name", () => {
    const result = selectState(deityChar, false);
    expect(result).not.toBe("casting-a-fireball");
  });

  // --- red-hair-like: has "walking" + "breathing-idle" ---
  const redHairChar = makeChar({ stateNames: ["walking", "breathing-idle"] });

  it("red-hair moving: returns 'walking'", () => {
    expect(selectState(redHairChar, true)).toBe("walking");
  });

  it("red-hair idle: returns 'breathing-idle'", () => {
    expect(selectState(redHairChar, false)).toBe("breathing-idle");
  });

  // --- char with only walk, no idle ---
  const walkOnlyChar = makeChar({ stateNames: ["walking"] });

  it("walk-only idle: returns null (no idle state present)", () => {
    expect(selectState(walkOnlyChar, false)).toBe(null);
  });

  it("walk-only moving: returns 'walking'", () => {
    expect(selectState(walkOnlyChar, true)).toBe("walking");
  });

  // --- stills-only: no states at all ---
  const stillsChar = makeChar({ stateNames: [] });

  it("stills-only char idle: returns null", () => {
    expect(selectState(stillsChar, false)).toBe(null);
  });

  it("stills-only char moving: returns null", () => {
    expect(selectState(stillsChar, true)).toBe(null);
  });

  // --- attack-only char: has only attack state ---
  const attackOnlyChar = makeChar({ stateNames: ["slashing-with-sharp-claws"] });

  it("attack-only char idle: returns null (attack names ignored)", () => {
    expect(selectState(attackOnlyChar, false)).toBe(null);
  });

  it("attack-only char moving: returns null (attack names ignored)", () => {
    expect(selectState(attackOnlyChar, true)).toBe(null);
  });

  // --- char with breathing-idle + multiple attacks ---
  const mixedChar = makeChar({
    stateNames: [
      "breathing-idle",
      "two-handed-downward-slash-something",
      "animating-2",
    ],
  });

  it("mixed char idle: returns 'breathing-idle', not attacks", () => {
    expect(selectState(mixedChar, false)).toBe("breathing-idle");
  });

  it("mixed char moving: falls through to breathing-idle (no walk)", () => {
    expect(selectState(mixedChar, true)).toBe("breathing-idle");
  });

  // --- drifter-like: has "walking" + "breathing-idle" (4-dir walk) ---
  const drifterChar = makeChar({ stateNames: ["breathing-idle", "walking"] });

  it("drifter moving: returns 'walking' (MOVE_STATES checked first)", () => {
    expect(selectState(drifterChar, true)).toBe("walking");
  });

  it("drifter idle: returns 'breathing-idle'", () => {
    expect(selectState(drifterChar, false)).toBe("breathing-idle");
  });

  // --- verify IDLE_STATES / MOVE_STATES exports ---
  it("IDLE_STATES contains breathing-idle and animating", () => {
    expect(IDLE_STATES).toContain("breathing-idle");
    expect(IDLE_STATES).toContain("animating");
  });

  it("MOVE_STATES contains walking", () => {
    expect(MOVE_STATES).toContain("walking");
  });
});
