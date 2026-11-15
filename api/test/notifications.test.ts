import { describe, expect, it } from 'vitest';
import { formatMention, notifications, withGameName } from '../src/copy/notifications';

describe('formatMention', () => {
  it('pings Discord users', () => expect(formatMention({ display_name: 'Sam', discord_id: '123' })).toBe('<@123>'));
  it('bolds users without Discord', () =>
    expect(formatMention({ display_name: 'Sam', discord_id: null })).toBe('**Sam**'));
  it('falls back for unknown users', () => expect(formatMention(null)).toBe('**someone**'));
});

describe('notifications', () => {
  it('announces a strict turn with its auto-skip deadline', () => {
    const msg = notifications.turnAvailable({ seq: 4, player: '<@1>', startBy: 1_700_000_000_000, link: 'L' });
    expect(msg).toBe("🌍 Turn #4: it's <@1>'s turn! Start by <t:1700000000:f> or it gets skipped. L");
  });

  it('announces an open turn without a deadline', () => {
    expect(notifications.turnAvailable({ seq: 1, player: null, startBy: null, link: 'L' })).toBe(
      '🌍 Turn #1: the world is up for grabs! L',
    );
  });

  it('describes expiry reasons and whether progress was kept', () => {
    expect(notifications.turnExpired({ seq: 2, player: 'P', reason: 'timeout', keptCheckpoint: true })).toBe(
      "⌛ P's turn #2 ran out of time without a final upload; progress up to the last checkpoint was kept.",
    );
    expect(notifications.turnExpired({ seq: 2, player: 'P', reason: 'admin', keptCheckpoint: false })).toBe(
      "⌛ P's turn #2 was ended early by an admin; no progress was saved.",
    );
  });

  it('describes skip reasons', () => {
    expect(notifications.turnSkipped({ seq: 3, player: 'P', reason: { kind: 'no-show', hours: 24 } })).toBe(
      '⏭️ Turn #3 (P) was skipped: not started within 24h.',
    );
    expect(notifications.turnSkipped({ seq: 3, player: 'P', reason: { kind: 'admin' } })).toBe(
      '⏭️ Turn #3 (P) was skipped by an admin.',
    );
  });

  it('prefixes the game name', () => expect(withGameName('Moon Lord Run', 'hi')).toBe('**Moon Lord Run** · hi'));
});
