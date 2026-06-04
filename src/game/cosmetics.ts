import type { Cosmetics, Flair } from "./types";

const FLAIRS: Flair[] = ["antenna", "backpack", "trail", "emblem"];
const KEY = "cm:cosmetics:v1";

export function rollCosmetics(rng: () => number = Math.random): Cosmetics {
  return {
    hue: Math.floor(rng() * 360),
    visorHue: Math.floor(rng() * 360),
    flair: FLAIRS[Math.floor(rng() * FLAIRS.length)],
  };
}

export function loadOrCreateCosmetics(storage: Storage, rng: () => number = Math.random): Cosmetics {
  const raw = storage.getItem(KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as Cosmetics;
    } catch {
      /* fall through */
    }
  }
  const c = rollCosmetics(rng);
  storage.setItem(KEY, JSON.stringify(c));
  return c;
}
