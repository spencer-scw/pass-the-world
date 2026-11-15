import { createRoute } from '@hono/zod-openapi';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { errors } from './copy/errors';
import {
  approveDeviceCode,
  deleteSession,
  findOrCreateDevUser,
  getDeviceCode,
  getUserById,
  insertDeviceCode,
  markDeviceCodeIssued,
  upsertDiscordUser,
} from './db';
import { createRouter, errorsFor, jsonBody, jsonResponse, redirectResponse, signedIn } from './openapi';
import {
  DeviceApproveBody,
  DevicePollBody,
  DevicePollSchema,
  DeviceStartSchema,
  DevLoginBody,
  OkSchema,
  TokenSchema,
  UserSchema,
} from './schemas';
import { createSession } from './session';
import type { Env, User } from './types';
import { HttpError, normalizeUserCode, randomToken, sha256Hex, userCode } from './util';

const DEVICE_CODE_TTL_MS = 10 * 60_000;
const DEVICE_POLL_INTERVAL_S = 5;

const publicUser = (u: User) => ({ id: u.id, displayName: u.display_name });

export const authRoutes = createRouter();

// ---- Discord OAuth (website sign-in) ----

const discordRedirectUri = (env: Env) => `${env.config.apiUrl}/auth/discord/callback`;

authRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/auth/discord/start',
    tags: ['Auth'],
    summary: 'Start Discord sign-in',
    description:
      "Opened by the browser, not fetched. Sets a short-lived state cookie and redirects to Discord's consent screen.",
    responses: { 302: redirectResponse("Redirect to Discord's consent screen."), ...errorsFor(500) },
  }),
  (c) => {
    const { discordClientId } = c.env.config;
    if (!discordClientId) throw new HttpError(500, errors.discordNotConfigured);
    const state = randomToken(16);
    setCookie(c, 'ptw_oauth_state', state, {
      httpOnly: true,
      secure: c.env.config.apiUrl.startsWith('https://'),
      sameSite: 'Lax',
      maxAge: 600,
      path: '/',
    });
    const url = new URL('https://discord.com/oauth2/authorize');
    url.search = new URLSearchParams({
      client_id: discordClientId,
      response_type: 'code',
      scope: 'identify',
      redirect_uri: discordRedirectUri(c.env),
      state,
    }).toString();
    return c.redirect(url.toString(), 302);
  },
);

authRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/auth/discord/callback',
    tags: ['Auth'],
    summary: 'Finish Discord sign-in',
    description:
      'Where Discord sends the browser after consent (verified with the state cookie). Creates the user on first ' +
      'sign-in, then redirects to the site at `#/auth?token=…` with a new web session token.',
    responses: {
      302: redirectResponse('Redirect to the site with a session token in the URL fragment.'),
      ...errorsFor(400, 500, 502),
    },
  }),
  async (c) => {
    const { code, state } = c.req.query();
    const expected = getCookie(c, 'ptw_oauth_state');
    deleteCookie(c, 'ptw_oauth_state', { path: '/' });
    if (!code || !state || state !== expected) throw new HttpError(400, errors.signInFailed);
    const { discordClientId, discordClientSecret } = c.env.config;
    if (!discordClientId || !discordClientSecret) throw new HttpError(500, errors.discordNotConfigured);

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: discordClientId,
        client_secret: discordClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: discordRedirectUri(c.env),
      }),
    });
    if (!tokenRes.ok) throw new HttpError(502, errors.discordRejectedSignIn);
    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const meRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!meRes.ok) throw new HttpError(502, errors.discordProfileUnavailable);
    const me = (await meRes.json()) as { id: string; username: string; global_name: string | null };

    const userId = await upsertDiscordUser(c.env, me.id, me.global_name ?? me.username, Date.now());
    const token = await createSession(c.env, userId, 'web');
    // Token goes in the fragment so it never hits server logs; the site reads and stores it.
    return c.redirect(`${c.env.config.siteUrl}/#/auth?token=${encodeURIComponent(token)}`, 302);
  },
);

// ---- Local development sign-in (no Discord app needed) ----

authRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/auth/dev-login',
    tags: ['Auth'],
    summary: 'Sign in by name (development only)',
    description: 'Returns 404 unless the server runs with `ENVIRONMENT=dev`.',
    request: { body: jsonBody(DevLoginBody) },
    responses: { 200: jsonResponse(TokenSchema, 'A web session token.'), ...errorsFor(400, 404) },
  }),
  async (c) => {
    if (c.env.config.environment !== 'dev') throw new HttpError(404, errors.notFound);
    const { name } = c.req.valid('json');
    const userId = await findOrCreateDevUser(c.env, name, Date.now());
    return c.json({ token: await createSession(c.env, userId, 'web') }, 200);
  },
);

authRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/auth/logout',
    tags: ['Auth'],
    summary: 'Sign out',
    description: 'Revokes the token used to make this request.',
    ...signedIn,
    responses: { 200: jsonResponse(OkSchema, 'Signed out.'), ...errorsFor(401) },
  }),
  async (c) => {
    const token = c.req.header('Authorization')!.slice('Bearer '.length);
    await deleteSession(c.env, await sha256Hex(token));
    return c.json({ ok: true as const }, 200);
  },
);

authRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/me',
    tags: ['Auth'],
    summary: 'Get the signed-in user',
    ...signedIn,
    responses: { 200: jsonResponse(UserSchema, 'The signed-in user.'), ...errorsFor(401) },
  }),
  (c) => c.json(publicUser(c.get('user')), 200),
);

// ---- Device-code flow (linking the mod) ----
// 1. Mod calls /device/start and shows the user code.
// 2. Player signs in on the site and enters the code (/device/approve).
// 3. Mod polls /device/poll and receives a long-lived 'mod' token once.

authRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/device/start',
    tags: ['Mod linking'],
    summary: 'Start linking the mod (step 1)',
    description: 'The mod calls this and shows `userCode` to the player, then polls `/device/poll`.',
    responses: { 200: jsonResponse(DeviceStartSchema, 'A new link code.') },
  }),
  async (c) => {
    const deviceCode = randomToken();
    const code = userCode();
    await insertDeviceCode(c.env, await sha256Hex(deviceCode), code, Date.now() + DEVICE_CODE_TTL_MS);
    return c.json(
      {
        deviceCode,
        userCode: code,
        verifyUrl: `${c.env.config.siteUrl}/#/link?code=${code}`,
        intervalSeconds: DEVICE_POLL_INTERVAL_S,
        expiresIn: DEVICE_CODE_TTL_MS / 1000,
      },
      200,
    );
  },
);

authRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/device/approve',
    tags: ['Mod linking'],
    summary: 'Approve a link code (step 2)',
    description: 'The player enters the code shown in-game on the website.',
    ...signedIn,
    request: { body: jsonBody(DeviceApproveBody) },
    responses: {
      200: jsonResponse(OkSchema, 'Approved. The mod picks up its token on its next poll.'),
      ...errorsFor(400, 401, 404),
    },
  }),
  async (c) => {
    const { userCode: raw } = c.req.valid('json');
    if (!(await approveDeviceCode(c.env, normalizeUserCode(raw), c.get('user').id, Date.now())))
      throw new HttpError(404, errors.linkCodeInvalid);
    return c.json({ ok: true as const }, 200);
  },
);

authRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/device/poll',
    tags: ['Mod linking'],
    summary: 'Poll for the mod token (step 3)',
    description:
      'The mod calls this every `intervalSeconds`; the `deviceCode` is the credential. Returns `pending` until the ' +
      'player approves, then hands out a long-lived mod token exactly once.',
    request: { body: jsonBody(DevicePollBody) },
    responses: {
      200: jsonResponse(DevicePollSchema, 'Pending, or approved with the token.'),
      ...errorsFor(400, 410),
    },
  }),
  async (c) => {
    const { deviceCode } = c.req.valid('json');
    const hash = await sha256Hex(deviceCode);
    const row = await getDeviceCode(c.env, hash);
    if (!row || row.issued || row.expires_at < Date.now()) throw new HttpError(410, errors.linkCodeExpired);
    if (!row.user_id) return c.json({ status: 'pending' as const }, 200);

    // A token is only ever handed out once.
    if (!(await markDeviceCodeIssued(c.env, hash))) throw new HttpError(410, errors.linkCodeAlreadyUsed);

    const user = await getUserById(c.env, row.user_id);
    const token = await createSession(c.env, row.user_id, 'mod');
    return c.json({ status: 'approved' as const, token, user: publicUser(user!) }, 200);
  },
);
