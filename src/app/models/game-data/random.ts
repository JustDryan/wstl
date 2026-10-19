/**
 * Small deterministic random number generator.
 * Every "random" choice in a puzzle goes through this, seeded from the
 * puzzle's seed, so the same puzzle always resolves the same way for
 * every player.
 */
export class Random {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
  }

  /** Builds an RNG from several parts, e.g. Random.from(puzzleSeed, characterId, 'reveal'). */
  static from(...parts: (string | number)[]): Random {
    return new Random(parts.join('|'));
  }

  /** Float in [0, 1). (mulberry32) */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Whole number in [0, maxExclusive). */
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  /** A random item, or undefined if the list is empty. */
  pick<T>(items: readonly T[]): T | undefined {
    return items.length ? items[this.int(items.length)] : undefined;
  }
}

/** FNV-1a 32-bit string hash. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
