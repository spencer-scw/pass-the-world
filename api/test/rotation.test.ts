import { describe, expect, it } from 'vitest';
import {
  canClaimOpenTurn,
  isPastGrace,
  isStartWindowMissed,
  nextStrictPlayer,
  turnDeadline,
  UPLOAD_GRACE_MS,
} from '../src/rotation';

const p = (userId: string, position: number, active = true) => ({ userId, position, active });

describe('nextStrictPlayer', () => {
  const players = [p('c', 2), p('a', 0), p('b', 1)];

  it('starts with the first player by position', () => {
    expect(nextStrictPlayer(players, null)).toBe('a');
  });

  it('advances and wraps around', () => {
    expect(nextStrictPlayer(players, 'a')).toBe('b');
    expect(nextStrictPlayer(players, 'c')).toBe('a');
  });

  it('skips inactive players', () => {
    expect(nextStrictPlayer([p('a', 0), p('b', 1, false), p('c', 2)], 'a')).toBe('c');
  });

  it('continues from an inactive last player', () => {
    expect(nextStrictPlayer([p('a', 0), p('b', 1, false), p('c', 2)], 'b')).toBe('c');
  });

  it('restarts the rotation if the last player left the game', () => {
    expect(nextStrictPlayer(players, 'gone')).toBe('a');
  });

  it('returns null with no active players', () => {
    expect(nextStrictPlayer([p('a', 0, false)], null)).toBeNull();
  });

  it('gives a solo player every turn', () => {
    expect(nextStrictPlayer([p('a', 0)], 'a')).toBe('a');
  });
});

describe('canClaimOpenTurn', () => {
  const players = [p('a', 0), p('b', 1), p('x', 2, false)];
  it('blocks back-to-back turns', () => expect(canClaimOpenTurn(players, 'a', 'a')).toBe(false));
  it('allows anyone else active', () => expect(canClaimOpenTurn(players, 'a', 'b')).toBe(true));
  it('blocks inactive and non-members', () => {
    expect(canClaimOpenTurn(players, 'a', 'x')).toBe(false);
    expect(canClaimOpenTurn(players, 'a', 'nobody')).toBe(false);
  });
  it('lets a solo player go again', () => expect(canClaimOpenTurn([p('a', 0)], 'a', 'a')).toBe(true));
});

describe('timing', () => {
  it('computes wall-clock deadlines', () => expect(turnDeadline(1_000, 60)).toBe(1_000 + 3_600_000));
  it('allows uploads during the grace period', () => {
    expect(isPastGrace(0, UPLOAD_GRACE_MS)).toBe(false);
    expect(isPastGrace(0, UPLOAD_GRACE_MS + 1)).toBe(true);
  });
  it('honours the start window', () => {
    expect(isStartWindowMissed(0, null, Number.MAX_SAFE_INTEGER)).toBe(false);
    expect(isStartWindowMissed(0, 24, 24 * 3_600_000)).toBe(false);
    expect(isStartWindowMissed(0, 24, 24 * 3_600_000 + 1)).toBe(true);
  });
});
