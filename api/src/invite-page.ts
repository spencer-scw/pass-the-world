// GET /join/:code: a tiny HTML page whose Open Graph tags describe the game, so an invite link pasted in Discord
// unfurls into a card. Browsers are sent straight on to the app's #/join route. This lives outside /api because
// the link is user-facing; each host mounts it next to the static site.
import { Hono } from 'hono';
import { previews } from './copy/previews';
import { findGameByInviteCode, listPlayersWithNames } from './db';
import { logoUrl } from './notify';
import type { Env } from './platform';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

export const invitePage = new Hono<{ Bindings: Env }>();

invitePage.get('/join/:code', async (c) => {
  const code = c.req.param('code');
  const game = await findGameByInviteCode(c.env, code);
  const meta = game
    ? previews.invite({
        gameName: game.name,
        players: (await listPlayersWithNames(c.env, game.id)).length,
        turnMinutes: game.turn_minutes,
        orderMode: game.order_mode,
      })
    : previews.inviteInvalid;

  const site = c.env.config.siteUrl;
  const target = `${site}/#/join/${encodeURIComponent(code)}`;
  const tags = {
    'og:type': 'website',
    'og:site_name': previews.siteName,
    'og:title': meta.title,
    'og:description': meta.description,
    'og:url': `${site}/join/${encodeURIComponent(code)}`,
    'og:image': logoUrl(c.env),
  };
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(meta.title)}</title>
<meta name="description" content="${escapeHtml(meta.description)}">
${Object.entries(tags)
  .map(([k, v]) => `<meta property="${k}" content="${escapeHtml(v)}">`)
  .join('\n')}
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#8fd64a">
<meta http-equiv="refresh" content="0; url=${escapeHtml(target)}">
</head>
<body><a href="${escapeHtml(target)}">${escapeHtml(previews.redirecting)}</a></body>
</html>`;
  return c.html(html, 200, { 'Cache-Control': 'public, max-age=300' });
});
