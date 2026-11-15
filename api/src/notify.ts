import { formatMention, notifications, type Card } from './copy/notifications';
import { getUserById } from './db';
import type { Env, Game } from './types';

/** Resolves a user to how notifications should refer to them. */
export async function mention(env: Env, userId: string | null): Promise<string> {
  return formatMention(userId ? await getUserById(env, userId) : null);
}

export const gameLink = (env: Env, game: Game) => `${env.config.siteUrl}/#/games/${game.id}`;
/** A real path (not a #route) so link previews can show the game; see invite-page.ts. */
export const inviteLink = (env: Env, inviteCode: string) => `${env.config.siteUrl}/join/${inviteCode}`;

/** Whether Discord's servers could fetch from this URL (not localhost or a private network address). */
export function isPublicUrl(url: string): boolean {
  const host = new URL(url).hostname;
  return !(
    host === 'localhost' ||
    host.endsWith('.local') ||
    host === '[::1]' ||
    /^(127|10)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

/** The logo for embeds and previews, or undefined when Discord couldn't load it (it would show as broken). */
export const logoUrl = (env: Env) => (isPublicUrl(env.config.siteUrl) ? `${env.config.siteUrl}/logo.png` : undefined);

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

/** The webhook request body for a card: an embed headed by the game's name, plus the ping as plain text. */
export function webhookMessage(env: Env, game: Game, card: Card) {
  const gameUrl = gameLink(env, game);
  return {
    content: card.ping,
    embeds: [
      {
        author: { name: game.name, url: gameUrl, icon_url: logoUrl(env) },
        title: card.title,
        url: card.url ?? gameUrl,
        description: card.description,
        color: card.color,
        fields: card.fields,
        footer: { text: 'Pass the World' },
        timestamp: new Date().toISOString(),
      },
    ],
    allowed_mentions: { parse: ['users'] },
  };
}

/** Posts to the game's Discord webhook, if it has one. Failures are logged, never thrown. */
export async function notify(env: Env, game: Game, card: Card): Promise<void> {
  if (!game.discord_webhook_url) return;
  try {
    const res = await fetch(game.discord_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookMessage(env, game, card)),
    });
    if (!res.ok) console.warn(`Discord webhook returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  } catch (err) {
    console.warn('Discord webhook failed', err);
  }
}
