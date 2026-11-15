// Discord messages posted to a game's webhook, as cards (embeds). Builders take already-resolved mentions
// (see notify.ts `mention`) so they stay pure and easy to tweak.

/** Discord timestamp that renders in each reader's local time ('t' = time, 'f' = date + time, 'R' = "in 2 hours"). */
const discordTime = (ms: number, style: 't' | 'f' | 'R' = 't') => `<t:${Math.floor(ms / 1000)}:${style}>`;

/** Why a turn expired (ended without a final upload, keeping its last checkpoint). */
export type ExpireReason = 'timeout' | 'admin';

/** Why a turn was skipped (ended with its progress discarded). */
export type SkipReason = { kind: 'admin' } | { kind: 'no-show'; hours: number };

/**
 * One webhook post. notify.ts turns it into an embed with the game's name, the logo and a link to the game.
 * Mentions inside an embed are displayed but don't notify anyone, so `ping` (plain text above the card) is
 * where a player who needs to act gets pinged.
 */
export interface Card {
  ping?: string;
  title: string;
  description: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  /** Where the title links to. Defaults to the game page. */
  url?: string;
}

/** Card colours, matching the website's theme. */
const color = {
  go: 0x8fd64a,
  info: 0x4b60ad,
  gold: 0xf2d35b,
  danger: 0xff8270,
};

/** How a user is referred to: a Discord ping when we know their ID, otherwise their bolded name. */
export function formatMention(user: { display_name: string; discord_id: string | null } | null): string {
  if (!user) return '**someone**';
  return user.discord_id ? `<@${user.discord_id}>` : `**${user.display_name}**`;
}

export const notifications = {
  /** The invite link, posted when a game gets a webhook and whenever the link is reset. */
  invite: (p: { turnMinutes: number; orderMode: 'strict' | 'open'; link: string; reset: boolean }): Card => ({
    title: p.reset ? '🔗 New invite link' : '📨 Come play!',
    description: p.reset
      ? `The invite link was reset; old links no longer work.\n**[Join the game](${p.link})**`
      : `Take turns playing one shared Terraria world.\n**[Join the game](${p.link})**`,
    color: color.gold,
    url: p.link,
    fields: [
      { name: 'Turns', value: `${p.turnMinutes} minutes`, inline: true },
      { name: 'Order', value: p.orderMode === 'strict' ? 'Fixed rotation' : 'Anyone, any order', inline: true },
    ],
  }),

  /** A new turn opened. `player` is null in open order. `startBy` is set when a no-show will be auto-skipped. */
  turnAvailable: (p: { seq: number; player: string | null; startBy: number | null }): Card => ({
    ping: p.player ? `${p.player}, you're up!` : undefined,
    title: `🌍 Turn #${p.seq} is ready`,
    description: p.player
      ? `It's ${p.player}'s turn.`
      : 'The world is up for grabs: anyone except the last player can take it.',
    color: color.go,
    fields:
      p.startBy != null
        ? [
            {
              name: 'Start by',
              value: `${discordTime(p.startBy, 'f')} (${discordTime(p.startBy, 'R')}) or it gets skipped`,
            },
          ]
        : undefined,
  }),

  turnReassigned: (p: { player: string }): Card => ({
    ping: `${p.player}, you're up!`,
    title: '🔀 Turn order changed',
    description: `It's now ${p.player}'s turn.`,
    color: color.go,
  }),

  turnStarted: (p: { seq: number; player: string; deadlineAt: number }): Card => ({
    title: `▶️ Turn #${p.seq} started`,
    description: `${p.player} is playing.`,
    color: color.info,
    fields: [{ name: 'Ends', value: `${discordTime(p.deadlineAt)} (${discordTime(p.deadlineAt, 'R')})` }],
  }),

  turnFinished: (p: { seq: number; player: string }): Card => ({
    title: `✅ Turn #${p.seq} finished`,
    description: `${p.player} passed the world on.`,
    color: color.go,
  }),

  turnExpired: (p: { seq: number; player: string; reason: ExpireReason; keptCheckpoint: boolean }): Card => ({
    title: `⌛ Turn #${p.seq} ended early`,
    description:
      p.reason === 'timeout'
        ? `${p.player}'s turn ran out of time without a final upload.`
        : `${p.player}'s turn was ended early by an admin.`,
    color: color.gold,
    fields: [
      {
        name: 'Progress',
        value: p.keptCheckpoint
          ? 'Kept up to the last checkpoint'
          : 'None saved; the world is as it was before the turn',
      },
    ],
  }),

  turnSkipped: (p: { seq: number; player: string; reason: SkipReason }): Card => ({
    title: `⏭️ Turn #${p.seq} skipped`,
    description:
      p.reason.kind === 'admin'
        ? `${p.player}'s turn was skipped by an admin.`
        : `${p.player} didn't start within ${p.reason.hours}h.`,
    color: color.danger,
  }),
};
