# Pass the World

Tools for running a Terraria **Pass the World** game: players take turns playing one shared world and character for a fixed amount of real time, then hand it to the next person.

- **`mod/`** is a client-side tModLoader mod. It lets you into the shared world only on your turn, runs the countdown, saves checkpoints and syncs the save files.
- **`api/`** is the backend. It is the source of truth for whose turn it is and stores every version of the save.
- **`site/`** is a static React site. Hosts use it to create and manage games, and players use it to sign in, join games and see history.

The same code runs on either of two hosts. Each one serves the site at `/` and the API at `/api` from a single origin:

|            | Cloudflare (free tier)         | Self-hosted (Docker)                                |
| ---------- | ------------------------------ | --------------------------------------------------- |
| Entrypoint | `api/src/cloudflare/worker.ts` | `api/src/node/server.ts`                            |
| Database   | D1                             | SQLite file (`node:sqlite`, no native dependencies) |
| Save files | R2                             | Files on disk, stored in a Docker volume            |
| Website    | Workers Static Assets          | Served by the Node server                           |
| Turn sweep | Cron trigger                   | `setInterval`                                       |
| HTTPS      | Automatic                      | Caddy (included in `compose.yaml`)                  |

Everything outside those two entrypoints is shared. The interfaces the two hosts implement are in `api/src/platform.ts`.

```
 tModLoader mod ──HTTPS──▶  /api  ──▶  Database (D1 or SQLite)
                               │   ──▶  Save files (R2 or disk)
 browser ────────HTTPS──▶  /       (static site)
                               └──▶  Discord webhook ("it's @sam's turn")
```

## How a turn works

1. The site and Discord announce **turn #N** for a player. In strict rotation the turn belongs to one player. In open order anyone can take it except the person who went last.
2. In tModLoader, the player goes to **character select → Pass the World → Start turn**. The mod claims the turn, which starts the wall-clock timer on the server. It then downloads the latest save bundle, checks its SHA-256 and loads straight into the world.
3. While the player is in the world:
   - The timer shows at the top of the HUD.
   - Warnings appear at 10, 5 and 1 minutes left.
   - The mod sends a heartbeat every minute and uploads a checkpoint every 10 minutes (configurable).
4. When time runs out, the mod saves, quits and uploads the **final** bundle. The server makes that bundle the new head save and opens the next turn.
5. If the player quits early, the mod uploads a checkpoint and the clock keeps running. They can **Resume turn** from any PC until the deadline.
6. A sweep runs every 5 minutes:
   - If a turn's deadline plus a 10-minute upload grace period has passed, the turn **expires**. Its last checkpoint becomes the new head save.
   - In strict mode, if a player doesn't start their turn within the start window, the turn is **skipped**.

### Save bundle format

Each bundle is a zip containing:

| Path                              | Contents                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `Worlds/<world>.wld` + `.twld`    | The world, plus modded world data                                                 |
| `Players/<char>.plr` + `.tplr`    | The character, plus modded character data                                         |
| `Players/<char>/*.map` + `*.tmap` | The explored map. Without these, the next player starts with a fully covered map. |
| `ptw.json`                        | Manifest                                                                          |

### Where saves live

A game's character and world are kept in `tModLoader/PassTheWorld/Saves/<gameId>/`, outside the normal `Players/`
and `Worlds/` folders, so they never show up in the vanilla select screens.

- **Starting save:** after the admin uploads it, the mod moves the character and world out of the normal folders
  into that storage.
- **During a turn:** the mod copies the save into the normal folders under a unique name (`PTW_<id>_Hero.plr`),
  so vanilla code and other mods that assume those folders work normally, and a same-named personal save is never
  overwritten. After saving and quitting, the mod copies it back into storage and removes the staged copy along
  with any `.bak` files and daily backups the game made of it.
- **Crashes:** if the game closes mid-turn, the staged copy is moved back into storage the next time the mod loads.

### Turn enforcement

When a turn starts, the mod writes the game's ID into the world's `.twld` and the character's `.tplr`. If a tagged world or character is loaded and this client doesn't hold that game's turn, the mod removes the player from the world without saving.

This only stops _accidental_ off-turn play. Anyone can copy the save files or disable the mod. The server keeps every snapshot, so an admin can always **roll back**.

## Local development

You need Node 22.13+ and pnpm.

```sh
pnpm install
pnpm dev:site            # http://localhost:5173. Proxies /api to :8787.

# Then run ONE of these backends on :8787:
pnpm --filter api db:migrate:local && pnpm dev:api   # Cloudflare runtime (wrangler: local D1 + R2)
pnpm --filter api dev:node                           # Node runtime (SQLite + ./api/data)

pnpm test                # rotation rules, notification copy, and in-process API tests
pnpm typecheck           # checks both hosts
```

`site/.env.development.local` turns on a **dev login**: you type any name and get an account, so Discord isn't needed locally. To try the Cloudflare cron sweep, run `wrangler dev --test-scheduled` and then `curl "localhost:8787/__scheduled"`.

### Building the mod

tModLoader 1.4.4 needs the **.NET 8 SDK** to build mods (on Arch: `sudo pacman -S dotnet-sdk-8.0`).

1. Start tModLoader once and open **Workshop → Develop Mods**. This creates `ModSources/` and `ModSources/tModLoader.targets`.
2. From the repo root, symlink the mod into `ModSources/`, and tModLoader's targets file back into `mod/`:
   ```sh
   MODSOURCES=~/.local/share/Terraria/tModLoader/ModSources   # Windows: Documents/My Games/Terraria/tModLoader/ModSources
   ln -s "$PWD/mod/PassTheWorld" "$MODSOURCES/PassTheWorld"
   ln -s "$MODSOURCES/tModLoader.targets" mod/tModLoader.targets
   ```
   The second link is needed because MSBuild follows symlinks: the project's `..\tModLoader.targets` import resolves
   relative to the repo, not `ModSources/`. It also lets editors open the project straight from the repo.
   `mod/tModLoader.targets` is gitignored.
