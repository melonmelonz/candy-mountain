import screenNames from "../../screen-names.json";

/**
 * Generate N candidate screen names using a deterministic seed.
 * Pattern: "Adjective Noun" (e.g., "Happy Comet").
 * Uses FNV-1a hash for deterministic selection from name pools.
 */
export function generateCandidates(seed: string, count: number): string[] {
  const { adjectives, nouns } = screenNames;
  if (!adjectives?.length || !nouns?.length) {
    return Array.from({ length: count }, (_, i) => `Guest ${i + 1}`);
  }

  const candidates: string[] = [];
  for (let i = 0; i < count; i++) {
    const salted = `${seed}::${i}`;
    const adjIdx = hashIndex(salted + "::adj", adjectives.length);
    const nounIdx = hashIndex(salted + "::noun", nouns.length);
    candidates.push(`${adjectives[adjIdx]} ${nouns[nounIdx]}`);
  }
  return candidates;
}

/**
 * Assign a unique name from candidates. If all are taken, adds numeric suffix.
 * @param candidates - List of candidate names to choose from
 * @param existingNames - Set of names currently in use
 * @returns A unique screen name
 */
export function assignName(candidates: string[], existingNames: Set<string>): string {
  // Try each candidate
  for (const name of candidates) {
    if (!existingNames.has(name)) {
      return name;
    }
  }

  // All candidates taken - add numeric suffix to first candidate
  const baseName = candidates[0] || "Guest";
  let suffix = 2;
  while (existingNames.has(`${baseName} ${suffix}`)) {
    suffix++;
  }
  return `${baseName} ${suffix}`;
}

/**
 * FNV-1a hash to deterministically pick an index from a pool.
 * Mirrors the pattern used in dailypick.ts.
 */
function hashIndex(str: string, n: number): number {
  if (n <= 1) return 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % n;
}
