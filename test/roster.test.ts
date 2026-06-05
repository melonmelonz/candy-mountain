import { describe, test, expect } from "bun:test";
import { resolveDir, DIR_ORDER } from "../src/game/roster";

describe("resolveDir", () => {
  test("returns exact when present", () => {
    expect(resolveDir("north", ["south", "north", "east"])).toBe("north");
  });

  test("returns null for empty available list", () => {
    expect(resolveDir("north", [])).toBeNull();
  });

  test("north-east with [south, east, north] picks east (dist 1, lower index than north dist 1)", () => {
    // north-east is at index 3 in DIR_ORDER
    // east is at index 2 -> distance = min(|3-2|,8-1) = 1
    // north is at index 4 -> distance = min(|3-4|,8-1) = 1
    // tie: lower DIR_ORDER index wins => east (index 2) < north (index 4)
    expect(resolveDir("north-east", ["south", "east", "north"])).toBe("east");
  });

  test("south-west with only [north] returns north (opposite, dist 4)", () => {
    // south-west is index 7; north is index 4; dist = min(|7-4|,8-3) = min(3,5) = 3
    // Only one option, so must return it
    expect(resolveDir("south-west", ["north"])).toBe("north");
  });

  test("west with [south, north] picks south (dist 2 both, south lower index wins)", () => {
    // west is index 6; south is index 0 -> dist = min(6, 2) = 2
    // north is index 4 -> dist = min(2, 6) = 2
    // tie: south (index 0) < north (index 4)
    expect(resolveDir("west", ["south", "north"])).toBe("south");
  });

  test("exact match when want is in available (south-east)", () => {
    expect(resolveDir("south-east", ["north", "south-east", "west"])).toBe("south-east");
  });

  test("DIR_ORDER has 8 entries", () => {
    expect(DIR_ORDER.length).toBe(8);
  });
});
