import type { Cosmetics, Flair } from "./types";
import { ROSTER_COUNT } from "./config";

const FLAIRS: Flair[] = ["antenna", "backpack", "trail", "emblem"];
const KEY = "cm:cosmetics:v1";

export function rollCosmetics(rng: () => number = Math.random): Cosmetics {
  return {
    hue: Math.floor(rng() * 360),
    visorHue: Math.floor(rng() * 360),
    flair: FLAIRS[Math.floor(rng() * FLAIRS.length)],
    sprite: Math.floor(rng() * ROSTER_COUNT),
  };
}

export function loadOrCreateCosmetics(storage: Storage, rng: () => number = Math.random): Cosmetics {
  const raw = storage.getItem(KEY);
  if (raw) {
    try {
      const c = JSON.parse(raw) as Partial<Cosmetics>;
      // Patch identities saved before `sprite` existed so returning players keep
      // their color/flair but still get a (stable, persisted) sprite.
      if (typeof c.sprite !== "number") {
        c.sprite = Math.floor(rng() * ROSTER_COUNT);
        storage.setItem(KEY, JSON.stringify(c));
      }
      return c as Cosmetics;
    } catch {
      /* fall through */
    }
  }
  const c = rollCosmetics(rng);
  storage.setItem(KEY, JSON.stringify(c));
  return c;
}
