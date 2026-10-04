// Small, dependency-free randomness helpers. The random source is injectable so
// the game logic that relies on it stays deterministically testable.

export interface Weighted {
  weight: number;
}

// Picks an entry from a weighted table. Higher weight means higher chance.
// `rng` must return a value in [0, 1); it defaults to Math.random.
export function pickWeighted<T extends Weighted>(table: T[], rng: () => number = Math.random): T {
  const total = table.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of table) {
    if (roll < entry.weight) return entry;
    roll -= entry.weight;
  }
  return table[table.length - 1];
}
