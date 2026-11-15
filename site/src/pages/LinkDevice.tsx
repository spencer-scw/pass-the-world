import { useState } from 'react';
import { api } from '../api';

export function LinkDevice({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [state, setState] = useState<'idle' | 'done' | { error: string }>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/device/approve', { method: 'POST', body: { userCode: code } });
      setState('done');
    } catch (err) {
      setState({ error: (err as Error).message });
    }
  };

  if (state === 'done')
    return (
      <section className="card narrow">
        <h1>Linked ✅</h1>
        <p>Head back to Terraria, the mod will finish linking in a few seconds.</p>
      </section>
    );

  return (
    <section className="card narrow">
      <h1>Link the mod</h1>
      <p className="muted">Enter the code shown in the Pass the World menu in tModLoader.</p>
      <form onSubmit={submit} className="stack">
        <input
          className="code-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ABCD-EFGH"
          required
        />
        <button className="primary" type="submit">
          Link this game client to my account
        </button>
      </form>
      {typeof state === 'object' && <p className="error">{state.error}</p>}
    </section>
  );
}
