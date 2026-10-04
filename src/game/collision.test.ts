import { describe, it, expect } from 'vitest';
import { slideCircleOutOfBox, type Box } from './collision';

const box: Box = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };

describe('slideCircleOutOfBox', () => {
  it('leaves a point clear of the box unchanged', () => {
    expect(slideCircleOutOfBox(5, 5, box, 0.4)).toEqual({ x: 5, z: 5 });
  });

  it('pushes out to the right edge when that penetration is smallest', () => {
    const r = slideCircleOutOfBox(1.2, 0, box, 0.4);
    expect(r.x).toBeCloseTo(1.4); // maxX + radius
    expect(r.z).toBe(0);
  });

  it('pushes out to the left edge', () => {
    const r = slideCircleOutOfBox(-1.2, 0, box, 0.4);
    expect(r.x).toBeCloseTo(-1.4); // minX - radius
    expect(r.z).toBe(0);
  });

  it('slides along z when the z penetration is smallest', () => {
    const r = slideCircleOutOfBox(0, 1.2, box, 0.4);
    expect(r.z).toBeCloseTo(1.4); // maxZ + radius
    expect(r.x).toBe(0);
  });

  it('treats a point exactly on the radius boundary as clear', () => {
    // x == maxX + r is not strictly inside, so no push
    expect(slideCircleOutOfBox(1.4, 0, box, 0.4)).toEqual({ x: 1.4, z: 0 });
  });
});
