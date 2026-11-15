import type { components } from './api-types.gen';

// Same origin by default: both hosts serve the site at / and the API at /api (Vite proxies /api in dev).
const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'ptw.token';

export const apiUrl = API_URL;

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(API_URL + path, {
    method: init.method ?? 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) setToken(null);
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? res.statusText);
  return data as T;
}

// ---- Response types ----
// Generated from the API's OpenAPI spec (see api-types.gen.ts); run `pnpm codegen` after changing the API.

type Schemas = components['schemas'];

export type Me = Schemas['User'];
export type GameStatus = Schemas['GameStatus'];
export type OrderMode = Schemas['OrderMode'];
export type GameView = Schemas['Game'];
export type GameSummary = Schemas['GameSummary'];
export type TurnView = Schemas['Turn'];
export type PlayerView = Schemas['Player'];
export type SnapshotView = GameDetail['snapshots'][number];
export type GameDetail = Schemas['GameDetail'];
export type CreateGameRequest = Schemas['CreateGameRequest'];

export async function downloadSnapshot(gameId: string, snapshotId: string) {
  const res = await fetch(`${API_URL}/games/${gameId}/snapshots/${snapshotId}/download`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new ApiError(res.status, 'Download failed');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `ptw-${snapshotId.slice(0, 8)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
