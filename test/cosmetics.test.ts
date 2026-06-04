import { test, expect } from "bun:test";
import { rollCosmetics, loadOrCreateCosmetics } from "../src/game/cosmetics";

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
