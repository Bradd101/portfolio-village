import { vi } from 'vitest';

// jsdom ships without a real 2D canvas, but the icon helpers draw to one at
// module load. Stub the context with a no-op proxy so importing UI modules
// doesn't throw; the drawn pixels don't matter to the logic under test.
const noopContext = new Proxy(
  {},
  {
    get: () => () => undefined,
    set: () => true,
  }
);

// Cast through `any`: the real getContext has several overloads we don't need
// to satisfy for a test stub.
const proto = HTMLCanvasElement.prototype as any;
proto.getContext = vi.fn(() => noopContext);
proto.toDataURL = vi.fn(() => 'data:image/png;base64,');
