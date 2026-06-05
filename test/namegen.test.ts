import { test, expect } from "bun:test";
import { generateCandidates, assignName } from "../src/game/namegen";

test("generateCandidates produces deterministic names", () => {
  const seed = "test-seed-123";
  const a = generateCandidates(seed, 5);
  const b = generateCandidates(seed, 5);
  expect(a).toEqual(b);
  expect(a.length).toBe(5);
  for (const name of a) {
    expect(typeof name).toBe("string");
    expect(name.length).toBeGreaterThan(0);
  }
});

test("generateCandidates produces different names for different seeds", () => {
  const a = generateCandidates("seed-a", 10);
  const b = generateCandidates("seed-b", 10);
  // Should have at least some different names
  const aSet = new Set(a);
  const overlap = b.filter((n) => aSet.has(n)).length;
  expect(overlap).toBeLessThan(10); // Not all identical
});

test("assignName picks first available candidate", () => {
  const candidates = ["Happy Comet", "Stellar Voyager", "Cosmic Drifter"];
  const existing = new Set<string>();
  const name = assignName(candidates, existing);
  expect(name).toBe("Happy Comet");
});

test("assignName skips taken names", () => {
  const candidates = ["Happy Comet", "Stellar Voyager", "Cosmic Drifter"];
  const existing = new Set(["Happy Comet"]);
  const name = assignName(candidates, existing);
  expect(name).toBe("Stellar Voyager");
});

test("assignName adds numeric suffix when all candidates taken", () => {
  const candidates = ["Happy Comet", "Stellar Voyager"];
  const existing = new Set(["Happy Comet", "Stellar Voyager"]);
  const name = assignName(candidates, existing);
  expect(name).toBe("Happy Comet 2");
});

test("assignName increments suffix correctly", () => {
  const candidates = ["Happy Comet"];
  const existing = new Set(["Happy Comet", "Happy Comet 2", "Happy Comet 3"]);
  const name = assignName(candidates, existing);
  expect(name).toBe("Happy Comet 4");
});

test("assignName handles empty candidates gracefully", () => {
  const candidates: string[] = [];
  const existing = new Set<string>();
  const name = assignName(candidates, existing);
  expect(typeof name).toBe("string");
  expect(name.length).toBeGreaterThan(0);
});

test("collision avoidance - two users get different names", () => {
  const seed1 = "user-1";
  const seed2 = "user-2";
  const candidates1 = generateCandidates(seed1, 15);
  const candidates2 = generateCandidates(seed2, 15);
  
  const existing = new Set<string>();
  const name1 = assignName(candidates1, existing);
  existing.add(name1);
  const name2 = assignName(candidates2, existing);
  
  expect(name1).not.toBe(name2);
});
