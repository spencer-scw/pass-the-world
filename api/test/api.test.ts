// In-process API tests: the real app on in-memory SQLite and a temp folder for saves. No server needed.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, openApiConfig } from '../src/app';
import { invitePage } from '../src/invite-page';
import { FsBlobStore } from '../src/node/fs-blobs';
import { SqliteStore } from '../src/node/sqlite';
import { configFromVars, type Env } from '../src/platform';

const savesDir = mkdtempSync(join(tmpdir(), 'ptw-test-'));
afterAll(() => rmSync(savesDir, { recursive: true, force: true }));

// Webhook posts are captured instead of sent.
type Embed = { title: string; url: string; description: string; author: { name: string } };
let posted: { url: string; content?: string; embed: Embed }[] = [];
vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
  const body = JSON.parse(String(init.body));
  posted.push({ url, content: body.content, embed: body.embeds[0] });
  return new Response(null, { status: 204 });
});

let env: Env;
beforeEach(() => {
  posted = [];
  const db = new SqliteStore(':memory:');
  db.migrate(join(__dirname, '../migrations'));
  env = { db, blobs: new FsBlobStore(savesDir), config: configFromVars({ ENVIRONMENT: 'dev' }) };
});

async function call<T = any>(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await api.request(
    path,
    {
      method,
      headers: {
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    },
    env,
  );
  return { status: res.status, body: (await res.json()) as T };
}

const signIn = async (name: string) => (await call('POST', '/auth/dev-login', { body: { name } })).body.token as string;

const webhook = 'https://discord.com/api/webhooks/1/abc';

async function createGame(token: string, extra: Record<string, unknown> = {}) {
  const res = await call('POST', '/games', {
    token,
    body: { name: 'Test', worldName: 'World', playerName: 'Hero', ...extra },
  });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

describe('PATCH /games/:id', () => {
  it('only changes the fields it was sent', async () => {
    const token = await signIn('Alice');
    const id = await createGame(token, { orderMode: 'open', turnMinutes: 90, discordWebhookUrl: webhook });

    const res = await call('PATCH', `/games/${id}`, { token, body: { name: 'Renamed' } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Renamed', orderMode: 'open', turnMinutes: 90, discordWebhookUrl: webhook });
  });

  it('locks world and character names once the game has started', async () => {
    const token = await signIn('Alice');
    const id = await createGame(token);
    expect((await call('PATCH', `/games/${id}`, { token, body: { worldName: 'Other' } })).status).toBe(200);

    await env.db.run(`UPDATE games SET status = 'running' WHERE id = ?`, id);
    const res = await call('PATCH', `/games/${id}`, { token, body: { worldName: 'Again' } });
    expect(res.status).toBe(409);
    // Sending the unchanged name alongside other edits is fine.
    expect((await call('PATCH', `/games/${id}`, { token, body: { worldName: 'Other', name: 'X' } })).status).toBe(200);
  });
});

describe('invite announcements', () => {
  const invites = () => posted.filter((p) => p.embed.url.includes('/join/'));

  it('posts the invite link when a game is created with a webhook', async () => {
    const token = await signIn('Alice');
    const id = await createGame(token, { discordWebhookUrl: webhook });
    const { inviteCode } = (await call('GET', `/games/${id}`, { token })).body.game;
    expect(invites()).toHaveLength(1);
    expect(invites()[0]).toMatchObject({
      url: webhook,
      embed: { title: '📨 Come play!', url: `http://localhost:5173/join/${inviteCode}`, author: { name: 'Test' } },
    });
  });

  it('posts when the webhook is set or changed, but not on other edits', async () => {
    const token = await signIn('Alice');
    const id = await createGame(token);
    expect(invites()).toHaveLength(0);

    await call('PATCH', `/games/${id}`, { token, body: { discordWebhookUrl: webhook } });
    await call('PATCH', `/games/${id}`, { token, body: { name: 'Renamed', discordWebhookUrl: webhook } });
    await call('PATCH', `/games/${id}`, { token, body: { discordWebhookUrl: `${webhook}2` } });
    expect(invites().map((p) => p.url)).toEqual([webhook, `${webhook}2`]);
  });

  it('posts the new link when the invite is reset', async () => {
    const token = await signIn('Alice');
    const id = await createGame(token, { discordWebhookUrl: webhook });
    const { inviteCode } = (await call('POST', `/games/${id}/invite`, { token })).body;
    expect(invites().at(-1)?.embed).toMatchObject({
      title: '🔗 New invite link',
      url: `http://localhost:5173/join/${inviteCode}`,
    });
  });
});

describe('GET /join/:code (invite preview page)', () => {
  const page = async (path: string) => {
    const res = await invitePage.request(path, {}, env);
    return { status: res.status, html: await res.text() };
  };

  it('describes the game for link previews and sends browsers on to the app', async () => {
    const token = await signIn('Alice');
    const id = await createGame(token, { name: 'Moon <Lord> Run', turnMinutes: 45 });
    const { inviteCode } = (await call('GET', `/games/${id}`, { token })).body.game;

    const { status, html } = await page(`/join/${inviteCode}`);
    expect(status).toBe(200);
    expect(html).toContain('<meta property="og:title" content="Join Moon &lt;Lord&gt; Run on Pass the World">');
    expect(html).toContain('1 player · 45-minute turns · fixed rotation.');
    expect(html).toContain(`url=http://localhost:5173/#/join/${inviteCode}`);
  });

  it('still redirects for an unknown code, with a generic preview', async () => {
    const { status, html } = await page('/join/nope');
    expect(status).toBe(200);
    expect(html).toContain('content="Pass the World invite"');
    expect(html).toContain('url=http://localhost:5173/#/join/nope');
  });
});

describe('validation and auth', () => {
  it('reports invalid bodies in the usual { error } shape', async () => {
    const token = await signIn('Alice');
    const res = await call('POST', '/games', { token, body: { name: '', worldName: 'W', playerName: 'P' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/^name: /);
  });

  it('rejects requests without a token', async () => {
    const res = await call('GET', '/games');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Not signed in' });
  });

  it('hides games from non-members', async () => {
    const id = await createGame(await signIn('Alice'));
    expect((await call('GET', `/games/${id}`, { token: await signIn('Mallory') })).status).toBe(404);
  });
});

describe('OpenAPI spec', () => {
  const doc = api.getOpenAPI31Document(openApiConfig as Parameters<typeof api.getOpenAPI31Document>[0]);
  const operations = Object.entries(doc.paths ?? {}).flatMap(([path, item]) =>
    Object.entries(item as Record<string, { summary?: string; tags?: string[]; responses?: object }>).map(
      ([method, op]) => ({ route: `${method.toUpperCase()} ${path}`, op }),
    ),
  );

  it('documents every route with a summary, a tag and responses', () => {
    expect(operations.length).toBeGreaterThan(20);
    for (const { route, op } of operations) {
      expect(op.summary, `${route} summary`).toBeTruthy();
      expect(op.tags?.length, `${route} tags`).toBeGreaterThan(0);
      expect(Object.keys(op.responses ?? {}).length, `${route} responses`).toBeGreaterThan(0);
    }
  });

  it('is served at /openapi.json', async () => {
    const res = await call('GET', '/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
  });
});
