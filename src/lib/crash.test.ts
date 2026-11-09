import { afterEach, describe, expect, it, vi } from 'vitest';
import { crash } from './crash.js';

afterEach(() => vi.restoreAllMocks());

describe('crash', () => {
  it('throws on the next tick, outside any handler, so the part exits and is restarted', () => {
    const later = vi.spyOn(globalThis, 'setImmediate').mockReturnValue({} as NodeJS.Immediate);
    crash();
    const [callback] = later.mock.calls[0] ?? [];
    expect(() => callback?.()).toThrow('exit requested');
  });
});
