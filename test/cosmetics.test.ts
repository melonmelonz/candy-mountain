import { test, expect } from "bun:test";
import { rollCosmetics, loadOrCreateCosmetics } from "../src/game/cosmetics";
import { ROSTER_COUNT } from "../src/game/config";

test("rollCosmetics produces in-range values and a valid flair", () => {
  const c = rollCosmetics(() => 0.5);
  expect(c.hue).toBeGreaterThanOrEqual(0);
  expect(c.hue).toBeLessThan(360);
  expect(["antenna", "backpack", "trail", "emblem"]).toContain(c.flair);
});

test("loadOrCreateCosmetics persists the same look across calls", () => {
  const store = new Map<string, string>();
  const fakeStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  } as Storage;
  const a = loadOrCreateCosmetics(fakeStorage, Math.random);
  const b = loadOrCreateCosmetics(fakeStorage, Math.random);
  expect(b).toEqual(a);
});

test("loadOrCreateCosmetics clamps an out-of-range sprite index", () => {
  const store = new Map<string, string>();
  const fakeStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  } as Storage;
  // Seed storage with a stale sprite value out of range (e.g. 999)
  store.set("cm:cosmetics:v1", JSON.stringify({ hue: 0, visorHue: 0, flair: "antenna", sprite: 999 }));
  const c = loadOrCreateCosmetics(fakeStorage, () => 0.5);
  expect(c.sprite).toBeGreaterThanOrEqual(0);
  expect(c.sprite).toBeLessThan(ROSTER_COUNT);
  expect(c.sprite).not.toBe(999);
});
