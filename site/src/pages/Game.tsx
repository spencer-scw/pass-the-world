import { useCallback, useEffect, useState } from 'react';
import { api, downloadSnapshot, type GameDetail, type Me, type PlayerView, type TurnView } from '../api';
import { bytes, dateTime, duration } from '../format';
import { GameSettingsForm, type GameSettings } from './GameSettingsForm';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function GamePage({ id, me }: { id: string; me: Me }) {
  const [data, setData] = useState<GameDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    api<GameDetail>(`/games/${id}`).then(setData, (e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  /** Runs an admin action, then refreshes. */
  const act = async (path: string, method = 'POST', body: unknown = {}) => {
    setError(null);
    try {
      await api(path, { method, body });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!data) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  const { game } = data;
  const isAdmin = data.me.role === 'admin';
  const current = data.turns.find((t) => t.id === data.currentTurnId) ?? null;
  // A real path rather than #/join/… so a pasted link previews the game (served by the API host, see invite-page.ts).
  const inviteLink = game.inviteCode ? `${location.origin}${import.meta.env.BASE_URL}join/${game.inviteCode}` : null;

  const saveSettings = async (s: GameSettings) => {
    await api(`/games/${id}`, { method: 'PATCH', body: s });
    setEditing(false);
    load();
  };

  return (
    <>
      <section className="card">
        <div className="row spread">
          <h1>{game.name}</h1>
          <span className={`badge ${game.status}`}>{game.status}</span>
        </div>
        <p className="muted">
          World <b>{game.worldName}</b> · Character <b>{game.playerName}</b> · {game.turnMinutes} min turns ·{' '}
          {game.orderMode === 'strict' ? 'strict rotation' : 'open order'}
        </p>
        {error && <p className="error">{error}</p>}
        {game.status === 'setup' && <SetupChecklist detail={data} onStart={() => act(`/games/${id}/start`)} />}
        {current && <CurrentTurn turn={current} meId={me.id} />}
        {isAdmin && (
          <div className="row wrap">
            {game.status === 'running' && (
              <button onClick={() => act(`/games/${id}`, 'PATCH', { status: 'paused' })}>Pause game</button>
            )}
            {game.status === 'paused' && (
              <button onClick={() => act(`/games/${id}`, 'PATCH', { status: 'running' })}>Resume game</button>
            )}
            {current && (
              <button
                onClick={() => {
                  if (confirm(`Skip turn #${current.seq}? An active turn keeps its last checkpoint.`))
                    act(`/games/${id}/turns/current/skip`);
                }}
              >
                Skip current turn
              </button>
            )}
            <button onClick={() => setEditing((v) => !v)}>{editing ? 'Close settings' : 'Settings'}</button>
            {game.status !== 'finished' && (
              <button
                className="danger"
                onClick={() =>
                  confirm(
                    `End this game for good?${current ? ` Turn #${current.seq} ends now; anything since its last checkpoint is lost.` : ''}`,
                  ) && act(`/games/${id}`, 'PATCH', { status: 'finished' })
                }
              >
                Finish game
              </button>
            )}
          </div>
        )}
      </section>

      {editing && (
        <section className="card">
          <h2>Settings</h2>
          <GameSettingsForm
            initial={{
              name: game.name,
              worldName: game.worldName,
              playerName: game.playerName,
              turnMinutes: game.turnMinutes,
              orderMode: game.orderMode,
              startWindowHours: game.startWindowHours,
              discordWebhookUrl: game.discordWebhookUrl ?? null,
            }}
            lockSaveNames={game.status !== 'setup'}
            submitLabel="Save"
            onSubmit={saveSettings}
            onCancel={() => setEditing(false)}
          />
        </section>
      )}

      <section className="card">
        <h2>Players</h2>
        <Players detail={data} isAdmin={isAdmin} act={act} />
        {isAdmin && inviteLink && (
          <div className="invite">
            <span className="muted">Invite link:</span>
            <code>{inviteLink}</code>
            <button onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy</button>
            <button
              onClick={() => {
                const posts = game.discordWebhookUrl ? ' The new one is posted to Discord.' : '';
                if (confirm(`Reset the invite link? The current link stops working.${posts}`))
                  act(`/games/${id}/invite`);
              }}
            >
              Reset
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>History</h2>
        <History detail={data} isAdmin={isAdmin} act={act} />
      </section>
    </>
  );
}

function SetupChecklist({ detail, onStart }: { detail: GameDetail; onStart: () => void }) {
  const { game } = detail;
  const hasSave = game.headSnapshotId != null;
  return (
    <div className="callout">
      <h3>Setting up</h3>
      <ol>
        <li>
          In tModLoader, create a character named <b>{game.playerName}</b> and a world named <b>{game.worldName}</b>.
        </li>
        <li>
          Open the character select screen → <b>Pass the World</b> → link your account → <b>Upload starting save</b>.{' '}
          {hasSave && '✅'}
        </li>
        <li>Share the invite link below and set the turn order.</li>
      </ol>
      {detail.me.role === 'admin' && (
        <button className="primary" disabled={!hasSave} onClick={onStart}>
          Start the game
        </button>
      )}
    </div>
  );
}

function CurrentTurn({ turn, meId }: { turn: TurnView; meId: string }) {
  const now = useNow();
  const mine = turn.userId === meId;
  if (turn.status === 'active')
    return (
      <div className="callout active">
        <h3>
          Turn #{turn.seq}: {mine ? 'you are' : `${turn.userName} is`} playing
        </h3>
        <p className="countdown">{duration((turn.deadlineAt ?? now) - now)} left</p>
      </div>
    );
  return (
    <div className={`callout ${mine ? 'mine' : ''}`}>
      <h3>
        Turn #{turn.seq}: {turn.userName ? (mine ? "it's your turn!" : `waiting on ${turn.userName}`) : 'up for grabs'}
      </h3>
      <p className="muted">
        Available since {dateTime(turn.availableAt)}. {mine && 'Start it from the Pass the World menu in tModLoader.'}
      </p>
    </div>
  );
}

function Players({
  detail,
  isAdmin,
  act,
}: {
  detail: GameDetail;
  isAdmin: boolean;
  act: (p: string, m?: string, b?: unknown) => void;
}) {
  const players = detail.players;
  const move = (p: PlayerView, delta: number) => {
    const ids = players.map((x) => x.userId);
    const i = ids.indexOf(p.userId);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    act(`/games/${detail.game.id}/order`, 'PUT', { userIds: ids });
  };
  return (
    <ol className="players">
      {players.map((p, i) => (
        <li key={p.userId} className={p.active ? '' : 'inactive'}>
          <span>{p.displayName}</span>
          {p.role === 'admin' && <span className="badge">admin</span>}
          {!p.active && <span className="badge">sitting out</span>}
          {isAdmin && (
            <span className="row actions">
              <button className="icon" disabled={i === 0} onClick={() => move(p, -1)} aria-label="Move up">
                ↑
              </button>
              <button
                className="icon"
                disabled={i === players.length - 1}
                onClick={() => move(p, 1)}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                className="link"
                onClick={() => act(`/games/${detail.game.id}/players/${p.userId}`, 'PATCH', { active: !p.active })}
              >
                {p.active ? 'Sit out' : 'Rejoin'}
              </button>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function History({
  detail,
  isAdmin,
  act,
}: {
  detail: GameDetail;
  isAdmin: boolean;
  act: (p: string, m?: string, b?: unknown) => void;
}) {
  const gameId = detail.game.id;
  const head = detail.game.headSnapshotId;
  const snapsByTurn = new Map<string | null, typeof detail.snapshots>();
  for (const s of detail.snapshots) snapsByTurn.set(s.turnId, [...(snapsByTurn.get(s.turnId) ?? []), s]);

  const SnapshotRow = ({ s }: { s: (typeof detail.snapshots)[number] }) => (
    <li className="snapshot">
      <span>
        {s.kind} · {dateTime(s.createdAt)} · {bytes(s.size)} {s.id === head && <span className="badge">current</span>}
      </span>
      <span className="row">
        <button className="link" onClick={() => downloadSnapshot(gameId, s.id)}>
          Download
        </button>
        {isAdmin && s.id !== head && (
          <button
            className="link"
            onClick={() =>
              confirm('Make this save the starting point for the next turn?') &&
              act(`/games/${gameId}/rollback`, 'POST', { snapshotId: s.id })
            }
          >
            Roll back to this
          </button>
        )}
      </span>
    </li>
  );

  return (
    <ul className="history">
      {detail.turns.map((t) => (
        <li key={t.id}>
          <div className="row spread">
            <span>
              <b>#{t.seq}</b> {t.userName ?? 'unclaimed'}
            </span>
            <span className={`badge ${t.status}`}>{t.status}</span>
          </div>
          {t.claimedAt && (
            <p className="muted small">
              {dateTime(t.claimedAt)}
              {t.endedAt && ` → ${dateTime(t.endedAt)}`}
            </p>
          )}
          <ul>
            {(snapsByTurn.get(t.id) ?? []).map((s) => (
              <SnapshotRow key={s.id} s={s} />
            ))}
          </ul>
        </li>
      ))}
      {(snapsByTurn.get(null) ?? []).map((s) => (
        <li key={s.id}>
          <b>Starting save</b>
          <ul>
            <SnapshotRow s={s} />
          </ul>
        </li>
      ))}
    </ul>
  );
}
