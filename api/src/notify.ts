import { formatMention, notifications, withGameName } from './copy/notifications';
import { getUserById } from './db';
import type { Env, Game } from './types';

/** Resolves a user to how notifications should refer to them. */
export async function mention(env: Env, userId: string | null): Promise<string> {
  return formatMention(userId ? await getUserById(env, userId) : null);
}

export const gameLink = (env: Env, game: Game) => `${env.config.siteUrl}/#/games/${game.id}`;
export const inviteLink = (env: Env, inviteCode: string) => `${env.config.siteUrl}/#/join/${inviteCode}`;

/** Posts the game's invite link to its webhook. */
export async function announceInvite(env: Env, game: Game, reset = false): Promise<void> {
  if (!game.invite_code) return;
  const link = inviteLink(env, game.invite_code);
  await notify(
    env,
    game,
    notifications.invite({ turnMinutes: game.turn_minutes, orderMode: game.order_mode, link, reset }),
  );
}

/** Posts to the game's Discord webhook, if it has one. Failures are logged, never thrown. */
export async function notify(env: Env, game: Game, content: string): Promise<void> {
  if (!game.discord_webhook_url) return;
  try {
    await fetch(game.discord_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: withGameName(game.name, content), allowed_mentions: { parse: ['users'] } }),
    });
  } catch (err) {
    console.warn('Discord webhook failed', err);
  }
}
