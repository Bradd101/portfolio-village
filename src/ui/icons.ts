// Small pixel icons for inventory slots, drawn on canvas instead of pulled
// from any external source. Kept chunky and low-res on purpose, it matches
// the scale real OSRS inventory sprites are drawn at.

function canvasIcon(draw: (ctx: CanvasRenderingContext2D) => void, size = 32): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  return canvas.toDataURL();
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function logIcon(barkColor: string, woodColor: string, ringColor: string): string {
  return canvasIcon((ctx) => {
    px(ctx, 2, 11, 28, 12, barkColor);
    px(ctx, 2, 11, 28, 3, woodColor);
    px(ctx, 1, 10, 5, 14, barkColor);
    px(ctx, 2, 12, 3, 10, woodColor);
    px(ctx, 3, 14, 1, 6, ringColor);
    px(ctx, 25, 10, 5, 14, barkColor);
    px(ctx, 26, 12, 3, 10, woodColor);
    px(ctx, 27, 14, 1, 6, ringColor);
  });
}

function fishIcon(bodyColor: string, bellyColor: string, finColor: string): string {
  return canvasIcon((ctx) => {
    px(ctx, 2, 13, 4, 2, finColor);
    px(ctx, 4, 11, 3, 2, finColor);
    px(ctx, 4, 17, 3, 2, finColor);
    px(ctx, 7, 11, 16, 10, bodyColor);
    px(ctx, 7, 18, 16, 2, bellyColor);
    px(ctx, 23, 12, 4, 8, bodyColor);
    px(ctx, 27, 14, 3, 4, bodyColor);
    px(ctx, 25, 14, 2, 2, '#1a120a');
    px(ctx, 14, 9, 6, 2, finColor);
  });
}

function cookedFishIcon(bodyColor: string, bellyColor: string, finColor: string): string {
  return canvasIcon((ctx) => {
    px(ctx, 2, 13, 4, 2, finColor);
    px(ctx, 4, 11, 3, 2, finColor);
    px(ctx, 4, 17, 3, 2, finColor);
    px(ctx, 7, 11, 16, 10, bodyColor);
    px(ctx, 7, 18, 16, 2, bellyColor);
    px(ctx, 23, 12, 4, 8, bodyColor);
    px(ctx, 27, 14, 3, 4, bodyColor);
    px(ctx, 25, 14, 2, 2, '#1a120a');
    px(ctx, 14, 9, 6, 2, finColor);
    // char marks from the fire
    px(ctx, 10, 13, 2, 2, '#2a1810');
    px(ctx, 16, 16, 2, 2, '#2a1810');
    px(ctx, 19, 13, 2, 2, '#2a1810');
  });
}

function oreIcon(rockColor: string, oreColor: string, oreHi: string): string {
  return canvasIcon((ctx) => {
    // chunky rock silhouette
    px(ctx, 6, 14, 20, 12, rockColor);
    px(ctx, 9, 9, 15, 7, rockColor);
    px(ctx, 12, 6, 9, 4, rockColor);
    // ore veins/flecks
    px(ctx, 11, 12, 4, 4, oreColor);
    px(ctx, 18, 16, 5, 4, oreColor);
    px(ctx, 14, 20, 4, 3, oreColor);
    px(ctx, 12, 13, 2, 2, oreHi);
    px(ctx, 19, 17, 2, 2, oreHi);
  });
}

export const ICONS = {
  logs: logIcon('#6b4420', '#a8703e', '#4a2e14'),
  oakLogs: logIcon('#4a3018', '#8a5a2a', '#2e1c0a'),
  mapleLogs: logIcon('#5a2e14', '#b06a3a', '#3a1c0a'),
  shrimp: fishIcon('#e8a8a0', '#f5cfc8', '#d8847a'),
  sardine: fishIcon('#9fb8c8', '#c8d8e0', '#6a8898'),
  trout: fishIcon('#6a8a5a', '#9ab888', '#4a6a3a'),
  salmon: fishIcon('#d87a5a', '#f0a888', '#b85a3a'),
  cookedShrimp: cookedFishIcon('#d88860', '#e8b088', '#b86848'),
  cookedSardine: cookedFishIcon('#8a9890', '#b0bcb4', '#5a6860'),
  cookedTrout: cookedFishIcon('#8a7850', '#b0a070', '#5a4a28'),
  cookedSalmon: cookedFishIcon('#b85838', '#d87850', '#8a3818'),
  copperOre: oreIcon('#6b6b63', '#c87f4a', '#e0a070'),
  tinOre: oreIcon('#6b6b63', '#b8c0c8', '#dfe6ec'),
  ironOre: oreIcon('#6b6b63', '#9a5a44', '#c07858'),
  silverOre: oreIcon('#6b6b63', '#c6ccd2', '#f0f4f8'),
  goldOre: oreIcon('#6b6b63', '#d4af37', '#ffe070'),
  gem: canvasIcon((ctx) => {
    px(ctx, 13, 4, 6, 4, '#fff0a0');
    px(ctx, 9, 8, 14, 6, '#ffe070');
    px(ctx, 6, 14, 20, 6, '#ffd94a');
    px(ctx, 10, 20, 12, 5, '#d4af37');
    px(ctx, 14, 25, 4, 3, '#a8841f');
  }),
} as const;
