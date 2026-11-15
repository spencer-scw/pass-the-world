import { describe, expect, it } from 'vitest';
import { formatMention, notifications } from '../src/copy/notifications';
import { isPublicUrl } from '../src/notify';

describe('formatMention', () => {
  it('pings Discord users', () => expect(formatMention({ display_name: 'Sam', discord_id: '123' })).toBe('<@123>'));
  it('bolds users without Discord', () =>
    expect(formatMention({ display_name: 'Sam', discord_id: null })).toBe('**Sam**'));
  it('falls back for unknown users', () => expect(formatMention(null)).toBe('**someone**'));
});

describe('notifications', () => {
  it('pings the player whose turn it is, outside the card', () => {
    const card = notifications.turnAvailable({ seq: 4, player: '<@1>', startBy: 1_700_000_000_000 });
    expect(card.ping).toBe("<@1>, you're up!");
    expect(card.title).toBe('🌍 Turn #4 is ready');
    expect(card.fields).toEqual([
      { name: 'Start by', value: '<t:1700000000:f> (<t:1700000000:R>) or it gets skipped' },
    ]);
  });

  it('announces an open turn without a ping or deadline', () => {
    const card = notifications.turnAvailable({ seq: 1, player: null, startBy: null });
    expect(card.ping).toBeUndefined();
    expect(card.fields).toBeUndefined();
    expect(card.description).toContain('up for grabs');
  });

  it('describes expiry reasons and whether progress was kept', () => {
    const timeout = notifications.turnExpired({ seq: 2, player: 'P', reason: 'timeout', keptCheckpoint: true });
    expect(timeout.description).toBe("P's turn ran out of time without a final upload.");
    expect(timeout.fields?.[0].value).toBe('Kept up to the last checkpoint');
    const admin = notifications.turnExpired({ seq: 2, player: 'P', reason: 'admin', keptCheckpoint: false });
    expect(admin.description).toBe("P's turn was ended early by an admin.");
  });

  it('describes skip reasons', () => {
    expect(notifications.turnSkipped({ seq: 3, player: 'P', reason: { kind: 'no-show', hours: 24 } }).description).toBe(
      "P didn't start within 24h.",
    );
    expect(notifications.turnSkipped({ seq: 3, player: 'P', reason: { kind: 'admin' } }).description).toBe(
      "P's turn was skipped by an admin.",
    );
  });

  it('links the invite card to the invite', () => {
    const card = notifications.invite({ turnMinutes: 60, orderMode: 'strict', link: 'L', reset: false });
    expect(card).toMatchObject({ title: '📨 Come play!', url: 'L' });
    expect(card.description).toContain('[Join the game](L)');
  });
});

describe('isPublicUrl', () => {
  it('rejects addresses Discord cannot reach', () => {
    for (const url of [
      'http://localhost:5173',
      'http://127.0.0.1',
      'http://192.168.1.5',
      'http://172.20.0.2',
      'http://box.local',
    ])
      expect(isPublicUrl(url), url).toBe(false);
  });
  it('accepts public hosts', () => {
    expect(isPublicUrl('https://pass-the-world.example.workers.dev')).toBe(true);
    expect(isPublicUrl('http://172.32.0.1')).toBe(true);
  });
});
