import { describe, it, expect } from 'vitest';
import { pickWeighted } from './random';

describe('pickWeighted', () => {
  const table = [
    { name: 'a', weight: 1 },
    { name: 'b', weight: 3 },
  ];

  it('selects the entry whose cumulative range contains the roll', () => {
    // total weight = 4
    expect(pickWeighted(table, () => 0).name).toBe('a'); // roll 0.0 -> a
    expect(pickWeighted(table, () => 0.2).name).toBe('a'); // roll 0.8 -> a
    expect(pickWeighted(table, () => 0.5).name).toBe('b'); // roll 2.0 -> b
    expect(pickWeighted(table, () => 0.99).name).toBe('b'); // roll ~3.96 -> b
  });

  it('falls back to the last entry when the roll lands at the very top', () => {
    expect(pickWeighted(table, () => 1).name).toBe('b');
  });

  it('roughly honours the weighting across an even sweep of rolls', () => {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 1000; i++) {
      const v = i / 1000;
      if (pickWeighted(table, () => v).name === 'a') a++;
      else b++;
    }
    // 'a' owns 1/4 of the range, 'b' owns 3/4
    expect(a).toBe(250);
    expect(b).toBe(750);
  });
});
