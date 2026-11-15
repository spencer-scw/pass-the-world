import { useEffect, useState } from 'react';
import { api } from '../api';
import { navigate } from '../router';

export function Join({ code }: { code: string }) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ gameId: string }>(`/join/${code}`, { method: 'POST' }).then(
      ({ gameId }) => navigate(`/games/${gameId}`),
      (err) => setError(err.message),
    );
  }, [code]);
  return <section className="card narrow">{error ? <p className="error">{error}</p> : <p>Joining game…</p>}</section>;
}