3. In **Develop Mods**, click **Build + Reload**.
4. Under **Mod Configuration → Pass the World**, set **Server address** to `http://localhost:8787/api` for local
   development, or `<your site>/api` for a self-hosted server. The default is the public server,
   `https://passtheworld.skrewt.dev/api`.

## Deploying

### Discord sign-in (both hosts)

Create an app at <https://discord.com/developers/applications>. Under **OAuth2**, add `<your site>/api/auth/discord/callback` as a redirect URL. Optionally, give each game a Discord webhook URL so it can post turn announcements.

### Cloudflare

`api/wrangler.toml` holds the production settings (the real deployment's domain and D1 database ID); locally,
`api/.dev.vars` overrides them. For your own deployment:

```sh
cd api
npx wrangler login
npx wrangler d1 create pass-the-world        # put the database_id in wrangler.toml
npx wrangler r2 bucket create pass-the-world-saves   # enable R2 in the dashboard first
# In wrangler.toml: set SITE_URL and API_URL (<SITE_URL>/api), and either the custom-domain `routes`
# entry (a domain in your Cloudflare zone) or `workers_dev = true` for <name>.<subdomain>.workers.dev.
npx wrangler secret put DISCORD_CLIENT_ID
npx wrangler secret put DISCORD_CLIENT_SECRET
pnpm db:migrate:remote
pnpm run deploy                               # builds the site, deploys the site and the API together
```

Add `<SITE_URL>/api/auth/discord/callback` as a redirect in the Discord app. To update a deployment, run
`pnpm db:migrate:remote` (if there are new migrations) and `pnpm run deploy` again.

#### Continuous deployment

`.github/workflows/ci.yml` checks every pull request (format, types, tests, site build). When a PR is merged, the
same checks run on `main` and, if they pass, the workflow applies D1 migrations and deploys. It needs two repository
secrets: `CLOUDFLARE_API_TOKEN` (an API token with **Workers Scripts: Edit** and **D1: Edit**, plus **Workers Routes:
Edit** on the zone for a custom domain) and `CLOUDFLARE_ACCOUNT_ID`. Discord credentials stay in Cloudflare's own
secret store and aren't touched by deploys.

### Self-hosted (Docker)

The server needs Docker, a domain or subdomain pointing at its public IP, and ports 80 and 443 open.

```sh
cp .env.example .env        # set DOMAIN and the Discord credentials
docker compose up -d --build
```

Caddy obtains a TLS certificate for `DOMAIN` automatically. All state lives in the `data` volume: the SQLite database and every save snapshot. Back up that volume. To update, run `git pull` and then `docker compose up -d --build`. Migrations run automatically when the server starts.

If the machine already runs a reverse proxy, drop the `caddy` service and point the existing proxy at the `app` container's port 8080. Make sure the proxy allows request bodies of at least 64 MB.

### Moving between hosts

Both hosts use the same SQLite schema and store saves under the same keys (`games/<id>/snapshots/<id>.zip`). To migrate:

1. Export the database. From Cloudflare, run `wrangler d1 export pass-the-world --remote --output dump.sql`. From the self-hosted server, use `sqlite3 pass-the-world.sqlite .dump`.
2. Copy the save files between the R2 bucket and `/data/saves/` (`rclone` handles both).

There's no one-command migration yet.

## API reference

The API is described by an OpenAPI 3.1 spec generated from the code (`api/src/schemas.ts` plus each route's
`createRoute` definition), so the docs can't drift from what the server does.

- `/api/docs`: browsable reference (Scalar)
- `/api/openapi.json`: the raw spec, for generating clients (e.g. the mod's C# types or the site's TS types)

Locally that's <http://localhost:8787/api/docs>. Handlers are type-checked against their declared responses, and
`api/test/api.test.ts` checks that every route has a summary, a tag and documented responses.

### Generated clients

The site's TypeScript types and the mod's C# records are generated from the spec, so a change to the API that a
client doesn't pick up fails the build instead of failing at runtime.

```sh
pnpm codegen          # after changing api/src/schemas.ts or a route: regenerate everything
pnpm codegen:check    # verify generated files are current (pnpm test does this too)
```

| File                                         | Generated by                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `api/openapi.json`                           | The spec itself, committed so API changes show up in diffs                                           |
| `site/src/api-types.gen.ts`                  | [openapi-typescript](https://openapi-ts.dev/); `site/src/api.ts` re-exports friendly names           |
| `mod/PassTheWorld/Common/Api/ApiModels.g.cs` | `api/scripts/csharp.ts`: records with a `Dto` suffix, plus constants for enums (`TurnStatus.Active`) |

Don't edit the generated files by hand.

## Not done yet / ideas

- **Content mods:** pin a modpack (mod names and versions) per game and have the mod compare it with `ModLoader.Mods` before a turn starts.
- **Tamper detection:** compare the `turnSeq` tag in the world with the server's turn number and flag mismatches.
- **Retention:** delete checkpoint snapshots of completed turns after N days.
- **Host migration:** a single export/import command (database plus saves) for moving between Cloudflare and self-hosting.
- **Turn recaps:** bosses killed, deaths, deepest point reached and a screenshot at the end of each turn, shown on a history timeline.
- **More notifications:** a reminder when a player's start window is about to run out.
