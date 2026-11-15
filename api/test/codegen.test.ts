import { describe, expect, it } from 'vitest';
import { staleFiles } from '../scripts/codegen';

describe('generated clients', () => {
  it('match the current API (run `pnpm codegen` if this fails)', async () => {
    expect(await staleFiles()).toEqual([]);
  }, 20_000);
});
