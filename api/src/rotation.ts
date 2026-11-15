// Pure turn-order and timing rules. No I/O here so it can be unit tested directly.

export interface RotationPlayer {
  userId: string;
  position: number;
  active: boolean;
}

/** Time a player has after their deadline to finish saving and uploading. */
export const UPLOAD_GRACE_MS = 10 * 60_000;

/**
 * Strict rotation: the next active player after `lastUserId` by position, wrapping around.
 * `players` should include inactive players so we can still find where the last player sat.
 */
export function nextStrictPlayer(players: RotationPlayer[], lastUserId: string | null): string | null {
  const ordered = [...players].sort((a, b) => a.position - b.position);
  const active = ordered.filter((p) => p.active);
  if (active.length === 0) return null;

  const last = lastUserId ? ordered.find((p) => p.userId === lastUserId) : undefined;
  if (!last) return active[0].userId;

  return (active.find((p) => p.position > last.position) ?? active[0]).userId;
}

/**
 * Open order: any active player may claim, except the previous player may not go twice in a row
 * (unless they are alone).
 */
export function canClaimOpenTurn(players: RotationPlayer[], lastUserId: string | null, userId: string): boolean {
  const active = players.filter((p) => p.active);
  if (!active.some((p) => p.userId === userId)) return false;
  return active.length === 1 || userId !== lastUserId;
}

export function turnDeadline(claimedAt: number, turnMinutes: number): number {
  return claimedAt + turnMinutes * 60_000;
}

export function isPastGrace(deadlineAt: number, now: number): boolean {
  return now > deadlineAt + UPLOAD_GRACE_MS;
}

export function isStartWindowMissed(availableAt: number, startWindowHours: number | null, now: number): boolean {
  return startWindowHours != null && now > availableAt + startWindowHours * 3_600_000;
}
