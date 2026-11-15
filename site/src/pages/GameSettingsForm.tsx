import { useState } from 'react';
import type { OrderMode } from '../api';

export interface GameSettings {
  name: string;
  worldName: string;
  playerName: string;
  turnMinutes: number;
  orderMode: OrderMode;
  startWindowHours: number | null;
  discordWebhookUrl: string | null;
}

export function GameSettingsForm(props: {
  initial: GameSettings;
  submitLabel: string;
  onSubmit: (s: GameSettings) => Promise<void>;
  onCancel?: () => void;
  lockSaveNames?: boolean;
}) {
  const [s, setS] = useState(props.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof GameSettings>(k: K, v: GameSettings[K]) => setS((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await props.onSubmit(s);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid-form">
      <label>
        Game name
        <input value={s.name} onChange={(e) => set('name', e.target.value)} required maxLength={64} />
      </label>
      <label>
        World name (in-game)
        <input
          value={s.worldName}
          onChange={(e) => set('worldName', e.target.value)}
          required
          disabled={props.lockSaveNames}
        />
      </label>
      <label>
        Character name (in-game)
        <input
          value={s.playerName}
          onChange={(e) => set('playerName', e.target.value)}
          required
          disabled={props.lockSaveNames}
        />
      </label>
      <label>
        Turn length (minutes)
        <input
          type="number"
          min={5}
          max={1440}
          value={s.turnMinutes}
          onChange={(e) => set('turnMinutes', Number(e.target.value))}
        />
      </label>
      <label>
        Turn order
        <select value={s.orderMode} onChange={(e) => set('orderMode', e.target.value as OrderMode)}>
          <option value="strict">Strict rotation</option>
          <option value="open">Open (anyone but the last player)</option>
        </select>
      </label>
      <label>
        Auto-skip after (hours, blank = never)
        <input
          type="number"
          min={1}
          value={s.startWindowHours ?? ''}
          disabled={s.orderMode === 'open'}
          onChange={(e) => set('startWindowHours', e.target.value === '' ? null : Number(e.target.value))}
        />
      </label>
      <label className="full">
        Discord webhook URL (optional)
        <input
          type="url"
          value={s.discordWebhookUrl ?? ''}
          placeholder="https://discord.com/api/webhooks/…"
          onChange={(e) => set('discordWebhookUrl', e.target.value || null)}
        />
      </label>
      <div className="row full">
        <button className="primary" type="submit" disabled={busy}>
          {props.submitLabel}
        </button>
        {props.onCancel && (
          <button type="button" onClick={props.onCancel}>
            Cancel
          </button>
        )}
      </div>
      {error && <p className="error full">{error}</p>}
    </form>
  );
}
