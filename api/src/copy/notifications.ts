// Discord messages posted to a game's webhook. Builders take already-resolved mentions
// (see notify.ts `mention`) so they stay pure and easy to tweak.

/** Discord timestamp that renders in each reader's local time ('t' = time, 'f' = date + time). */
const discordTime = (ms: number, style: 't' | 'f' = 't') => `<t:${Math.floor(ms / 1000)}:${style}>`;

/** Why a turn expired (ended without a final upload, keeping its last checkpoint). */
export type ExpireReason = 'timeout' | 'admin';

/** Why a turn was skipped (ended with its progress discarded). */
export type SkipReason = { kind: 'admin' } | { kind: 'no-show'; hours: number };

/** How a user is referred to: a Discord ping when we know their ID, otherwise their bolded name. */
export function formatMention(user: { display_name: string; discord_id: string | null } | null): string {
  if (!user) return '**someone**';
  return user.discord_id ? `<@${user.discord_id}>` : `**${user.display_name}**`;
}

/** Every message is prefixed with the game's name so one channel can host several games. */
export const withGameName = (gameName: string, content: string) => `**${gameName}** · ${content}`;

export const notifications = {
  /** A new turn opened. `player` is null in open order. `startBy` is set when a no-show will be auto-skipped. */
  turnAvailable: (p: { seq: number; player: string | null; startBy: number | null; link: string }) => {
    const who = p.player ? `it's ${p.player}'s turn` : 'the world is up for grabs';
    const deadline = p.startBy != null ? ` Start by ${discordTime(p.startBy, 'f')} or it gets skipped.` : '';
    return `🌍 Turn #${p.seq}: ${who}!${deadline} ${p.link}`;
  },

  turnReassigned: (p: { player: string; link: string }) =>
    `🔀 Turn order changed, it's now ${p.player}'s turn! ${p.link}`,

  turnStarted: (p: { seq: number; player: string; deadlineAt: number }) =>
    `▶️ ${p.player} started turn #${p.seq} (ends ${discordTime(p.deadlineAt)}).`,

  turnFinished: (p: { seq: number; player: string }) => `✅ ${p.player} finished turn #${p.seq}.`,

  turnExpired: (p: { seq: number; player: string; reason: ExpireReason; keptCheckpoint: boolean }) => {
    const what = p.reason === 'timeout' ? 'ran out of time without a final upload' : 'was ended early by an admin';
    const progress = p.keptCheckpoint ? 'progress up to the last checkpoint was kept' : 'no progress was saved';
    return `⌛ ${p.player}'s turn #${p.seq} ${what}; ${progress}.`;
  },

  turnSkipped: (p: { seq: number; player: string; reason: SkipReason }) =>
    p.reason.kind === 'admin'
      ? `⏭️ Turn #${p.seq} (${p.player}) was skipped by an admin.`
      : `⏭️ Turn #${p.seq} (${p.player}) was skipped: not started within ${p.reason.hours}h.`,
};
