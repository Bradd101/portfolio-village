// Pure 2D collision helpers used by the world. Kept free of Three.js so they can
// be unit tested directly.

export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Point {
  x: number;
  z: number;
}

// Pushes a circle of `radius` centred at (x, z) out of an axis-aligned box along
// whichever axis it is least penetrated on, so the mover slides along a wall
// rather than being flung out radially. Returns the corrected position; the
// input is returned unchanged when the circle is clear of the box.
export function slideCircleOutOfBox(x: number, z: number, box: Box, radius: number): Point {
  const r = radius;
  const inside = x > box.minX - r && x < box.maxX + r && z > box.minZ - r && z < box.maxZ + r;
  if (!inside) return { x, z };

  const penLeft = x - (box.minX - r);
  const penRight = box.maxX + r - x;
  const penTop = z - (box.minZ - r);
  const penBottom = box.maxZ + r - z;
  const min = Math.min(penLeft, penRight, penTop, penBottom);

  if (min === penLeft) return { x: box.minX - r, z };
  if (min === penRight) return { x: box.maxX + r, z };
  if (min === penTop) return { x, z: box.minZ - r };
  return { x, z: box.maxZ + r };
}
