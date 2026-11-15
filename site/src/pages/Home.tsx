import { useEffect, useState } from 'react';
import { api, type GameSummary } from '../api';
import { navigate } from '../router';
import { GameSettingsForm, type GameSettings } from './GameSettingsForm';

const defaults: GameSettings = {
  name: '',
  worldName: '',
  playerName: '',
  turnMinutes: 60,
  orderMode: 'strict',
  startWindowHours: 24,
  discordWebhookUrl: null,
};

export function Home() {
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<GameSummary[]>('/games').then(setGames, (e) => setError(e.message));
  }, []);

  const create = async (settings: GameSettings) => {
    const { id } = await api<{ id: string }>('/games', { method: 'POST', body: settings });
    navigate(`/games/${id}`);
  };

  return (
    <>
      <section className="card">
        <div className="row spread">
          <h1>Your games</h1>
          {!creating && (
            <button className="primary" onClick={() => setCreating(true)}>
              New game
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
        {games?.length === 0 && <p className="muted">No games yet. Create one, or ask a host for an invite link.</p>}
        <ul className="list">
          {games?.map((g) => (
            <li key={g.id}>
              <a href={`#/games/${g.id}`}>{g.name}</a>
              <span className={`badge ${g.status}`}>{g.status}</span>
              {g.role === 'admin' && <span className="badge">admin</span>}
            </li>
          ))}
        </ul>
      </section>
      {creating && (
        <section className="card">
          <h2>New game</h2>
          <GameSettingsForm
            initial={defaults}
            submitLabel="Create game"
            onSubmit={create}
            onCancel={() => setCreating(false)}
          />
        </section>
      )}
    </>
  );
}
