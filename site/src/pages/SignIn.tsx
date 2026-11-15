import { useState } from 'react';
import { api, apiUrl, setToken } from '../api';

export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Come back to the page they were trying to reach (e.g. an invite or link-device URL).
  const rememberWhereTo = () => sessionStorage.setItem('ptw.next', window.location.hash.replace(/^#/, '') || '/');

  const devLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { token } = await api<{ token: string }>('/auth/dev-login', { method: 'POST', body: { name } });
      setToken(token);
      onSignedIn();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="card narrow">
      <h1>Sign in</h1>
      <p className="muted">Take turns playing one Terraria world, one hour at a time.</p>
      <a className="button primary" href={`${apiUrl}/auth/discord/start`} onClick={rememberWhereTo}>
        Sign in with Discord
      </a>
      {import.meta.env.VITE_DEV_LOGIN === 'true' && (
        <form onSubmit={devLogin} className="stack">
          <hr />
          <label>
            Dev login (local only)
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Any name" required />
          </label>
          <button type="submit">Continue</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
