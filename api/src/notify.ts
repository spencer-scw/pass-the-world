import { formatMention, withGameName } from './copy/notifications';
import { getUserById } from './db';
import type { Env, Game } from './types';

/** Resolves a user to how notifications should refer to them. */
export async function mention(env: Env, userId: string | null): Promise<string> {
  return formatMention(userId ? await getUserById(env, userId) : null);
}

export const gameLink = (env: Env, game: Game) => `${env.config.siteUrl}/#/games/${game.id}`;

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
